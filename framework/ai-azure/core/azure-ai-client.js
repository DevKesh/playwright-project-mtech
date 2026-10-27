/**
 * Azure AI Foundry — Anthropic passthrough client.
 *
 * Public API mirrors framework/ai/core/openai-client.js so this can be
 * swapped in by changing a single `require` later:
 *   - chatCompletionJSON(systemPrompt, userPrompt, options)
 *   - visionCompletionJSON(systemPrompt, textPrompt, imageBuffer, options)
 *
 * Speaks the Anthropic Messages API (POST to /anthropic/v1/messages with
 * `api-key` header). Uses Node 18+ built-in fetch.
 */

class AzureAIClient {
  constructor(config) {
    this.config = config;
    this.endpoint = config.endpoint;
    this.apiKey = config.apiKey;
    this.model = config.model;
    this.anthropicVersion = config.anthropicVersion || '2023-06-01';
    this.timeout = config.timeout || config.openaiTimeout || 60000;
  }

  async chatCompletionJSON(systemPrompt, userPrompt, options = {}) {
    const model = options.model || this.model;
    const maxTokens = options.maxTokens || 4096;
    const retries = options.retries ?? 2;

    const hardenedSystem =
      `${systemPrompt}\n\n` +
      `You MUST respond with a single valid JSON object and nothing else. ` +
      `Do not wrap the JSON in markdown code fences. Do not include any prose.`;

    const body = {
      model,
      max_tokens: maxTokens,
      temperature: 0.2,
      system: hardenedSystem,
      messages: [{ role: 'user', content: userPrompt }],
    };

    const data = await this._postWithRetry(body, retries);
    return this._extractJSONFromMessage(data);
  }

  async visionCompletionJSON(systemPrompt, textPrompt, imageBuffer, options = {}) {
    const model = options.model || this.model;
    const maxTokens = options.maxTokens || 4096;
    const retries = options.retries ?? 2;
    const mediaType = options.mediaType || 'image/png';
    const base64Image = imageBuffer.toString('base64');

    const hardenedSystem =
      `${systemPrompt}\n\n` +
      `Respond with a single valid JSON object and nothing else. ` +
      `No markdown, no prose.`;

    const body = {
      model,
      max_tokens: maxTokens,
      temperature: 0.2,
      system: hardenedSystem,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: base64Image,
              },
            },
            { type: 'text', text: textPrompt },
          ],
        },
      ],
    };

    const data = await this._postWithRetry(body, retries);
    return this._extractJSONFromMessage(data);
  }

  async _postWithRetry(body, retries) {
    let lastError;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await this._post(body);
      } catch (err) {
        lastError = err;
        const status = err.status;
        const retryable = !status || status === 429 || status >= 500;
        if (!retryable || attempt >= retries) break;
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise((r) => setTimeout(r, delay));
      }
    }
    throw new Error(
      `Azure Anthropic call failed after ${retries + 1} attempts: ${lastError?.message}`
    );
  }

  async _post(body) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    let res;
    try {
      res = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          // Anthropic-style auth — the Azure AI Foundry /anthropic/v1/messages
          // passthrough accepts `x-api-key` (Anthropic-native) but NOT the
          // Azure `api-key` header on this route.
          'x-api-key': this.apiKey,
          'anthropic-version': this.anthropicVersion,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timer);
      if (err.name === 'AbortError') {
        const e = new Error(`Request timed out after ${this.timeout}ms`);
        e.code = 'TIMEOUT';
        throw e;
      }
      throw err;
    }
    clearTimeout(timer);

    const text = await res.text();
    if (!res.ok) {
      const err = new Error(
        `HTTP ${res.status} ${res.statusText} from Azure Anthropic endpoint: ${text.slice(0, 500)}`
      );
      err.status = res.status;
      err.body = text;
      throw err;
    }

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      const err = new Error(`Non-JSON response body: ${text.slice(0, 200)}`);
      err.status = res.status;
      throw err;
    }
    return parsed;
  }

  _extractJSONFromMessage(message) {
    if (!message || !Array.isArray(message.content)) {
      throw new Error(`Unexpected response shape: ${JSON.stringify(message).slice(0, 300)}`);
    }
    const textBlock = message.content.find((b) => b && b.type === 'text');
    if (!textBlock || typeof textBlock.text !== 'string') {
      throw new Error('No text block in Anthropic response');
    }

    const parsed = parseJsonLoose(textBlock.text);

    try {
      if (message.usage && parsed && typeof parsed === 'object') {
        const usage = {
          prompt_tokens: message.usage.input_tokens,
          completion_tokens: message.usage.output_tokens,
          total_tokens:
            (message.usage.input_tokens || 0) + (message.usage.output_tokens || 0),
          _raw: message.usage,
        };
        Object.defineProperty(parsed, '__usage', { value: usage, enumerable: false });
      }
    } catch { /* cost tracking must never break the response */ }

    return parsed;
  }
}

function parseJsonLoose(content) {
  let text = String(content).trim();
  const fenced = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced) text = fenced[1].trim();
  try {
    return JSON.parse(text);
  } catch {
    const first = text.indexOf('{');
    const last = text.lastIndexOf('}');
    if (first !== -1 && last !== -1 && last > first) {
      return JSON.parse(text.slice(first, last + 1));
    }
    throw new Error(`Could not parse JSON from response: ${text.slice(0, 200)}`);
  }
}

module.exports = { AzureAIClient };
