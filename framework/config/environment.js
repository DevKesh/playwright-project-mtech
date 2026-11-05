const fs = require('node:fs');
const path = require('node:path');

const qa = Object.freeze({
  baseURL: 'https://qa2.totalconnect2.com',
  alarmnetURL: 'https://services.qa.alarmnet.com',
});

function loadEnvironment({ root = path.resolve(__dirname, '../..'), env = process.env } = {}) {
  if ((env.CI && env.CI !== 'false') || env.GITHUB_ACTIONS === 'true') return env;
  const qaFile = path.join(root, '.env.qa');
  const filename = fs.existsSync(qaFile) ? qaFile : path.join(root, '.env');
  if (!fs.existsSync(filename)) return env;
  const values = require('dotenv').parse(fs.readFileSync(filename));
  for (const [name, value] of Object.entries(values)) {
    if (env[name] === undefined) env[name] = value;
  }
  return env;
}

module.exports = { qa, loadEnvironment };