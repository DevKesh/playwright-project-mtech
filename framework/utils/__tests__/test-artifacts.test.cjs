const { test } = require('node:test');
const assert = require('node:assert/strict');
const { attachFailureArtifacts } = require('../test-artifacts');

function artifactCase(status = 'failed') {
  const attachments = [];
  const screenshots = [];
  let htmlCalls = 0;
  return {
    attachments, screenshots,
    get htmlCalls() { return htmlCalls; },
    page: {
      screenshot: async options => { screenshots.push(options); return Buffer.from('fake-image'); },
      url: () => 'https://fixture.test/home?token=do-not-attach#secret',
      content: async () => { htmlCalls++; return '<input value="sensitive">'; },
    },
    info: {
      status, expectedStatus: 'passed',
      attach: async (name, data) => attachments.push({ name, ...data }),
    },
  };
}

test('default artifacts hide fields, strip URL secrets and omit HTML', async () => {
  const sample = artifactCase();
  await attachFailureArtifacts(sample.page, sample.info);
  assert.match(sample.screenshots[0].style, /input, textarea, \[contenteditable\]/);
  assert.equal(sample.attachments[1].body, 'https://fixture.test/home');
  assert.equal(sample.htmlCalls, 0);
  assert.equal(sample.attachments.length, 2);
});

test('authenticated artifacts can exclude URLs and retain an explicit mask/name', async () => {
  const sample = artifactCase();
  const mask = [{}];
  await attachFailureArtifacts(sample.page, sample.info, { includeUrl: false, screenshotName: 'masked-failure', mask });
  assert.equal(sample.attachments.length, 1);
  assert.equal(sample.attachments[0].name, 'masked-failure');
  assert.equal(sample.screenshots[0].mask, mask);
});

test('HTML is captured only when explicitly requested by a legacy consumer', async () => {
  const sample = artifactCase();
  await attachFailureArtifacts(sample.page, sample.info, { includeHtml: true });
  assert.equal(sample.htmlCalls, 1);
  assert.equal(sample.attachments[2].name, 'failure-page-source');
});

test('passing tests do not capture artifacts', async () => {
  const sample = artifactCase('passed');
  await attachFailureArtifacts(sample.page, sample.info);
  assert.equal(sample.attachments.length, 0);
  assert.equal(sample.screenshots.length, 0);
});

test('capture failures never replace the original test outcome', async () => {
  const sample = artifactCase();
  sample.page.screenshot = async () => { throw new Error('page closed'); };
  sample.info.attach = async () => { throw new Error('reporter closed'); };
  await assert.doesNotReject(attachFailureArtifacts(sample.page, sample.info));
  assert.equal(sample.info.status, 'failed');
});