async function collectPageLoadMetrics(page) {
  return page.evaluate(() => {
    const navigation = performance.getEntriesByType('navigation')[0] || null;
    const paints = performance.getEntriesByType('paint');
    const paintMap = Object.fromEntries(
      paints.map((entry) => [entry.name, Math.round(entry.startTime)])
    );
    const lcpEntries = performance.getEntriesByType('largest-contentful-paint');
    const lcpEntry = lcpEntries.length > 0 ? lcpEntries[lcpEntries.length - 1] : null;

    return {
      url: window.location.href,
      domContentLoadedMs: navigation ? Math.round(navigation.domContentLoadedEventEnd) : null,
      responseEndMs: navigation ? Math.round(navigation.responseEnd) : null,
      loadEventMs: navigation ? Math.round(navigation.loadEventEnd) : null,
      firstPaintMs: paintMap['first-paint'] ?? null,
      firstContentfulPaintMs: paintMap['first-contentful-paint'] ?? null,
      largestContentfulPaintMs: lcpEntry ? Math.round(lcpEntry.startTime) : null,
    };
  });
}

async function settlePage(page, { readySelector, timeout = 15000 } = {}) {
  await page.waitForLoadState('domcontentloaded', { timeout }).catch(() => {});
  await page.waitForLoadState('load', { timeout }).catch(() => {});

  if (readySelector) {
    await page.locator(readySelector).first().waitFor({ state: 'visible', timeout });
  }
}

async function measureNavigation(page, action, options = {}) {
  const startedAt = Date.now();
  await action();
  await settlePage(page, options);

  const metrics = await collectPageLoadMetrics(page);
  return {
    label: options.label || page.url(),
    measuredAt: new Date().toISOString(),
    wallClockMs: Date.now() - startedAt,
    ...metrics,
  };
}

async function attachLoadMetrics(testInfo, name, metrics) {
  await testInfo.attach(`${name}-load-metrics`, {
    body: JSON.stringify(metrics, null, 2),
    contentType: 'application/json',
  });
}

function assertOptionalLoadThreshold(expect, metrics, envName = 'PW_TC_MAX_LOAD_MS') {
  const rawThreshold = process.env[envName];
  if (!rawThreshold) {
    return;
  }

  const thresholdMs = Number(rawThreshold);
  if (!Number.isFinite(thresholdMs) || thresholdMs <= 0) {
    return;
  }

  expect(metrics.wallClockMs).toBeLessThanOrEqual(thresholdMs);
}

module.exports = {
  attachLoadMetrics,
  assertOptionalLoadThreshold,
  collectPageLoadMetrics,
  measureNavigation,
};