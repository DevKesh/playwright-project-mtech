function logStep(message) {
  // Console logging keeps steps visible in terminal output alongside Playwright report steps.
  console.log(`[STEP] ${message}`);
}

module.exports = { logStep };
