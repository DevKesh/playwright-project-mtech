#!/usr/bin/env node

/**
 * CLI Script: Build/rebuild the RAG knowledge base.
 *
 * Reads all historical data (healing events, failure reports, page objects,
 * test specs) and indexes them into the vector store for semantic retrieval.
 *
 * Usage:
 *   node framework/ai/scripts/index-knowledge-base.js
 */

const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

const { loadAIConfig } = require('../config/ai.config');
const { ChromaStore } = require('../rag/chroma-client');
const { EmbeddingService } = require('../rag/embedding-service');
const { RAGIndexer } = require('../rag/rag-indexer');
const { loadHealingLog } = require('../storage/healing-history');
const { writeReport } = require('../storage/report-writer');

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

function loadFailureReports() {
  const reportsDir = path.resolve(__dirname, '../../../ai-reports/failure-reports');
  const reports = [];
  try {
    if (fs.existsSync(reportsDir)) {
      const files = fs.readdirSync(reportsDir).filter(f => f.endsWith('.json'));
      for (const file of files) {
        try {
          const data = JSON.parse(fs.readFileSync(path.join(reportsDir, file), 'utf-8'));
          reports.push(data);
        } catch {
          // Skip corrupted files
        }
      }
    }
  } catch {
    // Directory doesn't exist
  }
  return reports;
}

async function main() {
  const config = loadAIConfig();

  if (!config.openaiApiKey) {
    console.error('ERROR: OPENAI_API_KEY is required for embedding generation.');
    process.exit(1);
  }

  console.log('=== RAG Knowledge Base Indexer ===\n');

  // Initialize components
  const chromaStore = new ChromaStore(config);
  await chromaStore.initialize();

  const embeddingService = new EmbeddingService(config);
  const indexer = new RAGIndexer(chromaStore, embeddingService);

  // Discover data sources
  const projectRoot = path.resolve(__dirname, '../../..');
  const healingLog = loadHealingLog();
  const failureReports = loadFailureReports();
  const pageObjectPaths = findFiles(path.join(projectRoot, 'framework/pages'), /\.js$/);
  const testSpecPaths = findFiles(path.join(projectRoot, 'tests'), /\.spec\.js$/);

  console.log('Data sources found:');
  console.log(`  Healing events:   ${healingLog.length}`);
  console.log(`  Failure reports:  ${failureReports.length}`);
  console.log(`  Page objects:     ${pageObjectPaths.length}`);
  console.log(`  Test specs:       ${testSpecPaths.length}`);
  console.log('');

  // Run full index
  console.log('Indexing (generating embeddings)...');
  const results = await indexer.indexAll({
    healingLog,
    failureReports,
    pageObjectPaths,
    testSpecPaths,
  });

  console.log('');
  console.log('Indexing complete:');
  console.log(`  Healing events indexed:  ${results.healingEvents}`);
  console.log(`  Failure reports indexed:  ${results.failureReports}`);
  console.log(`  Page objects indexed:    ${results.pageObjects}`);
  console.log(`  Test specs indexed:      ${results.testSpecs}`);
  console.log(`  Total documents:         ${results.total}`);

  // Save index summary
  const filename = `index-summary-${Date.now()}.json`;
  const filePath = writeReport('rag', filename, results);
  console.log(`\nIndex summary saved to: ${filePath}`);
}

main().catch(err => {
  console.error('Failed to index knowledge base:', err.message);
  process.exit(1);
});
