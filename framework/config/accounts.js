const { loadEnvironment } = require('./environment');

const legacyNames = {
  approved_monitor: ['LOGIN_MONITOR_USERNAME', 'LOGIN_MONITOR_PASSWORD'],
  configured: ['TC_USERNAME', 'TC_PASSWORD'],
};

function getAccount(name, env = loadEnvironment()) {
  if (typeof name !== 'string' || !/^[a-z][a-z0-9_]*$/.test(name)) {
    throw new Error('Invalid account name: use lowercase letters, digits and underscores.');
  }
  const prefix = `ACCOUNT_${name.toUpperCase()}`;
  const canonical = [`${prefix}_USERNAME`, `${prefix}_PASSWORD`];
  const hasCanonical = canonical.some(key => env[key] !== undefined);
  const keys = !hasCanonical && legacyNames[name] ? legacyNames[name] : canonical;
  const missing = keys.filter(key => typeof env[key] !== 'string' || !env[key].trim());
  if (missing.length) {
    throw new Error(`Account ${name} requires ${canonical.join(' and ')}${keys !== canonical ? ` (legacy aliases: ${keys.join(' and ')})` : ''}.`);
  }
  return { username: env[keys[0]], password: env[keys[1]] };
}

module.exports = { getAccount };