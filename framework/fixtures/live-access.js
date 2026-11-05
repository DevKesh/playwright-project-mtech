async function liveAccess({}, use, testInfo) {
  if (!testInfo.project.metadata.offline && process.env.RUN_LIVE_TESTS !== 'true') {
    throw new Error('Live tests require RUN_LIVE_TESTS=true. Use an explicit test:smoke, test:monitoring or security command.');
  }
  await use();
}

module.exports = { liveAccess };