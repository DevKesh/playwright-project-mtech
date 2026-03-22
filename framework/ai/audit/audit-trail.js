/**
 * Audit Trail: append-only event chain with correlation IDs for full provenance tracking.
 *
 * Every healing event, classification, and decision is recorded with a unique audit ID
 * and a correlation ID linking it back to the originating test run and failure.
 *
 * Event types:
 *   test_start, test_fail, failure_classified, healing_attempted,
 *   healing_succeeded, healing_failed, report_generated, run_complete,
 *   metric_computed, knowledge_base_updated
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const REPORTS_DIR = path.resolve(__dirname, '../../../ai-reports');
const AUDIT_LOG = path.join(REPORTS_DIR, 'audit-trail.json');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

class AuditTrail {
  constructor() {
    this.auditLogPath = AUDIT_LOG;
  }

  /**
   * Record an audit event.
   * @param {object} event
   * @param {string} event.type - Event type identifier
   * @param {string} [event.correlationId] - Links related events together
   * @param {string} [event.runId] - Test run identifier
   * @param {string} [event.testFile] - Test file path
   * @param {string} [event.testTitle] - Test title
   * @param {object} [event.data] - Event-specific payload
   * @param {string} [event.parentAuditId] - Links to the parent event in the chain
   * @returns {string} The auditId of the recorded event
   */
  record(event) {
    const auditEntry = {
      auditId: `aud-${crypto.randomUUID()}`,
      timestamp: new Date().toISOString(),
      type: event.type,
      correlationId: event.correlationId || null,
      runId: event.runId || null,
      testFile: event.testFile || null,
      testTitle: event.testTitle || null,
      data: event.data || {},
      parentAuditId: event.parentAuditId || null,
    };

    this._append(auditEntry);
    return auditEntry.auditId;
  }

  /**
   * Generate a failure correlation ID for linking healing events.
   * @param {string} runId - Test run identifier
   * @param {string} testTitle - Test title
   * @returns {string} Unique failure ID
   */
  generateFailureId(runId, testTitle) {
    const hash = testTitle.replace(/[^a-zA-Z0-9]/g, '').substring(0, 20);
    return `fail-${runId}-${hash}-${Date.now()}`;
  }

  /**
   * Generate a run ID for a test execution.
   * @returns {string}
   */
  generateRunId() {
    return `run-${Date.now()}`;
  }

  /**
   * Query the audit trail for all events matching a correlation ID.
   * @param {string} correlationId
   * @returns {Array<object>}
   */
  getChain(correlationId) {
    const allEvents = this._loadAll();
    return allEvents.filter(
      e => e.correlationId === correlationId || e.auditId === correlationId
    );
  }

  /**
   * Walk back through parent links to get the full provenance chain for an event.
   * @param {string} auditId
   * @returns {Array<object>} Events ordered from root to the given event
   */
  getProvenance(auditId) {
    const allEvents = this._loadAll();
    const chain = [];
    let current = allEvents.find(e => e.auditId === auditId);

    while (current) {
      chain.unshift(current);
      current = current.parentAuditId
        ? allEvents.find(e => e.auditId === current.parentAuditId)
        : null;
    }

    return chain;
  }

  /**
   * Get all events for a specific test run.
   * @param {string} runId
   * @returns {Array<object>}
   */
  getRunEvents(runId) {
    const allEvents = this._loadAll();
    return allEvents.filter(e => e.runId === runId);
  }

  /**
   * Get the most recent run's events.
   * @returns {{ runId: string, events: Array<object> } | null}
   */
  getLatestRun() {
    const allEvents = this._loadAll();
    const runIds = [...new Set(allEvents.filter(e => e.runId).map(e => e.runId))];

    if (runIds.length === 0) return null;

    // Sort by timestamp embedded in runId (run-{timestamp})
    runIds.sort((a, b) => {
      const tsA = parseInt(a.split('-').pop()) || 0;
      const tsB = parseInt(b.split('-').pop()) || 0;
      return tsB - tsA;
    });

    const latestRunId = runIds[0];
    return {
      runId: latestRunId,
      events: allEvents.filter(e => e.runId === latestRunId),
    };
  }

  /**
   * Load all audit events.
   * @returns {Array<object>}
   */
  _loadAll() {
    try {
      if (fs.existsSync(this.auditLogPath)) {
        return JSON.parse(fs.readFileSync(this.auditLogPath, 'utf-8'));
      }
    } catch {
      // Corrupted file
    }
    return [];
  }

  /**
   * Append an entry to the audit trail.
   * @param {object} entry
   */
  _append(entry) {
    ensureDir(path.dirname(this.auditLogPath));
    const log = this._loadAll();
    log.push(entry);
    fs.writeFileSync(this.auditLogPath, JSON.stringify(log, null, 2), 'utf-8');
  }
}

module.exports = { AuditTrail };
