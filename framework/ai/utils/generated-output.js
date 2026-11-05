const fs = require('node:fs');
const path = require('node:path');

const PROJECT_ROOT = path.resolve(__dirname, '../../..');
const SPEC_OUTPUT_DIR = path.join(PROJECT_ROOT, 'tests', 'tc2', 'nl-authored');

function resolveSpecOutputDir(outputDir) {
  if (outputDir && path.resolve(PROJECT_ROOT, outputDir) !== SPEC_OUTPUT_DIR) {
    throw new Error('NL specs must be written to tests/tc2/nl-authored to preserve fixture import paths');
  }
  return SPEC_OUTPUT_DIR;
}

function writeNewGeneratedFile(directory, filename, code) {
  if (directory === SPEC_OUTPUT_DIR && !filename?.endsWith('.spec.js')) {
    throw new Error('Generated specs must use the .spec.js extension');
  }
  if (!filename || /[\\/]/.test(filename) || !/^[\w-]+(?:\.spec)?\.js$/.test(filename)) {
    throw new Error('Generated file name must be a plain JavaScript file name');
  }
  const filePath = path.join(directory, filename);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(filePath, code, { encoding: 'utf8', flag: 'wx' });
  return filePath;
}

module.exports = { SPEC_OUTPUT_DIR, resolveSpecOutputDir, writeNewGeneratedFile };