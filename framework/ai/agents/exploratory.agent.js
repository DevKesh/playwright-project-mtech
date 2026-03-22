/**
 * Exploratory Agent: the 6th agent in the multi-agentic framework.
 *
 * This agent autonomously explores a web application by:
 * 1. Extracting structured page elements (links, buttons, forms, headings)
 * 2. Classifying each page via GPT (login, dashboard, catalog, etc.)
 * 3. Generating Page Object classes matching the framework's existing pattern
 * 4. Generating test spec files matching the framework's existing pattern
 *
 * Unlike other agents that are reactive (triggered by failures), this agent
 * is proactive — it discovers and generates from scratch.
 */

const { createAIClient } = require('../core/ai-client-factory');
const { buildPageClassificationPrompt, buildAppAnalysisPrompt } = require('../prompts/exploration.prompt');
const { buildPageObjectGenPrompt } = require('../prompts/page-object-gen.prompt');
const { buildTestSpecGenPrompt } = require('../prompts/test-spec-gen.prompt');

class ExploratoryAgent {
  constructor(config) {
    this.config = config;
    this.aiClient = createAIClient(config);
  }

  /**
   * Extract structured page elements from the current page.
   * Unlike the healer agent's raw DOM extraction, this returns structured JSON
   * optimized for page classification and PO generation.
   *
   * @param {import('@playwright/test').Page} page
   * @returns {Promise<object>} Structured page elements.
   */
  async extractPageStructure(page) {
    const structure = await page.evaluate(() => {
      const result = {
        title: document.title || '',
        url: window.location.href,
        metaDescription: '',
        links: [],
        buttons: [],
        formFields: [],
        headings: [],
        images: [],
        navElements: [],
      };

      // Meta description
      const metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) result.metaDescription = metaDesc.getAttribute('content') || '';

      // Links
      const anchors = document.querySelectorAll('a[href]');
      const seenHrefs = new Set();
      anchors.forEach(a => {
        const href = a.href;
        const text = (a.textContent || '').trim().substring(0, 100);
        if (!text || seenHrefs.has(href)) return;
        seenHrefs.add(href);

        const isInNav = !!a.closest('nav, [role="navigation"], header, .navbar, .nav, .menu, .sidebar');
        result.links.push({
          href,
          text,
          isNavigation: isInNav,
          id: a.id || null,
          className: (a.className || '').split(' ').slice(0, 3).join(' ') || null,
        });
      });

      // Buttons
      const buttons = document.querySelectorAll('button, input[type="submit"], input[type="button"], [role="button"]');
      buttons.forEach(btn => {
        const text = (btn.textContent || btn.value || '').trim().substring(0, 100);
        if (!text) return;
        result.buttons.push({
          text,
          type: btn.type || btn.tagName.toLowerCase(),
          id: btn.id || null,
          className: (btn.className || '').split(' ').slice(0, 3).join(' ') || null,
          ariaLabel: btn.getAttribute('aria-label') || null,
        });
      });

      // Form fields
      const fields = document.querySelectorAll('input, select, textarea');
      fields.forEach(field => {
        const type = field.type || field.tagName.toLowerCase();
        if (['hidden', 'submit', 'button'].includes(type)) return;

        // Find associated label
        let label = '';
        if (field.id) {
          const labelEl = document.querySelector(`label[for="${field.id}"]`);
          if (labelEl) label = (labelEl.textContent || '').trim();
        }
        if (!label) {
          const parentLabel = field.closest('label');
          if (parentLabel) label = (parentLabel.textContent || '').trim();
        }

        result.formFields.push({
          tag: field.tagName.toLowerCase(),
          type,
          name: field.name || null,
          id: field.id || null,
          placeholder: field.placeholder || null,
          label: label.substring(0, 100) || null,
          ariaLabel: field.getAttribute('aria-label') || null,
          required: field.required || false,
          className: (field.className || '').split(' ').slice(0, 3).join(' ') || null,
        });
      });

      // Headings
      const headings = document.querySelectorAll('h1, h2, h3, h4');
      headings.forEach(h => {
        const text = (h.textContent || '').trim().substring(0, 200);
        if (text) {
          result.headings.push({
            level: parseInt(h.tagName.replace('H', '')),
            text,
            id: h.id || null,
          });
        }
      });

      // Images with alt text (for context)
      const imgs = document.querySelectorAll('img[alt]');
      imgs.forEach(img => {
        const alt = (img.alt || '').trim();
        if (alt) {
          result.images.push({ alt, src: img.src || '' });
        }
      });

      // Navigation elements
      const navs = document.querySelectorAll('nav, [role="navigation"]');
      navs.forEach(nav => {
        const links = Array.from(nav.querySelectorAll('a')).map(a => ({
          text: (a.textContent || '').trim().substring(0, 50),
          href: a.href,
        }));
        if (links.length > 0) {
          result.navElements.push({ links });
        }
      });

      return result;
    });

    return structure;
  }

  /**
   * Extract a trimmed DOM snapshot for locator accuracy during PO generation.
   * Similar to the healer agent's extraction but lighter.
   *
   * @param {import('@playwright/test').Page} page
   * @returns {Promise<string>}
   */
  async extractDOMSnapshot(page) {
    const dom = await page.evaluate(() => {
      function serialize(node, depth) {
        if (depth > 10) return '';
        if (node.nodeType === Node.TEXT_NODE) {
          const text = node.textContent.trim();
          return text ? text : '';
        }
        if (node.nodeType !== Node.ELEMENT_NODE) return '';

        const el = node;
        const tag = el.tagName.toLowerCase();
        if (['script', 'style', 'noscript', 'svg', 'path', 'meta', 'link'].includes(tag)) return '';

        const attrs = [];
        const keepAttrs = [
          'id', 'class', 'type', 'name', 'placeholder', 'value', 'href',
          'role', 'aria-label', 'data-testid', 'for', 'formcontrolname',
          'routerlink', 'title', 'alt',
        ];
        for (const attr of keepAttrs) {
          if (el.hasAttribute(attr)) {
            let val = el.getAttribute(attr);
            if (attr === 'class') val = val.split(' ').slice(0, 4).join(' ');
            attrs.push(`${attr}="${val}"`);
          }
        }
        const attrStr = attrs.length > 0 ? ' ' + attrs.join(' ') : '';

        const children = Array.from(el.childNodes)
          .map(child => serialize(child, depth + 1))
          .filter(Boolean)
          .join('');

        if (['input', 'img', 'br', 'hr'].includes(tag)) return `<${tag}${attrStr}/>`;
        if (!children && !attrStr && ['div', 'span'].includes(tag)) return '';

        return `<${tag}${attrStr}>${children}</${tag}>`;
      }
      return serialize(document.body, 0);
    });

    const maxLen = 40000;
    return dom.length > maxLen ? dom.substring(0, maxLen) + '\n<!-- DOM truncated -->' : dom;
  }

  /**
   * Classify a page using GPT.
   * @param {object} pageStructure - Structured elements from extractPageStructure.
   * @param {string} url - The page URL.
   * @returns {Promise<object>} Classification result.
   */
  async classifyPage(pageStructure, url) {
    const { systemPrompt, userPrompt } = buildPageClassificationPrompt({ url, pageStructure });
    return this.aiClient.chatCompletionJSON(systemPrompt, userPrompt, {
      model: this.config.analysisModel,
    });
  }

  /**
   * Analyze the entire app and identify user flows.
   * @param {Array} visitedPages - All visited page data.
   * @returns {Promise<object>} App analysis with flows.
   */
  async analyzeApp(visitedPages) {
    const { systemPrompt, userPrompt } = buildAppAnalysisPrompt({ visitedPages });
    return this.aiClient.chatCompletionJSON(systemPrompt, userPrompt, {
      model: this.config.analysisModel,
      maxTokens: 4096,
    });
  }

  /**
   * Generate a Page Object class from page data.
   * @param {object} pageData - Discovered page data.
   * @param {string} patternExample - Source code of existing PO as pattern.
   * @param {string} [domSnapshot] - Optional DOM snippet for accuracy.
   * @param {object} [testDataConfig] - Centralized test data config.
   * @returns {Promise<object>} Generated PO { className, fileName, code, locators, methods }.
   */
  async generatePageObjectCode(pageData, patternExample, domSnapshot, testDataConfig) {
    const { systemPrompt, userPrompt } = buildPageObjectGenPrompt({
      pageData,
      patternExample,
      domSnapshot,
      testDataConfig,
    });
    return this.aiClient.chatCompletionJSON(systemPrompt, userPrompt, {
      model: this.config.analysisModel,
      maxTokens: 4096,
    });
  }

  /**
   * Generate a test spec file from a user flow.
   * @param {object} flow - Identified user flow.
   * @param {Array} pageObjects - Generated PO metadata.
   * @param {string} patternExample - Source code of existing spec as pattern.
   * @param {string} appName - Application name.
   * @param {object} [testDataConfig] - Centralized test data config.
   * @returns {Promise<object>} Generated spec { fileName, code, testCases }.
   */
  async generateTestSpecCode(flow, pageObjects, patternExample, appName, testDataConfig) {
    const { systemPrompt, userPrompt } = buildTestSpecGenPrompt({
      flow,
      pageObjects,
      patternExample,
      appName,
      testDataConfig,
    });
    return this.aiClient.chatCompletionJSON(systemPrompt, userPrompt, {
      model: this.config.analysisModel,
      maxTokens: 4096,
    });
  }

  /**
   * Filter links to same-origin, non-static, unvisited URLs.
   * @param {Array} links - Array of { href, text } from page extraction.
   * @param {string} startOrigin - Origin of the start URL.
   * @param {Array} visitedUrls - Already visited URLs.
   * @returns {Array} Filtered link objects.
   */
  filterLinks(links, startOrigin, visitedUrls) {
    const visitedSet = new Set(visitedUrls);
    const staticExtensions = new Set([
      '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp',
      '.css', '.js', '.map', '.woff', '.woff2', '.ttf', '.eot',
      '.pdf', '.zip', '.tar', '.gz', '.mp4', '.mp3', '.avi',
    ]);

    return links.filter(link => {
      try {
        const url = new URL(link.href);

        // Same origin only
        if (url.origin !== startOrigin) return false;

        // Skip static assets
        const ext = url.pathname.substring(url.pathname.lastIndexOf('.')).toLowerCase();
        if (staticExtensions.has(ext)) return false;

        // Skip anchors, mailto, tel, javascript
        if (url.protocol === 'mailto:' || url.protocol === 'tel:' || url.protocol === 'javascript:') {
          return false;
        }

        // Skip already visited (normalize by removing trailing slash and hash)
        const normalized = url.origin + url.pathname.replace(/\/$/, '') + url.search;
        if (visitedSet.has(normalized) || visitedSet.has(link.href)) return false;

        return true;
      } catch {
        return false;
      }
    });
  }
}

module.exports = { ExploratoryAgent };
