#!/usr/bin/env node
/**
 * Allure Report Bundler — converts a generated Allure report into a single
 * self-contained HTML file that works offline, on file://, on any machine.
 * 
 * Strategy (designed for webpack code-split apps like Allure 3.x):
 *   1. All JS chunks → base64 encoded → converted to blob URLs at runtime
 *   2. All JSON/data files → embedded in a virtual filesystem → fetch() intercepted
 *   3. CSS + fonts → inlined as base64 data URIs
 *   4. Webpack's script loader → patched via script.src setter interception
 *
 * Usage:
 *   node framework/utils/bundle-allure-report.js                    → bundles ./allure-report
 *   node framework/utils/bundle-allure-report.js ./allure-reports-history/allure-report-2026-05-14_17-01-54
 *   npm run report:bundle
 *
 * Output: <input-dir>.html (e.g., allure-report.html) — one file, share anywhere.
 */

const fs = require('fs');
const path = require('path');

const reportDir = path.resolve(process.argv[2] || './allure-report');
const outputFile = process.argv[3] || reportDir.replace(/\/$/, '') + '.html';

if (!fs.existsSync(reportDir)) {
  console.error(`[BUNDLER] Report directory not found: ${reportDir}`);
  console.error(`  Generate a report first: npm run report:allure:generate`);
  process.exit(1);
}

console.log(`[BUNDLER] Bundling: ${reportDir}`);
console.log(`[BUNDLER] Output:   ${outputFile}\n`);

/**
 * Recursively read all files in a directory.
 * Returns Map<relativePath, Buffer>
 */
function readAllFiles(dir, base = dir) {
  const files = new Map();
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(base, fullPath).replace(/\\/g, '/');
    if (entry.isDirectory()) {
      const subFiles = readAllFiles(fullPath, base);
      for (const [k, v] of subFiles) files.set(k, v);
    } else {
      files.set(relPath, fs.readFileSync(fullPath));
    }
  }
  return files;
}

// Read all files in the report directory
const allFiles = readAllFiles(reportDir);
console.log(`[BUNDLER] Found ${allFiles.size} files to bundle`);

// Separate files by type
const jsFiles = new Map();  // path → base64
const cssFiles = [];
const fontFiles = new Map();
const dataFiles = new Map(); // JSON + attachments + everything else

for (const [relPath, content] of allFiles) {
  if (relPath === 'index.html') continue;
  
  if (relPath.endsWith('.js')) {
    jsFiles.set(relPath, content.toString('base64'));
  } else if (relPath.endsWith('.css')) {
    cssFiles.push({ path: relPath, content: content.toString('utf-8') });
  } else if (relPath.endsWith('.woff') || relPath.endsWith('.woff2') || relPath.endsWith('.ttf')) {
    fontFiles.set(relPath, content);
  } else {
    dataFiles.set(relPath, content);
  }
}

console.log(`[BUNDLER] JS chunks: ${jsFiles.size}`);
console.log(`[BUNDLER] CSS files: ${cssFiles.length}`);
console.log(`[BUNDLER] Fonts:     ${fontFiles.size}`);
console.log(`[BUNDLER] Data files: ${dataFiles.size}`);

// === Step 1: Inline fonts into CSS as base64 data URIs ===
let inlinedCSS = '';
for (const css of cssFiles) {
  let cssContent = css.content;
  for (const [fontPath, fontBuffer] of fontFiles) {
    const fontName = path.basename(fontPath);
    const ext = path.extname(fontPath).slice(1);
    const mimeType = ext === 'woff2' ? 'font/woff2' : ext === 'woff' ? 'font/woff' : 'font/ttf';
    const base64 = fontBuffer.toString('base64');
    const dataUri = `data:${mimeType};base64,${base64}`;
    cssContent = cssContent.replace(
      new RegExp(`url\\(['"]?${fontName.replace('.', '\\.')}['"]?\\)`, 'g'),
      `url("${dataUri}")`
    );
  }
  inlinedCSS += cssContent + '\n';
}

// === Step 2: Build the virtual filesystem for JSON/data files ===
const virtualFS = {};
for (const [filePath, buffer] of dataFiles) {
  const ext = path.extname(filePath).toLowerCase();
  if (['.json', '.txt', '.md', '.csv', '.xml'].includes(ext)) {
    virtualFS[filePath] = { type: 'text', data: buffer.toString('base64') };
  } else {
    const mimeType = ext === '.png' ? 'image/png' :
                     ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' :
                     ext === '.gif' ? 'image/gif' :
                     ext === '.svg' ? 'image/svg+xml' : 'application/octet-stream';
    virtualFS[filePath] = { type: 'binary', data: buffer.toString('base64'), mime: mimeType };
  }
}

// === Step 3: Build the bootstrap script ===
// Strategy: 
//   1. Decode + eval ALL chunk JS files first (they push to webpackChunk array)
//   2. Decode + eval the main app bundle last (it processes the array)
//   3. fetch() is intercepted for JSON data
//   All JS is base64 encoded so NO </script> breakage can occur.

// Separate main bundle from chunks
const chunkEntries = [];
let mainBundleEntry = null;
for (const [jsPath, b64] of jsFiles) {
  if (jsPath.match(/^\d+\./)) {
    chunkEntries.push({ path: jsPath, b64 });
  } else {
    mainBundleEntry = { path: jsPath, b64 };
  }
}

const bootstrapScript = `
<script>
(function() {
  // === Data files (base64 encoded) ===
  var __DATA__ = ${JSON.stringify(virtualFS)};
  
  // === Intercept fetch() for data files ===
  // Handles both relative URLs (widgets/statistic.json) and absolute file:// URLs
  var originalFetch = window.fetch;
  window.fetch = function(url, options) {
    if (typeof url === 'string') {
      // Strip query params first
      var cleanUrl = url.split('?')[0];
      // Try to find a matching VFS entry
      var entry = null;
      var matchedPath = '';
      // Strategy 1: direct relative path match (strip leading ./ or /)
      var relativePath = cleanUrl;
      if (relativePath.charAt(0) === '.') relativePath = relativePath.substring(1);
      if (relativePath.charAt(0) === '/') relativePath = relativePath.substring(1);
      if (__DATA__[relativePath]) {
        entry = __DATA__[relativePath];
        matchedPath = relativePath;
      }
      // Strategy 2: suffix match (for absolute file:// URLs)
      if (!entry) {
        var decodedUrl = decodeURIComponent(cleanUrl);
        var keys = Object.keys(__DATA__);
        for (var k = 0; k < keys.length; k++) {
          var needle = '/' + keys[k];
          if (decodedUrl.length >= needle.length && decodedUrl.substring(decodedUrl.length - needle.length) === needle) {
            entry = __DATA__[keys[k]];
            matchedPath = keys[k];
            break;
          }
        }
      }
      if (entry) {
        try {
          var decoded = atob(entry.data);
          if (entry.type === 'text') {
            var textContent = decodeURIComponent(escape(decoded));
            var contentType = matchedPath.indexOf('.json') !== -1 ? 'application/json' : 'text/plain';
            return Promise.resolve(new Response(textContent, {
              status: 200,
              headers: { 'Content-Type': contentType }
            }));
          } else {
            var bytes = new Uint8Array(decoded.length);
            for (var i = 0; i < decoded.length; i++) bytes[i] = decoded.charCodeAt(i);
            return Promise.resolve(new Response(bytes.buffer, {
              status: 200,
              headers: { 'Content-Type': entry.mime || 'application/octet-stream' }
            }));
          }
        } catch(e) {
          console.error('[BUNDLER] fetch intercept error for:', matchedPath, e);
        }
      }
    }
    return originalFetch.apply(this, arguments);
  };
  
  // === Execute JS chunks (they self-register with webpack) ===
  var chunks = ${JSON.stringify(chunkEntries.map(c => c.b64))};
  var mainBundle = ${JSON.stringify(mainBundleEntry ? mainBundleEntry.b64 : '')};
  
  function execCode(b64, label) {
    try {
      var code = decodeURIComponent(escape(atob(b64)));
      (new Function(code))();
    } catch(e) {
      console.error('[BUNDLER] Error executing:', label, e);
    }
  }
  
  // Execute all chunks first (they push to self.webpackChunk_allurereport_web_awesome)
  for (var i = 0; i < chunks.length; i++) {
    execCode(chunks[i], 'chunk-' + i);
  }
  
  // Execute main bundle last (it sets up webpack runtime and processes the chunk array)
  if (mainBundle) {
    execCode(mainBundle, 'main-bundle');
  }
})();
</script>
`;

// === Step 4: Build the final HTML ===
const indexHtml = allFiles.get('index.html').toString('utf-8');

let bundledHtml = indexHtml;

// Remove CSS link and font preloads
bundledHtml = bundledHtml.replace(/<link rel="stylesheet"[^>]+>/g, '');
bundledHtml = bundledHtml.replace(/<link rel="preload"[^>]+>/g, '');

// Remove external script src references (we load via eval now)
bundledHtml = bundledHtml.replace(/<script\s+(?:async\s+)?src="[^"]*\.js"[^>]*><\/script>/g, '');

// Remove the <base> tag script — it converts relative URLs to absolute file:// URLs
// which breaks fetch interception. Not needed since all resources are embedded.
bundledHtml = bundledHtml.replace(/<script>\s*const \{ origin, pathname \}[\s\S]*?<\/script>/m, '');
bundledHtml = bundledHtml.replace(/<script>\s*\n\s*const \{ origin, pathname \}[\s\S]*?<\/script>/m, '');

// Insert inline CSS in <head>
bundledHtml = bundledHtml.replace('</head>', `<style>\n${inlinedCSS}\n</style>\n</head>`);

// Insert the bootstrap script before </body> (after all other inline scripts)
bundledHtml = bundledHtml.replace('</body>', `${bootstrapScript}\n</body>`);

// Write the bundled file
fs.writeFileSync(outputFile, bundledHtml, 'utf-8');

const sizeMB = (Buffer.byteLength(bundledHtml, 'utf-8') / 1024 / 1024).toFixed(2);
console.log(`\n[BUNDLER] Done! Single-file report: ${outputFile} (${sizeMB} MB)`);
console.log(`[BUNDLER] This file works on file://, email, S3, GitHub Pages — no server needed.`);
