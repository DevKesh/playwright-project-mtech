/**
 * Page Proxy: wraps a Playwright Page object to intercept all locator-creating
 * methods and return AI-healing-capable proxied locators.
 *
 * This is the main integration point. By wrapping `page` at the fixture level,
 * ALL downstream code (page objects, flows, test specs) automatically gains
 * self-healing capabilities with zero code changes.
 */

const { createLocatorProxy } = require('./locator-proxy');

// Methods on page that create locators
const LOCATOR_CREATORS = new Set([
  'locator',
  'getByRole',
  'getByText',
  'getByLabel',
  'getByPlaceholder',
  'getByAltText',
  'getByTitle',
  'getByTestId',
]);

/**
 * Create a proxied page that wraps all locator-creating methods.
 * @param {import('@playwright/test').Page} page - The original Playwright page.
 * @param {object} options
 * @param {object} options.healerAgent - The LocatorHealer agent instance.
 * @param {object} options.config - AI config object.
 * @returns {Proxy} Proxied page.
 */
function createPageProxy(page, { healerAgent, config }) {
  return new Proxy(page, {
    get(target, prop, receiver) {
      const original = Reflect.get(target, prop, receiver);

      // Intercept locator-creating methods
      if (LOCATOR_CREATORS.has(prop) && typeof original === 'function') {
        return function (...args) {
          const locator = original.apply(target, args);

          // Build a human-readable description of the selector
          const selectorDescription = `page.${prop}(${args.map((a) => JSON.stringify(a)).join(', ')})`;

          return createLocatorProxy(locator, {
            page: target, // Pass the raw page (not proxy) to avoid infinite loops
            healerAgent,
            config,
            selectorDescription,
          });
        };
      }

      // For everything else, pass through
      if (typeof original === 'function') {
        return original.bind(target);
      }
      return original;
    },
  });
}

module.exports = { createPageProxy };
