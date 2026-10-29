async function attachFailureArtifacts(page, testInfo, {
  includeHtml = false,
  includeUrl = true,
  screenshotName = 'failure-screenshot',
  mask = [],
  force = false,
} = {}) {
  if (!force && testInfo.status === testInfo.expectedStatus) return;
  try {
    const screenshot = await page.screenshot({
      fullPage: true,
      mask,
      style: 'input, textarea, [contenteditable] { visibility: hidden !important; }',
    }).catch(() => null);
    if (screenshot) {
      await testInfo.attach(screenshotName, { body: screenshot, contentType: 'image/png' });
    }
    if (includeUrl) {
      const url = new URL(page.url());
      await testInfo.attach('failure-url', { body: `${url.origin}${url.pathname}`, contentType: 'text/plain' });
    }
    if (includeHtml) {
      const html = await page.content().catch(() => null);
      if (html) await testInfo.attach('failure-page-source', { body: html, contentType: 'text/html' });
    }
  } catch {}
}

module.exports = { attachFailureArtifacts };