const { securitySettings, QA_ORIGIN } = require('./login-security');

module.exports = async function validateSecurityRun(config) {
  const { attempts } = securitySettings();
  const project = config.projects[0];
  // Check resolved settings so CLI overrides cannot multiply attempts/retries.
  if (config.workers !== 1 || config.projects.length !== 1 || config.shard ||
      config.maxFailures !== 1 || config.globalTimeout <= 0 ||
      project.repeatEach !== 1 || project.retries !== 0 || project.fullyParallel ||
      project.use.baseURL !== QA_ORIGIN || attempts > 100) {
    throw new Error('Security run requires one worker/project, no shards/retries/repeatEach, maxFailures=1 and fixed QA2 target.');
  }
};