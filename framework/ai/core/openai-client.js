/**
 * Shared OpenAI API wrapper with retry logic and JSON response parsing.
 */

const OpenAI = require('openai');

class AIClient {
  constructor(config) {
    this.config = config;
    this.client = new OpenAI({
      apiKey: config.openaiApiKey,
      timeout: config.openaiTimeout,
    });
  }

  /**
   * Send a chat completion request and parse the JSON response.
   * @param {string} systemPrompt - System message for the model.
   * @param {string} userPrompt - User message content.
   * @param {object} [options] - Optional overrides.
   * @param {string} [options.model] - Model to use (defaults to config.healingModel).
   * @param {number} [options.maxTokens] - Max tokens in response.
   * @param {number} [options.retries] - Number of retries on failure.
   * @returns {Promise<object>} Parsed JSON response from the model.
   */
  async chatCompletionJSON(systemPrompt, userPrompt, options = {}) {
    const model = options.model || this.config.healingModel;
    const maxTokens = options.maxTokens || 4096;
    const retries = options.retries ?? 2;

    let lastError;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await this.client.chat.completions.create({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          max_tokens: maxTokens,
          temperature: 0.2,
          response_format: { type: 'json_object' },
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
          throw new Error('Empty response from OpenAI');
        }

        return JSON.parse(content);
      } catch (err) {
        lastError = err;
        if (attempt < retries) {
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    }

    throw new Error(
      `OpenAI API call failed after ${retries + 1} attempts: ${lastError?.message}`
    );
  }

  /**
   * Send a chat completion with a vision message (screenshot analysis).
   * @param {string} systemPrompt
   * @param {string} textPrompt
   * @param {Buffer} imageBuffer - PNG/JPEG screenshot buffer.
   * @param {object} [options]
   * @returns {Promise<object>} Parsed JSON response.
   */
  async visionCompletionJSON(systemPrompt, textPrompt, imageBuffer, options = {}) {
    const model = options.model || this.config.analysisModel;
    const maxTokens = options.maxTokens || 4096;
    const retries = options.retries ?? 2;

    const base64Image = imageBuffer.toString('base64');

    let lastError;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await this.client.chat.completions.create({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            {
              role: 'user',
              content: [
                { type: 'text', text: textPrompt },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:image/png;base64,${base64Image}`,
                    detail: 'high',
                  },
                },
              ],
            },
          ],
          max_tokens: maxTokens,
          temperature: 0.2,
          response_format: { type: 'json_object' },
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
          throw new Error('Empty response from OpenAI');
        }

        return JSON.parse(content);
      } catch (err) {
        lastError = err;
        if (attempt < retries) {
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    }

    throw new Error(
      `OpenAI Vision API call failed after ${retries + 1} attempts: ${lastError?.message}`
    );
  }
}

module.exports = { AIClient };
