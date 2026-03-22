/**
 * Locator Healer Agent: the core self-healing engine.
 *
 * When a locator action fails, this agent:
 * 1. Extracts a trimmed DOM snapshot from the page (interactive elements only)
 * 2. Sends the failed selector + DOM to GPT for alternative suggestions
 * 3. Validates each suggestion against the live page
 * 4. Retries the original action with the best valid suggestion
 * 5. Logs the healing event (success or failure) to healing history
 */

const { createAIClient } = require('../core/ai-client-factory');
const { buildLocatorHealingPrompt } = require('../prompts/locator-healing.prompt');
const { appendHealingEvent } = require('../storage/healing-history');

class LocatorHealerAgent {
  constructor(config) {
    this.config = config;
    this.aiClient = createAIClient(config);
  }

  /**
   * Extract a trimmed DOM snapshot focused on interactive elements.
   * This keeps the token count manageable for GPT.
   * @param {import('@playwright/test').Page} page
   * @returns {Promise<string>}
   */
  async extractDOMSnapshot(page) {
    const dom = await page.evaluate(() => {
      // Recursively serialize the DOM, keeping only structurally significant elements
      function serialize(node, depth) {
        if (depth > 15) return '';
        if (node.nodeType === Node.TEXT_NODE) {
          const text = node.textContent.trim();
          return text ? text : '';
        }
        if (node.nodeType !== Node.ELEMENT_NODE) return '';

        const el = node;
        const tag = el.tagName.toLowerCase();

        // Skip non-visible elements
        if (['script', 'style', 'noscript', 'svg', 'path', 'meta', 'link'].includes(tag)) {
          return '';
        }

        // Build attributes string (only useful attributes)
        const attrs = [];
        const keepAttrs = [
          'id', 'class', 'type', 'name', 'placeholder', 'value', 'href',
          'role', 'aria-label', 'aria-labelledby', 'aria-describedby',
          'data-testid', 'for', 'formcontrolname', 'routerlink',
          'data-id', 'data-name', 'title', 'alt',
        ];
        for (const attr of keepAttrs) {
          if (el.hasAttribute(attr)) {
            let val = el.getAttribute(attr);
            if (attr === 'class') {
              // Trim long class lists
              val = val.split(' ').slice(0, 5).join(' ');
            }
            attrs.push(`${attr}="${val}"`);
          }
        }
        const attrStr = attrs.length > 0 ? ' ' + attrs.join(' ') : '';

        // Serialize children
        const children = Array.from(el.childNodes)
          .map((child) => serialize(child, depth + 1))
          .filter(Boolean)
          .join('');

        // Self-closing tags
        if (['input', 'img', 'br', 'hr'].includes(tag)) {
          return `<${tag}${attrStr}/>`;
        }

        // Skip empty divs/spans that add no value
        if (!children && !attrStr && ['div', 'span'].includes(tag)) {
          return '';
        }

        return `<${tag}${attrStr}>${children}</${tag}>`;
      }

      return serialize(document.body, 0);
    });

    // Trim to max length to stay within token limits
    const maxLen = this.config.maxDomLength || 60000;
    if (dom.length > maxLen) {
      return dom.substring(0, maxLen) + '\n<!-- DOM truncated -->';
    }
    return dom;
  }

  /**
   * Attempt to heal a failed locator.
   * @param {object} params
   * @param {import('@playwright/test').Page} params.page - The Playwright page.
   * @param {string} params.failedSelector - Description of the failed selector.
   * @param {object} params.error - The error that occurred.
   * @param {string} params.action - The action method name (click, fill, etc.).
   * @param {Array} params.actionArgs - Arguments for the action.
   * @returns {Promise<{ healed: boolean, healedSelector?: string, confidence?: number, actionResult?: any }>}
   */
  async heal({ page, failedSelector, error, action, actionArgs, strategyHint }) {
    const startTime = Date.now();

    // 1. Extract DOM
    const domSnapshot = await this.extractDOMSnapshot(page);

    // 2. Ask GPT for suggestions (pass strategyHint to focus on specific locator types)
    const { systemPrompt, userPrompt } = buildLocatorHealingPrompt({
      failedSelector,
      errorMessage: error.message,
      action,
      domSnapshot,
      strategyHint,
    });

    const gptResponse = await this.aiClient.chatCompletionJSON(systemPrompt, userPrompt, {
      model: this.config.healingModel,
    });

    const suggestions = gptResponse.suggestions || [];

    // 3. Validate and try each suggestion
    for (const suggestion of suggestions) {
      if (suggestion.confidence < this.config.confidenceThreshold) {
        console.log(
          `[AI-HEAL] Skipping low-confidence suggestion (${suggestion.confidence}): ${suggestion.selector}`
        );
        continue;
      }

      try {
        let healedLocator;

        // Construct the locator based on the suggestion type
        if (suggestion.type === 'locator') {
          healedLocator = page.locator(suggestion.selector);
        } else if (suggestion.type === 'getByRole') {
          // Parse getByRole arguments from the selector string
          const parsed = this._parseGetByArgs(suggestion.selector);
          if (parsed) {
            healedLocator = page.getByRole(parsed.role, parsed.options);
          }
        } else if (suggestion.type === 'getByText') {
          const arg = this._extractStringArg(suggestion.selector);
          if (arg) healedLocator = page.getByText(arg);
        } else if (suggestion.type === 'getByLabel') {
          const arg = this._extractStringArg(suggestion.selector);
          if (arg) healedLocator = page.getByLabel(arg);
        } else if (suggestion.type === 'getByPlaceholder') {
          const arg = this._extractStringArg(suggestion.selector);
          if (arg) healedLocator = page.getByPlaceholder(arg);
        } else if (suggestion.type === 'getByTestId') {
          const arg = this._extractStringArg(suggestion.selector);
          if (arg) healedLocator = page.getByTestId(arg);
        } else {
          // Fallback: treat as CSS selector
          healedLocator = page.locator(suggestion.selector);
        }

        if (!healedLocator) continue;

        // Validate: does this locator resolve to at least one element?
        const count = await healedLocator.count();
        if (count === 0) {
          console.log(
            `[AI-HEAL] Suggestion resolved to 0 elements: ${suggestion.selector}`
          );
          continue;
        }

        // 4. Retry the original action with the healed locator
        const actionResult = await healedLocator[action](...actionArgs);

        // 5. Log success
        const duration = Date.now() - startTime;
        appendHealingEvent({
          testTitle: 'runtime-healing',
          originalSelector: failedSelector,
          healedSelector: `${suggestion.type}(${suggestion.selector})`,
          confidence: suggestion.confidence,
          explanation: suggestion.explanation,
          analysis: gptResponse.analysis,
          applied: true,
          durationMs: duration,
        });

        return {
          healed: true,
          healedSelector: `${suggestion.type}(${suggestion.selector})`,
          confidence: suggestion.confidence,
          actionResult,
        };
      } catch (retryError) {
        console.log(
          `[AI-HEAL] Suggestion failed: ${suggestion.selector} → ${retryError.message}`
        );
        continue;
      }
    }

    // All suggestions failed
    const duration = Date.now() - startTime;
    appendHealingEvent({
      testTitle: 'runtime-healing',
      originalSelector: failedSelector,
      healedSelector: null,
      confidence: 0,
      explanation: 'All AI suggestions failed validation or action retry',
      analysis: gptResponse.analysis || 'N/A',
      applied: false,
      durationMs: duration,
    });

    return { healed: false };
  }

  /**
   * Parse a getByRole expression like: getByRole('button', { name: /submit/i })
   * Returns { role: 'button', options: { name: /submit/i } } or null.
   */
  _parseGetByArgs(selectorStr) {
    try {
      // Extract role and options from the string
      const match = selectorStr.match(/getByRole\s*\(\s*'([^']+)'(?:\s*,\s*(\{[^}]+\}))?\s*\)/);
      if (!match) {
        // Maybe it's just the arguments: 'button', { name: /submit/i }
        const simpleMatch = selectorStr.match(/'([^']+)'(?:\s*,\s*(\{.+\}))?/);
        if (simpleMatch) {
          const role = simpleMatch[1];
          const optsStr = simpleMatch[2];
          if (optsStr) {
            // Parse the options — handle regex patterns
            const nameMatch = optsStr.match(/name\s*:\s*(?:\/(.+?)\/([gimsuy]*)|'([^']+)'|"([^"]+)")/);
            if (nameMatch) {
              const name = nameMatch[1]
                ? new RegExp(nameMatch[1], nameMatch[2] || '')
                : nameMatch[3] || nameMatch[4];
              return { role, options: { name } };
            }
            return { role, options: {} };
          }
          return { role, options: {} };
        }
        return null;
      }
      const role = match[1];
      const optsStr = match[2];
      if (optsStr) {
        const nameMatch = optsStr.match(/name\s*:\s*(?:\/(.+?)\/([gimsuy]*)|'([^']+)'|"([^"]+)")/);
        if (nameMatch) {
          const name = nameMatch[1]
            ? new RegExp(nameMatch[1], nameMatch[2] || '')
            : nameMatch[3] || nameMatch[4];
          return { role, options: { name } };
        }
        return { role, options: {} };
      }
      return { role, options: {} };
    } catch {
      return null;
    }
  }

  /**
   * Extract a string or regex argument from expressions like getByText('hello') or getByText(/hello/i)
   */
  _extractStringArg(selectorStr) {
    // Try regex pattern first
    const regexMatch = selectorStr.match(/\/(.+?)\/([gimsuy]*)/);
    if (regexMatch) {
      return new RegExp(regexMatch[1], regexMatch[2] || '');
    }
    // Try quoted string
    const strMatch = selectorStr.match(/['"]([^'"]+)['"]/);
    if (strMatch) return strMatch[1];
    // Return as-is if it's just a plain string
    return selectorStr.trim() || null;
  }
}

module.exports = { LocatorHealerAgent };
