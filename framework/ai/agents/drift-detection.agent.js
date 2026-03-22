/**
 * Drift Detection Agent: validates page object locators against the live DOM.
 *
 * Run as a standalone CLI tool to check if page objects have drifted from
 * the current state of the application.
 */

const fs = require('fs');
const { createAIClient } = require('../core/ai-client-factory');
const { buildDriftDetectionPrompt } = require('../prompts/drift-detection.prompt');

class DriftDetectionAgent {
  constructor(config) {
    this.config = config;
    this.aiClient = createAIClient(config);
  }

  /**
   * Extract a trimmed DOM snapshot focused on interactive elements.
   * @param {import('@playwright/test').Page} page
   * @returns {Promise<string>}
   */
  async extractDOMSnapshot(page) {
    const dom = await page.evaluate(() => {
      function serialize(node, depth) {
        if (depth > 15) return '';
        if (node.nodeType === Node.TEXT_NODE) {
          const text = node.textContent.trim();
          return text ? text : '';
        }
        if (node.nodeType !== Node.ELEMENT_NODE) return '';

        const el = node;
        const tag = el.tagName.toLowerCase();
        if (['script', 'style', 'noscript', 'svg', 'path', 'meta', 'link'].includes(tag)) {
          return '';
        }

        const attrs = [];
        const keepAttrs = [
          'id', 'class', 'type', 'name', 'placeholder', 'value', 'href',
          'role', 'aria-label', 'aria-labelledby', 'data-testid', 'for',
          'formcontrolname', 'routerlink', 'title', 'alt',
        ];
        for (const attr of keepAttrs) {
          if (el.hasAttribute(attr)) {
            let val = el.getAttribute(attr);
            if (attr === 'class') val = val.split(' ').slice(0, 5).join(' ');
            attrs.push(`${attr}="${val}"`);
          }
        }
        const attrStr = attrs.length > 0 ? ' ' + attrs.join(' ') : '';

        const children = Array.from(el.childNodes)
          .map((child) => serialize(child, depth + 1))
          .filter(Boolean)
          .join('');

        if (['input', 'img', 'br', 'hr'].includes(tag)) {
          return `<${tag}${attrStr}/>`;
        }
        if (!children && !attrStr && ['div', 'span'].includes(tag)) {
          return '';
        }
        return `<${tag}${attrStr}>${children}</${tag}>`;
      }
      return serialize(document.body, 0);
    });

    const maxLen = this.config.maxDomLength || 60000;
    if (dom.length > maxLen) {
      return dom.substring(0, maxLen) + '\n<!-- DOM truncated -->';
    }
    return dom;
  }

  /**
   * Detect drift between a page object file and the live page.
   * @param {import('@playwright/test').Page} page - A Playwright page navigated to the target URL.
   * @param {string} pageObjectFilePath - Absolute path to the page object .js file.
   * @returns {Promise<object>} Drift detection report.
   */
  async detectDrift(page, pageObjectFilePath) {
    const pageObjectSource = fs.readFileSync(pageObjectFilePath, 'utf-8');
    const domSnapshot = await this.extractDOMSnapshot(page);
    const pageUrl = page.url();

    const { systemPrompt, userPrompt } = buildDriftDetectionPrompt({
      pageObjectSource,
      pageObjectFile: pageObjectFilePath,
      domSnapshot,
      pageUrl,
    });

    const report = await this.aiClient.chatCompletionJSON(systemPrompt, userPrompt, {
      model: this.config.analysisModel,
    });

    return {
      timestamp: new Date().toISOString(),
      pageObjectFile: pageObjectFilePath,
      currentUrl: pageUrl,
      ...report,
    };
  }
}

module.exports = { DriftDetectionAgent };
