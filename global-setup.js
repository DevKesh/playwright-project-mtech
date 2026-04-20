const fs = require('fs');
const path = require('path');

module.exports = function globalSetup() {
  const allureResults = path.join(__dirname, 'allure-results');
  const allureReport = path.join(__dirname, 'allure-report');

  // Wipe previous allure results so every run starts fresh
  fs.rmSync(allureResults, { recursive: true, force: true });
  fs.mkdirSync(allureResults, { recursive: true });
  fs.rmSync(allureReport, { recursive: true, force: true });
};
