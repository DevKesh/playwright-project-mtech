#!/usr/bin/env node
/**
 * Static Report Server — serves Allure reports without needing `allure open`.
 * 
 * Uses ONLY Node built-in modules (no dependencies). Works in CI and locally.
 * Auto-opens the browser and serves until you press Ctrl+C.
 *
 * Usage:
 *   node framework/utils/serve-report.js                         → serves ./allure-report
 *   node framework/utils/serve-report.js ./allure-reports-history/allure-report-2026-05-14_17-01-54
 *   npm run report:view
 *   npm run report:view -- ./allure-reports-history/allure-report-2026-05-14_17-01-54
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// Resolve the report directory from CLI arg or default
const reportDir = path.resolve(process.argv[2] || './allure-report');

if (!fs.existsSync(reportDir)) {
  console.error(`[REPORT SERVER] Directory not found: ${reportDir}`);
  console.error(`  Run "npm run report:allure:generate" first, or specify a path:`);
  console.error(`  node framework/utils/serve-report.js ./allure-reports-history/<folder>`);
  process.exit(1);
}

const indexFile = path.join(reportDir, 'index.html');
if (!fs.existsSync(indexFile)) {
  console.error(`[REPORT SERVER] No index.html found in: ${reportDir}`);
  console.error(`  This directory doesn't appear to be an Allure report.`);
  process.exit(1);
}

// MIME types for static file serving
const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
};

const server = http.createServer((req, res) => {
  // Decode URL and strip query params
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  
  // Default to index.html
  if (urlPath === '/' || urlPath === '') {
    urlPath = '/index.html';
  }

  const filePath = path.join(reportDir, urlPath);

  // Security: prevent directory traversal
  if (!filePath.startsWith(reportDir)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  // Serve the file
  fs.readFile(filePath, (err, data) => {
    if (err) {
      // Try with .html extension
      if (!path.extname(filePath)) {
        const withHtml = filePath + '.html';
        if (fs.existsSync(withHtml)) {
          const ext = '.html';
          res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
          res.end(fs.readFileSync(withHtml));
          return;
        }
      }
      res.writeHead(404);
      res.end('Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  });
});

// Find a free port starting from 9090
const PORT = parseInt(process.env.REPORT_PORT) || 9090;

server.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`\n[REPORT SERVER] Serving: ${reportDir}`);
  console.log(`[REPORT SERVER] Open:    ${url}`);
  console.log(`[REPORT SERVER] Press Ctrl+C to stop.\n`);

  // Auto-open browser
  const openCmd = process.platform === 'win32' ? 'start' :
                  process.platform === 'darwin' ? 'open' : 'xdg-open';
  exec(`${openCmd} ${url}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[REPORT SERVER] Port ${PORT} is in use. Set REPORT_PORT env var or close the other process.`);
    process.exit(1);
  }
  throw err;
});
