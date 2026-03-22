/**
 * Graph Nodes: thin wrapper functions that call existing agents
 * and return state updates for the LangGraph workflow.
 *
 * Each node receives the current graph state and returns a partial
 * state update (only the fields that changed).
 */

const { FailureAnalyzerAgent } = require('../agents/failure-analyzer.agent');
const { TestCaseHealerAgent } = require('../agents/test-case-healer.agent');
const { LocatorHealerAgent } = require('../agents/locator-healer.agent');
const { writeReport } = require('../storage/report-writer');

/**
 * Create node functions bound to a specific AI config.
 * @param {object} config - AI config from ai.config.js
 */
function createNodes(config) {
  const failureAnalyzer = new FailureAnalyzerAgent(config);
  const testCaseHealer = new TestCaseHealerAgent(config);
  const locatorHealer = new LocatorHealerAgent(config);

  return {
    /**
     * Node: Classify the failure using FailureAnalyzerAgent.
     * Sets failureCategory and failureAnalysis in state.
     */
    async classifyFailure(state) {
      console.log('[GRAPH] Classifying failure...');
      try {
        const report = await failureAnalyzer.analyze({
          testFile: state.testFile,
          testTitle: state.testTitle,
          errorMessage: state.errorMessage,
          errorStack: state.errorStack,
          steps: state.steps,
          screenshotPath: state.screenshotPath,
        });

        // Save the failure report
        const safeName = state.testTitle.replace(/[^a-zA-Z0-9]/g, '-').substring(0, 80);
        const filename = `failure-${safeName}-${Date.now()}.json`;
        const filePath = writeReport('failure-reports', filename, report);

        console.log(`[GRAPH] Failure classified: ${report.category} (confidence: ${report.confidence})`);

        return {
          failureCategory: report.category || 'unknown',
          failureAnalysis: report,
          confidence: report.confidence || 0,
          reports: [{ type: 'failure-analysis', path: filePath, data: report }],
        };
      } catch (err) {
        console.log(`[GRAPH] Classification failed: ${err.message}`);
        return {
          failureCategory: 'unknown',
          failureAnalysis: null,
          reports: [{ type: 'failure-analysis', error: err.message }],
        };
      }
    },

    /**
     * Node: Attempt test case healing using TestCaseHealerAgent.
     * This runs when the failure is an assertion/logic issue, not a locator issue.
     */
    async healTestCase(state) {
      console.log('[GRAPH] Attempting test case healing...');
      try {
        const result = await testCaseHealer.analyze({
          testFile: state.testFile,
          testTitle: state.testTitle,
          errorMessage: state.errorMessage,
          errorStack: state.errorStack,
        });

        let filePath = null;
        if (result.suggestedChanges && result.suggestedChanges.length > 0) {
          const safeName = state.testTitle.replace(/[^a-zA-Z0-9]/g, '-').substring(0, 80);
          const filename = `heal-${safeName}-${Date.now()}.json`;
          filePath = writeReport('test-healing', filename, result);
          console.log(`[GRAPH] Test healing suggestions saved (confidence: ${result.confidence})`);
        } else {
          console.log('[GRAPH] No test case fixes suggested');
        }

        return {
          healingAttempted: true,
          testCaseHealResult: result,
          reports: [{ type: 'test-healing', path: filePath, data: result }],
        };
      } catch (err) {
        console.log(`[GRAPH] Test case healing failed: ${err.message}`);
        return {
          healingAttempted: true,
          testCaseHealResult: null,
          reports: [{ type: 'test-healing', error: err.message }],
        };
      }
    },

    /**
     * Node: Report-only — for failures that can't be healed (network errors, infra issues).
     */
    async reportOnly(state) {
      console.log(`[GRAPH] Skipping healing — category "${state.failureCategory}" is not healable`);
      return {
        decision: `skipped_healing:${state.failureCategory}`,
        healingAttempted: false,
      };
    },

    /**
     * Node: Final summary — logs the outcome of the graph execution.
     */
    async summarize(state) {
      const reportCount = state.reports.length;
      const healed = state.healingAttempted && (state.testCaseHealResult?.suggestedChanges?.length > 0);
      console.log(`[GRAPH] Done. ${reportCount} report(s) generated. Healing suggested: ${healed}`);
      return {
        decision: healed ? 'healing_suggested' : state.decision || 'analyzed_only',
      };
    },

    // --- Runtime healing nodes (for locator-proxy integration) ---

    /**
     * Node: Attempt locator healing with the current strategy.
     */
    async tryHealLocator(state) {
      const attempt = state.attemptCount + 1;
      console.log(`[GRAPH] Locator heal attempt ${attempt}/${state.maxAttempts} (strategy: ${state.currentStrategy})`);

      try {
        const result = await locatorHealer.heal({
          page: state.page,
          failedSelector: state.failedSelector,
          error: { name: state.errorName, message: state.errorMessage },
          action: state.action,
          actionArgs: state.actionArgs,
          strategyHint: state.currentStrategy,
        });

        return {
          attemptCount: attempt,
          attempts: [{
            strategy: state.currentStrategy,
            success: result.healed,
            selector: result.healedSelector,
            confidence: result.confidence,
          }],
          healed: result.healed,
          healedSelector: result.healed ? result.healedSelector : null,
          confidence: result.confidence || 0,
        };
      } catch (err) {
        console.log(`[GRAPH] Heal attempt failed: ${err.message}`);
        return {
          attemptCount: attempt,
          attempts: [{
            strategy: state.currentStrategy,
            success: false,
            error: err.message,
          }],
        };
      }
    },

    /**
     * Node: Advance to the next healing strategy.
     */
    async nextStrategy(state) {
      const strategies = ['css', 'role', 'text'];
      const currentIdx = strategies.indexOf(state.currentStrategy);
      const nextIdx = currentIdx + 1;

      if (nextIdx < strategies.length) {
        console.log(`[GRAPH] Switching to strategy: ${strategies[nextIdx]}`);
        return { currentStrategy: strategies[nextIdx] };
      }

      console.log('[GRAPH] All strategies exhausted');
      return { currentStrategy: 'exhausted' };
    },
  };
}

module.exports = { createNodes };
