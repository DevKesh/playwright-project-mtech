/**
 * RAG Indexer: indexes structured data into vector collections.
 *
 * Collections:
 * - healing-events: Past locator healing attempts (success/failure)
 * - failure-reports: Post-mortem failure analysis reports
 * - page-objects: Page object source code
 * - test-specs: Test spec source code
 */

const fs = require('fs');
const path = require('path');

class RAGIndexer {
  constructor(chromaStore, embeddingService) {
    this.chromaStore = chromaStore;
    this.embeddingService = embeddingService;
  }

  /**
   * Index healing events from healing-log.json.
   * @param {Array} healingLog - Array of healing event objects
   * @returns {Promise<number>} Number of events indexed
   */
  async indexHealingEvents(healingLog) {
    if (!healingLog || healingLog.length === 0) return 0;

    const documents = [];
    const ids = [];
    const metadatas = [];

    for (let i = 0; i < healingLog.length; i++) {
      const event = healingLog[i];
      const doc = `Selector "${event.originalSelector}" failed in test "${event.testTitle}". ` +
        `${event.applied ? `Healed to "${event.healedSelector}" with confidence ${event.confidence}.` : 'Healing failed.'} ` +
        `Analysis: ${event.analysis || 'N/A'}. Duration: ${event.durationMs || 0}ms.`;

      documents.push(doc);
      ids.push(`heal-${event.timestamp || i}`);
      metadatas.push({
        type: 'healing-event',
        applied: event.applied ? 'true' : 'false',
        testTitle: event.testTitle || '',
        originalSelector: event.originalSelector || '',
        confidence: String(event.confidence || 0),
      });
    }

    const embeddings = await this.embeddingService.embedBatch(documents);
    await this.chromaStore.addDocuments('healing-events', {
      ids, documents, metadatas, embeddings,
    });

    return documents.length;
  }

  /**
   * Index failure reports from ai-reports/failure-reports/.
   * @param {Array} reports - Array of failure report objects
   * @returns {Promise<number>} Number of reports indexed
   */
  async indexFailureReports(reports) {
    if (!reports || reports.length === 0) return 0;

    const documents = [];
    const ids = [];
    const metadatas = [];

    for (let i = 0; i < reports.length; i++) {
      const report = reports[i];
      const doc = `Test "${report.testTitle}" failed with category "${report.category}". ` +
        `Root cause: ${report.rootCause || 'unknown'}. ` +
        `Explanation: ${report.explanation || 'N/A'}. ` +
        `Suggested fix: ${report.suggestedFix || 'N/A'}.`;

      documents.push(doc);
      ids.push(`failure-${report.timestamp || i}`);
      metadatas.push({
        type: 'failure-report',
        category: report.category || 'unknown',
        testFile: report.testFile || '',
        testTitle: report.testTitle || '',
        severity: report.severity || 'medium',
      });
    }

    const embeddings = await this.embeddingService.embedBatch(documents);
    await this.chromaStore.addDocuments('failure-reports', {
      ids, documents, metadatas, embeddings,
    });

    return documents.length;
  }

  /**
   * Index page object source files.
   * @param {string[]} pageObjectPaths - Absolute paths to page object files
   * @returns {Promise<number>} Number indexed
   */
  async indexPageObjects(pageObjectPaths) {
    if (!pageObjectPaths || pageObjectPaths.length === 0) return 0;

    const documents = [];
    const ids = [];
    const metadatas = [];

    for (const filePath of pageObjectPaths) {
      try {
        const source = fs.readFileSync(filePath, 'utf-8');
        // Truncate to keep embedding cost reasonable
        const doc = source.substring(0, 8000);
        documents.push(doc);
        ids.push(`po-${path.basename(filePath)}`);
        metadatas.push({
          type: 'page-object',
          file: path.relative(process.cwd(), filePath),
        });
      } catch {
        // Skip unreadable files
      }
    }

    if (documents.length === 0) return 0;

    const embeddings = await this.embeddingService.embedBatch(documents);
    await this.chromaStore.addDocuments('page-objects', {
      ids, documents, metadatas, embeddings,
    });

    return documents.length;
  }

  /**
   * Index test spec source files.
   * @param {string[]} testSpecPaths - Absolute paths to test spec files
   * @returns {Promise<number>} Number indexed
   */
  async indexTestSpecs(testSpecPaths) {
    if (!testSpecPaths || testSpecPaths.length === 0) return 0;

    const documents = [];
    const ids = [];
    const metadatas = [];

    for (const filePath of testSpecPaths) {
      try {
        const source = fs.readFileSync(filePath, 'utf-8');
        const doc = source.substring(0, 8000);
        documents.push(doc);
        ids.push(`spec-${path.basename(filePath)}`);
        metadatas.push({
          type: 'test-spec',
          file: path.relative(process.cwd(), filePath),
        });
      } catch {
        // Skip unreadable files
      }
    }

    if (documents.length === 0) return 0;

    const embeddings = await this.embeddingService.embedBatch(documents);
    await this.chromaStore.addDocuments('test-specs', {
      ids, documents, metadatas, embeddings,
    });

    return documents.length;
  }

  /**
   * Run a full index of all available data.
   * @param {object} params
   * @param {Array} params.healingLog
   * @param {Array} params.failureReports
   * @param {string[]} params.pageObjectPaths
   * @param {string[]} params.testSpecPaths
   * @returns {Promise<object>} Indexing summary
   */
  async indexAll({ healingLog, failureReports, pageObjectPaths, testSpecPaths }) {
    const results = {
      healingEvents: await this.indexHealingEvents(healingLog),
      failureReports: await this.indexFailureReports(failureReports),
      pageObjects: await this.indexPageObjects(pageObjectPaths),
      testSpecs: await this.indexTestSpecs(testSpecPaths),
      timestamp: new Date().toISOString(),
    };

    results.total = results.healingEvents + results.failureReports +
      results.pageObjects + results.testSpecs;

    return results;
  }
}

module.exports = { RAGIndexer };
