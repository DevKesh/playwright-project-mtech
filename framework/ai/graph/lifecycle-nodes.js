/**
 * Lifecycle Nodes: functions for each phase of the 6-phase QA lifecycle.
 *
 * Phase 1 (Discovery): Scan codebase, discover page objects, tests, flows
 * Phase 2 (Strategy): AI risk analysis, prioritize drift candidates
 * Phase 3 (Pre-Execution): Run drift detection on high-risk page objects
 * Phase 4 & 5 are external (playwright test + existing healing graphs)
 * Phase 6 (Synthesis): Aggregate metrics, update RAG index, generate report
 */

const fs = require('fs');
const path = require('path');
const { createAIClient } = require('../core/ai-client-factory');
const { buildRiskAnalysisPrompt } = require('../prompts/risk-analysis.prompt');
const { loadHealingLog, loadRunHistory } = require('../storage/healing-history');
const { MetricsEngine } = require('../metrics/metrics-engine');
const { readLatencyLog } = require('../metrics/latency-tracker');
const { writeReport } = require('../storage/report-writer');

/**
 * Recursively find files matching a pattern.
 */
function findFiles(dir, pattern) {
  const results = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...findFiles(fullPath, pattern));
      } else if (pattern.test(entry.name)) {
        results.push(fullPath);
      }
    }
  } catch {
    // Directory doesn't exist
  }
  return results;
}

/**
 * Count locator-like patterns in a page object source.
 */
function countLocators(source) {
  const patterns = [
    /page\.locator\(/g,
    /page\.getByRole\(/g,
    /page\.getByText\(/g,
    /page\.getByLabel\(/g,
    /page\.getByPlaceholder\(/g,
    /page\.getByTestId\(/g,
  ];
  let count = 0;
  for (const p of patterns) {
    const matches = source.match(p);
    if (matches) count += matches.length;
  }
  return count;
}

/**
 * Create lifecycle node functions.
 * @param {object} config - AI config
 */
function createLifecycleNodes(config) {
  const projectRoot = path.resolve(__dirname, '../../..');
  const aiClient = createAIClient(config);

  return {
    /**
     * Phase 1: Discovery — scan the codebase and catalog all components.
     */
    async discovery(state) {
      console.log('[LIFECYCLE] Phase 1: Discovery — scanning codebase...');
      try {
        // Discover page objects
        const pageObjectPaths = findFiles(path.join(projectRoot, 'framework/pages'), /\.js$/);
        const pageObjects = pageObjectPaths.map(filePath => {
          const source = fs.readFileSync(filePath, 'utf-8');
          return {
            file: path.relative(projectRoot, filePath),
            fullPath: filePath,
            locatorCount: countLocators(source),
            lineCount: source.split('\n').length,
          };
        });

        // Discover test specs
        const testSpecPaths = findFiles(path.join(projectRoot, 'tests'), /\.spec\.js$/);
        const testSpecs = testSpecPaths.map(filePath => ({
          file: path.relative(projectRoot, filePath),
          fullPath: filePath,
        }));

        // Discover flow files
        const flowPaths = findFiles(path.join(projectRoot, 'framework/flows'), /\.js$/);
        const flowFiles = flowPaths.map(filePath => ({
          file: path.relative(projectRoot, filePath),
          fullPath: filePath,
        }));

        // Build coverage map: which tests import which page objects/flows
        const coverageMap = {};
        for (const po of pageObjects) {
          coverageMap[po.file] = [];
        }

        for (const spec of testSpecs) {
          try {
            const source = fs.readFileSync(spec.fullPath, 'utf-8');
            for (const po of pageObjects) {
              const baseName = path.basename(po.file, '.js');
              if (source.includes(baseName)) {
                coverageMap[po.file].push(spec.file);
              }
            }
          } catch {
            // Skip unreadable
          }
        }

        console.log(`[LIFECYCLE] Found ${pageObjects.length} page objects, ${testSpecs.length} tests, ${flowFiles.length} flows`);

        return {
          pageObjects,
          testSpecs,
          flowFiles,
          coverageMap,
          currentPhase: 'strategy',
        };
      } catch (err) {
        console.log(`[LIFECYCLE] Discovery failed: ${err.message}`);
        return {
          errors: [{ phase: 'discovery', error: err.message }],
          currentPhase: 'strategy',
        };
      }
    },

    /**
     * Phase 2: Strategy — AI risk analysis to prioritize drift checking.
     */
    async strategy(state) {
      console.log('[LIFECYCLE] Phase 2: Strategy — analyzing risk...');
      try {
        const healingHistory = loadHealingLog();
        const runHistory = loadRunHistory();

        const { systemPrompt, userPrompt } = buildRiskAnalysisPrompt({
          pageObjects: state.pageObjects || [],
          healingHistory: healingHistory.slice(-20),
          runHistory: runHistory.slice(-5),
          coverageMap: state.coverageMap || {},
        });

        const report = await aiClient.chatCompletionJSON(systemPrompt, userPrompt, {
          model: config.analysisModel,
        });

        const riskAssessment = report.riskAssessment || [];
        const driftCandidates = report.driftCandidates || [];
        const prioritizedActions = report.prioritizedActions || [];

        // Save strategy report
        writeReport('lifecycle', `strategy-${Date.now()}.json`, report);

        console.log(`[LIFECYCLE] Risk assessment: ${riskAssessment.length} page objects scored, ${driftCandidates.length} drift candidates`);

        return {
          riskAssessment,
          driftCandidates,
          prioritizedActions,
          currentPhase: 'preExecution',
        };
      } catch (err) {
        console.log(`[LIFECYCLE] Strategy analysis failed: ${err.message}`);
        return {
          riskAssessment: [],
          driftCandidates: state.pageObjects.map(po => po.file),
          prioritizedActions: [],
          errors: [{ phase: 'strategy', error: err.message }],
          currentPhase: 'preExecution',
        };
      }
    },

    /**
     * Phase 3: Pre-Execution — run drift detection on candidates (without browser).
     * Note: Full drift detection requires a browser. In lifecycle mode, we do a
     * static analysis of page object locators against known patterns.
     */
    async preExecution(state) {
      console.log('[LIFECYCLE] Phase 3: Pre-Execution — checking drift candidates...');
      try {
        const reports = [];
        const candidates = state.driftCandidates || [];

        for (const candidate of candidates.slice(0, 3)) { // Limit to top 3
          // Find the page object
          const po = (state.pageObjects || []).find(p => p.file === candidate);
          if (!po || !po.fullPath) continue;

          try {
            const source = fs.readFileSync(po.fullPath, 'utf-8');
            reports.push({
              type: 'pre-execution-check',
              pageObject: candidate,
              locatorCount: countLocators(source),
              status: 'checked',
              timestamp: new Date().toISOString(),
            });
          } catch {
            reports.push({
              type: 'pre-execution-check',
              pageObject: candidate,
              status: 'unreadable',
            });
          }
        }

        // Save pre-execution report
        writeReport('lifecycle', `pre-execution-${Date.now()}.json`, {
          driftCandidatesChecked: reports.length,
          reports,
        });

        console.log(`[LIFECYCLE] Pre-execution: checked ${reports.length} drift candidates`);

        return {
          driftReports: reports,
          preExecutionComplete: true,
          currentPhase: 'checkpoint',
        };
      } catch (err) {
        console.log(`[LIFECYCLE] Pre-execution failed: ${err.message}`);
        return {
          preExecutionComplete: true,
          errors: [{ phase: 'preExecution', error: err.message }],
          currentPhase: 'checkpoint',
        };
      }
    },

    /**
     * Checkpoint: boundary between pre-test and post-test phases.
     */
    async checkpoint(state) {
      console.log('[LIFECYCLE] Checkpoint — saving pre-execution state...');

      const checkpoint = {
        timestamp: new Date().toISOString(),
        pageObjects: (state.pageObjects || []).length,
        testSpecs: (state.testSpecs || []).length,
        driftCandidates: (state.driftCandidates || []).length,
        preExecutionComplete: state.preExecutionComplete,
        errors: state.errors || [],
      };

      writeReport('lifecycle', `checkpoint-${Date.now()}.json`, checkpoint);

      return { currentPhase: 'synthesis' };
    },

    /**
     * Phase 6: Synthesis — aggregate metrics, update knowledge base, generate report.
     */
    async synthesis(state) {
      console.log('[LIFECYCLE] Phase 6: Synthesis — aggregating results...');
      try {
        // Load all data from storage
        const healingLog = loadHealingLog();
        const runHistory = loadRunHistory();
        const latencyLog = readLatencyLog();

        // Compute metrics
        const metricsEngine = new MetricsEngine();
        const metrics = metricsEngine.computeAll(healingLog, runHistory, latencyLog);

        // Try to update RAG knowledge base if available
        let knowledgeBaseUpdated = false;
        if (config.ragEnabled) {
          try {
            const { ChromaStore } = require('../rag/chroma-client');
            const { EmbeddingService } = require('../rag/embedding-service');
            const { RAGIndexer } = require('../rag/rag-indexer');

            const chromaStore = new ChromaStore(config);
            await chromaStore.initialize();
            const embeddingService = new EmbeddingService(config);
            const indexer = new RAGIndexer(chromaStore, embeddingService);

            // Index recent healing events
            if (healingLog.length > 0) {
              await indexer.indexHealingEvents(healingLog.slice(-20));
              knowledgeBaseUpdated = true;
            }

            console.log('[LIFECYCLE] Knowledge base updated with recent events');
          } catch (ragErr) {
            console.log(`[LIFECYCLE] RAG update skipped: ${ragErr.message}`);
          }
        }

        // Generate synthesis report
        const synthesisReport = {
          timestamp: new Date().toISOString(),
          metrics: {
            passAt1: metrics.passAt1,
            passAt3: metrics.passAt3,
            she: metrics.selfHealingEfficacy,
            latency: {
              mean: metrics.latency.mean,
              p95: metrics.latency.p95,
              totalCalls: metrics.latency.totalCalls,
            },
          },
          dataSources: {
            healingEvents: healingLog.length,
            testRuns: runHistory.length,
            aiCalls: latencyLog.length,
          },
          knowledgeBaseUpdated,
          errors: state.errors || [],
          phases: {
            discovery: (state.pageObjects || []).length > 0 ? 'complete' : 'skipped',
            strategy: (state.riskAssessment || []).length > 0 ? 'complete' : 'skipped',
            preExecution: state.preExecutionComplete ? 'complete' : 'skipped',
            synthesis: 'complete',
          },
        };

        // Save synthesis report
        const filePath = writeReport('lifecycle', `synthesis-${Date.now()}.json`, synthesisReport);
        console.log(`[LIFECYCLE] Synthesis complete. Report: ${filePath}`);

        return {
          metrics,
          knowledgeBaseUpdated,
          synthesisReport,
          healingLog,
          runHistory,
        };
      } catch (err) {
        console.log(`[LIFECYCLE] Synthesis failed: ${err.message}`);
        return {
          errors: [{ phase: 'synthesis', error: err.message }],
        };
      }
    },
  };
}

module.exports = { createLifecycleNodes };
