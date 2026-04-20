/**
 * Locator Proxy: wraps a Playwright Locator to intercept action failures
 * and delegate to the LangGraph runtime healing workflow for multi-strategy
 * self-healing.
 *
 * Uses JavaScript Proxy to transparently intercept calls like click(), fill(),
 * waitFor(), textContent(), etc. When an action throws (typically TimeoutError),
 * it invokes the RuntimeHealingGraph which tries multiple strategies
 * (CSS → role-based → text-based) before giving up.
 */

const { createRuntimeHealingGraph } = require('../graph/runtime-graph');
const { dismissPopups } = require('../../utils/popupInterceptor');

// Action methods that should trigger healing on failure
const HEALABLE_ACTIONS = new Set([
  'click',
  'dblclick',
  'fill',
  'type',
  'press',
  'check',
  'uncheck',
  'selectOption',
  'setInputFiles',
  'hover',
  'focus',
  'scrollIntoViewIfNeeded',
  'waitFor',
  'textContent',
  'innerText',
  'innerHTML',
  'inputValue',
  'getAttribute',
  'isVisible',
  'isEnabled',
  'isChecked',
  'isDisabled',
  'isEditable',
  'isHidden',
]);

// Methods that return new locators (need re-proxying)
const LOCATOR_RETURNING_METHODS = new Set([
  'first',
  'last',
  'nth',
  'filter',
  'locator',
  'getByRole',
  'getByText',
  'getByLabel',
  'getByPlaceholder',
  'getByAltText',
  'getByTitle',
  'getByTestId',
]);

// Cache the compiled graph per config to avoid recompiling for every locator
let _cachedGraph = null;
let _cachedConfigKey = null;

function getRuntimeGraph(config) {
  const configKey = `${config.healingModel}-${config.maxRetries}`;
  if (_cachedGraph && _cachedConfigKey === configKey) {
    return _cachedGraph;
  }
  _cachedGraph = createRuntimeHealingGraph(config);
  _cachedConfigKey = configKey;
  return _cachedGraph;
}

/**
 * Create a proxied locator that intercepts healable actions.
 * @param {import('@playwright/test').Locator} locator - The original Playwright locator.
 * @param {object} context - Healing context.
 * @param {import('@playwright/test').Page} context.page - The Playwright page.
 * @param {object} context.healerAgent - The LocatorHealer agent instance.
 * @param {object} context.config - AI config.
 * @param {string} context.selectorDescription - Human-readable description of the selector.
 * @returns {Proxy} Proxied locator.
 */
function createLocatorProxy(locator, context) {
  return new Proxy(locator, {
    get(target, prop, receiver) {
      const original = Reflect.get(target, prop, receiver);

      // For locator-returning methods, re-wrap the result
      if (LOCATOR_RETURNING_METHODS.has(prop) && typeof original === 'function') {
        return function (...args) {
          const newLocator = original.apply(target, args);
          const childDesc = `${context.selectorDescription}.${prop}(${args.map((a) => JSON.stringify(a)).join(', ')})`;
          return createLocatorProxy(newLocator, {
            ...context,
            selectorDescription: childDesc,
          });
        };
      }

      // For healable actions, wrap with try/catch + healing graph
      if (HEALABLE_ACTIONS.has(prop) && typeof original === 'function') {
        return async function (...args) {
          try {
            return await original.apply(target, args);
          } catch (error) {
            // Only attempt healing if the feature is enabled and agent is available
            if (!context.config.locatorHealing || !context.healerAgent) {
              throw error;
            }

            // Only heal timeout/locator errors (not assertion errors, etc.)
            const isHealable =
              error.name === 'TimeoutError' ||
              error.message?.includes('waiting for locator') ||
              error.message?.includes('resolved to') ||
              error.message?.includes('strict mode violation');

            if (!isHealable) {
              throw error;
            }

            // ── Step 1: Try dismissing a blocking popup first ──
            // If a popup is covering the element, dismissing it and retrying
            // is faster and more reliable than self-healing the selector.
            try {
              const dismissed = await dismissPopups(
                context.page,
                context.healerAgent?.aiClient,
                context.config
              );
              if (dismissed) {
                console.log(
                  `[AI-HEAL] Popup dismissed (${dismissed.method}: ${dismissed.selector}), retrying action...`
                );
                try {
                  return await original.apply(target, args);
                } catch {
                  // Popup was dismissed but action still fails — continue to healing
                }
              }
            } catch {
              // Popup check failed — continue to healing
            }

            // ── Step 2: Invoke the LangGraph healing workflow ──
            console.log(
              `[AI-HEAL] Locator failed: ${context.selectorDescription} → invoking healing graph...`
            );

            try {
              // Use the LangGraph runtime healing workflow
              const runtimeGraph = getRuntimeGraph(context.config);
              const graphResult = await runtimeGraph.invoke({
                page: context.page,
                failedSelector: context.selectorDescription,
                errorName: error.name,
                errorMessage: error.message,
                action: prop,
                actionArgs: args,
                maxAttempts: context.config.maxRetries || 3,
              });

              if (graphResult.healed && graphResult.healedSelector) {
                console.log(
                  `[AI-HEAL] Graph healed: "${context.selectorDescription}" → "${graphResult.healedSelector}" ` +
                    `(confidence: ${graphResult.confidence}, attempts: ${graphResult.attemptCount})`
                );
                // Retry the action with the healed locator
                const healedLocator = context.page.locator(graphResult.healedSelector);
                return await healedLocator[prop](...args);
              }

              console.log(
                `[AI-HEAL] Graph exhausted ${graphResult.attemptCount} attempts, healing failed`
              );
            } catch (healError) {
              console.log(
                `[AI-HEAL] Healing graph error for "${context.selectorDescription}": ${healError.message}`
              );
            }

            // If healing didn't work, throw the original error
            throw error;
          }
        };
      }

      // For everything else (properties, non-healable methods), pass through
      if (typeof original === 'function') {
        return original.bind(target);
      }
      return original;
    },
  });
}

module.exports = { createLocatorProxy };
