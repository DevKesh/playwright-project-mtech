/**
 * Audit Report Generator: produces comprehensive audit reports
 * combining traceability matrix, healing provenance chains, and metrics.
 */

const path = require('path');
const { AuditTrail } = require('./audit-trail');
const { TraceabilityMatrix } = require('./traceability-matrix');
const { MetricsEngine } = require('../metrics/metrics-engine');
const { loadHealingLog, loadRunHistory } = require('../storage/healing-history');
const { readLatencyLog } = require('../metrics/latency-tracker');
const { writeReport } = require('../storage/report-writer');

class AuditReportGenerator {
  constructor() {
    this.auditTrail = new AuditTrail();
    this.traceabilityMatrix = new TraceabilityMatrix();
    this.metricsEngine = new MetricsEngine();
  }

  /**
   * Generate a full audit report for a test run.
   * @param {object} options
   * @param {string} [options.runId] - Specific run ID (uses latest if not provided)
   * @param {string[]} [options.testSpecPaths] - Paths to test spec files
   * @returns {object} Complete audit report
   */
  async generateRunReport(options = {}) {
    // Determine run ID
    let runId = options.runId;
    let runEvents = [];

    if (runId) {
      runEvents = this.auditTrail.getRunEvents(runId);
    } else {
      const latest = this.auditTrail.getLatestRun();
      if (latest) {
        runId = latest.runId;
        runEvents = latest.events;
      }
    }

    // Load data
    const healingLog = loadHealingLog();
    const runHistory = loadRunHistory();
    const latencyLog = readLatencyLog();

    // Build traceability matrix
    const testSpecPaths = options.testSpecPaths || this._discoverTestSpecs();
    let matrix = this.traceabilityMatrix.buildFromTestSpecs(testSpecPaths);
    matrix = this.traceabilityMatrix.enrichWithOutcomes(matrix, runHistory);
    matrix = this.traceabilityMatrix.enrichWithHealingData(matrix, healingLog);
    const traceabilityReport = this.traceabilityMatrix.generateReport(matrix);

    // Compute metrics
    const metrics = this.metricsEngine.computeAll(healingLog, runHistory, latencyLog);

    // Build healing provenance chains from audit events
    const healingEvents = runEvents.filter(
      e => e.type === 'healing_attempted' || e.type === 'healing_succeeded' || e.type === 'healing_failed'
    );
    const provenanceChains = healingEvents.map(event => ({
      event,
      provenance: this.auditTrail.getProvenance(event.auditId),
    }));

    // Assemble full report
    const report = {
      runId: runId || 'no-run-data',
      generatedAt: new Date().toISOString(),
      auditSummary: {
        totalAuditEvents: runEvents.length,
        eventTypes: this._countByField(runEvents, 'type'),
        failureCorrelations: [...new Set(runEvents.filter(e => e.correlationId).map(e => e.correlationId))].length,
      },
      traceability: traceabilityReport,
      metrics: {
        passAt1: metrics.passAt1,
        selfHealingEfficacy: metrics.selfHealingEfficacy,
        latency: {
          mean: metrics.latency.mean,
          median: metrics.latency.median,
          p95: metrics.latency.p95,
          totalCalls: metrics.latency.totalCalls,
        },
      },
      healingProvenance: provenanceChains,
      auditEvents: runEvents,
    };

    // Save report
    const filename = `audit-report-${runId || 'latest'}-${Date.now()}.json`;
    const filePath = writeReport('audit-reports', filename, report);
    report._savedTo = filePath;

    return report;
  }

  /**
   * Auto-discover test spec files in the tests/ directory.
   * @returns {string[]}
   */
  _discoverTestSpecs() {
    const testsDir = path.resolve(process.cwd(), 'tests');
    return this._findFiles(testsDir, /\.spec\.js$/);
  }

  _findFiles(dir, pattern) {
    const results = [];
    try {
      const entries = require('fs').readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          results.push(...this._findFiles(fullPath, pattern));
        } else if (pattern.test(entry.name)) {
          results.push(fullPath);
        }
      }
    } catch {
      // Directory doesn't exist
    }
    return results;
  }

  _countByField(events, field) {
    const counts = {};
    for (const event of events) {
      const val = event[field] || 'unknown';
      counts[val] = (counts[val] || 0) + 1;
    }
    return counts;
  }
}

module.exports = { AuditReportGenerator };
