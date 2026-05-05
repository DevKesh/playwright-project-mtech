/**
 * Locator Healing Patch: monkey-patches Playwright Locator action methods
 * to intercept failures and delegate to the LangGraph runtime healing workflow.
 *
 * By patching methods directly (instead of Proxy wrapping), the locator remains
 * a genuine Playwright Locator instance — so expect(locator).toBeVisible() and
 * other Playwright matchers work without issues.
 *
 * When an action throws (typically TimeoutError), it invokes the
 * RuntimeHealingGraph which tries multiple strategies (CSS → role → text)
 * before giving up.
 */

const { createRuntimeHealingGraph } = require('../graph/runtime-graph');
const { dismissPopups } = require('../../utils/popupInterceptor');

// When healing is active, use a short timeout for the initial action attempt so
// it fails quickly (instead of eating the entire 30 s test timeout) and leaves
// time for the healing graph to extract DOM, call GPT, and retry.
const HEAL_QUICK_TIMEOUT_MS = 7000;

// Auto-waiting actions that accept a `timeout` option — instant checks like
// isVisible/isEnabled do NOT accept timeout and must be excluded.
const TIMEOUT_INJECTABLE_ACTIONS = new Set([
  'click', 'dblclick', 'fill', 'type', 'press', 'check', 'uncheck',
  'selectOption', 'setInputFiles', 'hover', 'focus',
  'scrollIntoViewIfNeeded', 'waitFor',
  'textContent', 'innerText', 'innerHTML', 'inputValue', 'getAttribute',
]);

// Methods where the first positional arg is a value and options come second
const VALUE_FIRST_METHODS = new Set([
  'fill', 'type', 'press', 'selectOption', 'setInputFiles', 'getAttribute',
]);

/**
 * Inject a shorter `timeout` into the action's options argument so Playwright
 * throws early, giving the healing graph enough remaining test time to work.
 */
function injectQuickTimeout(action, args) {
  if (!TIMEOUT_INJECTABLE_ACTIONS.has(action)) return args;

  const optIdx = VALUE_FIRST_METHODS.has(action) ? 1 : 0;
  const newArgs = [...args];
  const existing = newArgs[optIdx];

  if (existing && typeof existing === 'object') {
    // Don't override an explicitly-set timeout
    if (!('timeout' in existing)) {
      newArgs[optIdx] = { ...existing, timeout: HEAL_QUICK_TIMEOUT_MS };
    }
  } else if (existing === undefined) {
    newArgs[optIdx] = { timeout: HEAL_QUICK_TIMEOUT_MS };
  }
  // If the arg at optIdx is a non-object primitive (edge case), leave it alone
  return newArgs;
}

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
 * Patch a locator's healable action methods in-place so that failures trigger
 * the LangGraph healing workflow.
 *
 * Unlike Proxy wrapping, this keeps the locator as a genuine Playwright Locator
 * instance, so expect(locator).toBeVisible() and other matchers work normally.
 *
 * @param {import('@playwright/test').Locator} locator - The original Playwright locator.
 * @param {object} context - Healing context.
 * @param {import('@playwright/test').Page} context.page - The Playwright page.
 * @param {object} context.healerAgent - The LocatorHealer agent instance.
 * @param {object} context.config - AI config.
 * @param {string} context.selectorDescription - Human-readable description of the selector.
 * @returns {import('@playwright/test').Locator} The same locator, with patched methods.
 */
function createLocatorProxy(locator, context) {
  // Patch locator-returning methods so the child locators are also patched
  for (const method of LOCATOR_RETURNING_METHODS) {
    const original = locator[method];
    if (typeof original !== 'function') continue;
    locator[method] = function (...args) {
      const newLocator = original.apply(locator, args);
      const childDesc = `${context.selectorDescription}.${method}(${args.map(a => JSON.stringify(a)).join(', ')})`;
      return createLocatorProxy(newLocator, { ...context, selectorDescription: childDesc });
    };
  }

  // Patch healable action methods with try/catch + healing
  for (const action of HEALABLE_ACTIONS) {
    const original = locator[action];
    if (typeof original !== 'function') continue;
    locator[action] = async function (...args) {
      try {
        const quickArgs = injectQuickTimeout(action, args);
        return await original.apply(locator, quickArgs);
      } catch (error) {
        console.log(`[AI-HEAL-DEBUG] Action "${action}" failed on "${context.selectorDescription}": ${error.name} — ${error.message?.substring(0, 120)}`);

        if (!context.config.locatorHealing || !context.healerAgent) {
          throw error;
        }

        const isHealable =
          error.name === 'TimeoutError' ||
          error.message?.includes('waiting for locator') ||
          error.message?.includes('resolved to') ||
          error.message?.includes('strict mode violation');

        if (!isHealable) {
          throw error;
        }

        // Prevent recursive healing
        if (context.page._healingInProgress) {
          throw error;
        }
        context.page._healingInProgress = true;

        try {
          // Step 1: Try dismissing a blocking popup
          try {
            const dismissed = await dismissPopups(
              context.page,
              context.healerAgent?.aiClient,
              context.config
            );
            if (dismissed) {
              console.log(`[AI-HEAL] Popup dismissed (${dismissed.method}: ${dismissed.selector}), retrying action...`);
              try {
                const retryArgs = injectQuickTimeout(action, args);
                return await original.apply(locator, retryArgs);
              } catch {
                // Popup dismissed but still fails — continue to healing
              }
            }
          } catch { /* popup check failed */ }

          // Step 2: Invoke the LangGraph healing workflow
          console.log(`[AI-HEAL] Locator failed: ${context.selectorDescription} → invoking healing graph...`);

          try {
            const runtimeGraph = getRuntimeGraph(context.config);
            const graphResult = await runtimeGraph.invoke({
              page: context.page,
              failedSelector: context.selectorDescription,
              errorName: error.name,
              errorMessage: error.message,
              action,
              actionArgs: args,
              maxAttempts: context.config.maxRetries || 3,
            });

            if (graphResult.healed && graphResult.healedSelector) {
              console.log(
                `[AI-HEAL] Graph healed: "${context.selectorDescription}" → "${graphResult.healedSelector}" ` +
                `(confidence: ${graphResult.confidence}, attempts: ${graphResult.attemptCount})`
              );
              // The healer agent already performed the action during validation
              return;
            }

            console.log(`[AI-HEAL] Graph exhausted ${graphResult.attemptCount} attempts, healing failed`);
          } catch (healError) {
            console.log(`[AI-HEAL] Healing graph error for "${context.selectorDescription}": ${healError.message}`);
          }

          throw error;
        } finally {
          context.page._healingInProgress = false;
        }
      }
    };
  }

  return locator;
}

module.exports = { createLocatorProxy };
