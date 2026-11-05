const fs = require('node:fs');
const path = require('node:path');

const statuses = ['passed', 'failed', 'broken', 'skipped', 'unknown'];

function inspectResults(directory) {
  const statistic = Object.fromEntries([...statuses, 'total'].map(status => [status, 0]));
  const identifiers = new Set();
  let invalid = 0;
  let minStart = Infinity;
  let maxStop = 0;
  let files = [];
  try {
    files = fs.readdirSync(directory, { recursive: true }).filter(file => file.endsWith('-result.json'));
  } catch {}
  for (const file of files) {
    try {
      const result = JSON.parse(fs.readFileSync(path.join(directory, file), 'utf8'));
      if (!result || typeof result.uuid !== 'string' || !result.uuid.trim() ||
          typeof result.name !== 'string' || !result.name.trim() ||
          !statuses.includes(result.status) || identifiers.has(result.uuid)) throw new Error('Invalid test record');
      identifiers.add(result.uuid);
      statistic[result.status]++;
      statistic.total++;
      if (Number.isFinite(result.start)) minStart = Math.min(minStart, result.start);
      if (Number.isFinite(result.stop)) maxStop = Math.max(maxStop, result.stop);
    } catch { invalid++; }
  }
  return {
    valid: statistic.total > 0 && invalid === 0,
    count: statistic.total,
    invalid,
    summary: statistic.total ? {
      statistic,
      time: { duration: Number.isFinite(minStart) ? Math.max(0, maxStop - minStart) : 0 },
      incomplete: invalid > 0 || statistic.unknown > 0,
    } : null,
  };
}

function readReportSummary(directory) {
  for (const relativePath of ['summary.json', path.join('widgets', 'summary.json')]) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(directory, relativePath), 'utf8'));
      const source = data.stats || data.statistic;
      if (!source || !Number.isSafeInteger(source.total) || source.total <= 0) continue;
      const counts = statuses.map(status => source[status] ?? 0);
      if (counts.some(count => !Number.isSafeInteger(count) || count < 0)) continue;
      const accounted = counts.reduce((total, count) => total + count, 0);
      if (accounted > source.total) continue;
      const statistic = Object.fromEntries(statuses.map((status, index) => [status, counts[index]]));
      statistic.unknown += source.total - accounted;
      statistic.total = source.total;
      return {
        statistic,
        time: data.time || { duration: data.duration || 0 },
        reportStatus: data.status || data.reportStatus,
      };
    } catch {}
  }
  return null;
}

if (require.main === module) {
  const [mode, directory] = process.argv.slice(2);
  if (!directory || !['results', 'summary'].includes(mode)) {
    console.error('Usage: validate-allure-results.js results|summary DIRECTORY');
    process.exitCode = 1;
  } else {
    const result = mode === 'results' ? inspectResults(directory) : null;
    const summary = result?.summary || (mode === 'summary' ? readReportSummary(directory) : null);
    const count = summary?.statistic.total || 0;
    const expected = Number(process.env.EXPECTED_RESULTS || 0);
    const incomplete = !count || Boolean(summary?.incomplete) || (expected > 0 && count !== expected);
    const valid = mode === 'results' ? result.valid : count > 0 && !incomplete;
    if (process.env.GITHUB_OUTPUT) {
      fs.appendFileSync(process.env.GITHUB_OUTPUT, `valid=${valid}\ncount=${count}\nincomplete=${incomplete}\n`);
    }
    console.log(`Allure ${mode}: ${count} test records; valid=${valid}; incomplete=${incomplete}`);
    if (!valid) {
      console.error('Missing, empty or malformed current-run test results. Publication is blocked.');
      process.exitCode = 1;
    }
  }
}

module.exports = { inspectResults, readReportSummary };