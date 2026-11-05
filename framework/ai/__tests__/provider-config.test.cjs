const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname, '../../..');

function runIsolated(source, env = {}) {
  const guard = `
    const guardedFs = require('node:fs');
    const originalReadFile = guardedFs.readFileSync;
    guardedFs.readFileSync = function(filename, ...args) {
      if (require('node:path').basename(String(filename)).startsWith('.env')) {
        throw new Error('Real environment file reads are forbidden in provider tests');
      }
      return originalReadFile.call(this, filename, ...args);
    };
    global.fetch = () => { throw new Error('Real network calls are forbidden in provider tests'); };
  `;
  const result = spawnSync(process.execPath, ['-e', guard + source], {
    cwd: root,
    env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, CI: 'true', ...env },
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
}

test('provider imports do not load dotenv files or construct OpenAI clients', () => {
  runIsolated(`
    const assert = require('node:assert/strict');
    require('dotenv').config = () => { throw new Error('dotenv called'); };
    require('./framework/ai/config/ai.config');
    require('./framework/ai-azure/config/ai.azure.config');
    require('./framework/ai/core/ai-client-factory');
    require('./framework/ai-azure/router');
    require('./framework/ai-azure/core/azure-ai-client-factory');
    assert.equal(require.cache[require.resolve('openai')], undefined);
  `);
});

test('Azure models and timeout survive generic OpenAI defaults without an OpenAI key', () => {
  runIsolated(`
    const assert = require('node:assert/strict');
    const { loadAIConfig, validateAIConfig } = require('./framework/ai/config/ai.config');
    const { createAIClient } = require('./framework/ai/core/ai-client-factory');
    const config = loadAIConfig();
    validateAIConfig(config);
    assert.equal(config.healingModel, 'synthetic-deployment');
    assert.equal(config.analysisModel, 'synthetic-deployment');
    const client = createAIClient({ healingModel: 'gpt-default', analysisModel: 'gpt-default', metricsEnabled: false });
    assert.equal(client.config.healingModel, 'synthetic-deployment');
    assert.equal(client.timeout, 1234);
  `, { AI_PROVIDER: 'azure', AZURE_ANTHROPIC_ENDPOINT: 'https://example.invalid/messages',
    AZURE_ANTHROPIC_API_KEY: 'synthetic-key', AZURE_ANTHROPIC_MODEL: 'synthetic-deployment',
    AZURE_ANTHROPIC_TIMEOUT: '1234' });
});

test('unknown providers and missing selected-provider keys fail without echoing values', () => {
  runIsolated(`
    const assert = require('node:assert/strict');
    const { createAIClient } = require('./framework/ai/core/ai-client-factory');
    assert.throws(() => createAIClient({ provider: 'synthetic-invalid' }), /^Error: AI_PROVIDER must be openai or azure$/);
    assert.throws(() => createAIClient({ provider: 'openai' }), /OPENAI_API_KEY/);
    assert.throws(() => createAIClient({ provider: 'azure', openaiApiKey: 'synthetic-key' }), /AZURE_ANTHROPIC_API_KEY/);
  `);
});

test('fixture import and disabled or CI healing never load environment or agents', () => {
  runIsolated(`
    const assert = require('node:assert/strict');
    require('./framework/config/environment').loadEnvironment = () => { throw new Error('environment read'); };
    const fixture = require('./framework/ai/fixtures/tc.ai.fixture');
    assert.equal(fixture.createHealer(), null);
    process.env.AI_HEALING_ENABLED = 'true';
    assert.equal(fixture.createHealer(), null);
    delete process.env.CI;
    process.env.AI_HEALING_ENABLED = 'false';
    assert.equal(fixture.createHealer(), null);
    assert.equal(require.cache[require.resolve('./framework/ai/agents/locator-healer.agent')], undefined);
  `);
});

test('enabled fixture accepts Azure-only credentials and rejects missing selected keys', () => {
  runIsolated(`
    const assert = require('node:assert/strict');
    require('./framework/config/environment').loadEnvironment = () => process.env;
    const { createHealer } = require('./framework/ai/fixtures/tc.ai.fixture');
    process.env.CI = 'false';
    const healing = createHealer();
    assert.equal(healing.config.healingModel, 'synthetic-deployment');
    assert.equal(healing.healerAgent.aiClient.model, 'synthetic-deployment');
    delete process.env.AZURE_ANTHROPIC_API_KEY;
    assert.throws(() => createHealer(), /AZURE_ANTHROPIC_API_KEY/);
  `, { AI_HEALING_ENABLED: 'true', AI_PROVIDER: 'azure', AI_METRICS_ENABLED: 'false',
    AZURE_ANTHROPIC_ENDPOINT: 'https://example.invalid/messages',
    AZURE_ANTHROPIC_API_KEY: 'synthetic-key', AZURE_ANTHROPIC_MODEL: 'synthetic-deployment' });
});

test('physical-operation boundary bypasses replay and timeout injection, then restores state', () => {
  runIsolated(`
    const assert = require('node:assert/strict');
    const { withoutHealing } = require('./framework/ai/fixtures/tc.ai.fixture');
    const { createLocatorProxy } = require('./framework/ai/core/locator-proxy');
    const page = {};
    let attempts = 0;
    const failure = Object.assign(new Error('waiting for locator'), { name: 'TimeoutError' });
    const locator = createLocatorProxy({ click: async (...args) => {
      attempts++;
      assert.deepEqual(args, []);
      throw failure;
    } }, { page, config: { locatorHealing: true }, healerAgent: {}, selectorDescription: 'confirmation' });
    (async () => {
      await assert.rejects(withoutHealing(page, () => withoutHealing(page, () => locator.click())), error => error === failure);
      assert.equal(attempts, 1);
      assert.equal(page.__aiHealingSuppressed, 0);
    })().catch(error => { console.error(error); process.exitCode = 1; });
  `);
});

test('Azure compatibility factory preserves explicit provider overrides', () => {
  runIsolated(`
    const assert = require('node:assert/strict');
    const { createAIClient } = require('./framework/ai-azure/core/azure-ai-client-factory');
    const client = createAIClient({ endpoint: 'https://example.invalid/messages', apiKey: 'synthetic-key',
      model: 'explicit-deployment', healingModel: 'gpt-default', analysisModel: 'gpt-default', timeout: 2345 });
    assert.equal(client.config.analysisModel, 'explicit-deployment');
    assert.equal(client.config.healingModel, 'explicit-deployment');
    assert.equal(client.timeout, 2345);
  `);
});

test('reporter stays inactive in CI and validates Azure when explicitly enabled locally', () => {
  runIsolated(`
    const assert = require('node:assert/strict');
    let loads = 0;
    require('./framework/config/environment').loadEnvironment = () => { loads++; return process.env; };
    const graphPath = require.resolve('./framework/ai/graph/healing-graph');
    require.cache[graphPath] = { exports: { createHealingGraph: config => ({ provider: config.provider, model: config.analysisModel }) } };
    const Reporter = require('./framework/ai/reporters/ai-healing-reporter');
    assert.equal(new Reporter().healingGraph, null);
    assert.equal(loads, 0);
    process.env.CI = 'false';
    const reporter = new Reporter();
    assert.equal(reporter.healingGraph.model, 'synthetic-deployment');
    delete process.env.AZURE_ANTHROPIC_API_KEY;
    assert.throws(() => new Reporter(), /AZURE_ANTHROPIC_API_KEY/);
  `, { AI_HEALING_ENABLED: 'true', AI_PROVIDER: 'azure',
    AZURE_ANTHROPIC_ENDPOINT: 'https://example.invalid/messages',
    AZURE_ANTHROPIC_API_KEY: 'synthetic-key', AZURE_ANTHROPIC_MODEL: 'synthetic-deployment' });
});

test('NL output uses canonical depth-three paths and refuses existing files or path traversal', () => {
  const fs = require('node:fs');
  const os = require('node:os');
  const { SPEC_OUTPUT_DIR, resolveSpecOutputDir, writeNewGeneratedFile } = require('../utils/generated-output');
  assert.equal(SPEC_OUTPUT_DIR, path.join(root, 'tests', 'tc2', 'nl-authored'));
  assert.equal(resolveSpecOutputDir(), SPEC_OUTPUT_DIR);
  assert.throws(() => resolveSpecOutputDir('tests/generated'), /tests\/tc2\/nl-authored/);
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-output-'));
  try {
    const filename = writeNewGeneratedFile(directory, 'human.spec.js', 'original');
    assert.throws(() => writeNewGeneratedFile(directory, 'human.spec.js', 'replacement'), { code: 'EEXIST' });
    assert.equal(fs.readFileSync(filename, 'utf8'), 'original');
    assert.throws(() => writeNewGeneratedFile(directory, '../outside.spec.js', 'unsafe'), /file name/);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('generate CLI accepts Azure-only configuration with mocked transport and file output', () => {
  runIsolated(`
    const assert = require('node:assert/strict');
    const fs = require('node:fs');
    const factory = require('./framework/ai/core/ai-client-factory');
    let called = false;
    factory.createAIClient = config => {
      assert.equal(config.provider, 'azure');
      return { chatCompletionJSON: async (system, prompt, options) => {
        called = true;
        assert.equal(options.model, 'synthetic-deployment');
        return { code: "const { test } = require('../../../framework/fixtures/smoke.fixture');" };
      } };
    };
    const { main } = require('./framework/ai/scripts/nl-author-generate');
    assert.equal(called, false);
    let written = false;
    fs.mkdirSync = () => {};
    fs.writeFileSync = (filename, code, options) => {
      assert.match(filename.replaceAll('\\\\', '/'), /tests\\/tc2\\/nl-authored\\/verify-devices.spec.js$/);
      assert.equal(options.flag, 'wx');
      assert.ok(code.includes('../../../framework/'));
      written = true;
    };
    process.argv = [process.execPath, 'synthetic-cli', '--instructions', 'Verify devices'];
    main().then(() => assert.equal(written, true)).catch(error => { console.error(error); process.exitCode = 1; });
  `, { AI_PROVIDER: 'azure', AZURE_ANTHROPIC_ENDPOINT: 'https://example.invalid/messages',
    AZURE_ANTHROPIC_API_KEY: 'synthetic-key', AZURE_ANTHROPIC_MODEL: 'synthetic-deployment' });
});

test('NL module imports do not load configuration, read registries, or start generation', () => {
  runIsolated(`
    const assert = require('node:assert/strict');
    const config = require('./framework/ai/config/ai.config');
    config.loadAIConfig = () => { throw new Error('unexpected config load'); };
    const fs = require('node:fs');
    fs.readdirSync = () => { throw new Error('unexpected registry read'); };
    require('./framework/ai/agents/spec-generator');
    require('./framework/ai/scripts/generate-spec');
    require('./framework/ai/scripts/nl-author-generate');
    require('./framework/ai/scripts/nl-test-author');
    require('./framework/ai/scripts/run-lifecycle');
    require('./framework/ai/scripts/explore-and-generate');
    require('./framework/ai/scripts/analyze-flaky');
    require('./framework/ai/scripts/detect-drift');
    require('./framework/ai/scripts/codegen-to-registry');
    require('./framework/ai/scripts/validate-registry');
    require('./framework/ai/scripts/compute-metrics');
    require('./framework/ai/scripts/generate-audit-report');
    require('./framework/ai/scripts/index-knowledge-base');
    require('./framework/ai/scripts/review-healing-log');
    require('./framework/ai-azure/test-connection');
    require('./framework/ai-azure/test-router');
    require('./framework/ai-azure/test-factory-routing');
    require('./framework/ai-azure/test-fixture-routing');
    const preview = require('./framework/ai/scripts/nl-author-preview');
    assert.equal(typeof preview.main, 'function');
  `);
});

test('OpenAI factory forwards models and timeout through mocked SDK transport', () => {
  runIsolated(`
    const assert = require('node:assert/strict');
    const sdk = require.resolve('openai');
    const requests = [];
    require.cache[sdk] = { exports: class MockOpenAI {
      constructor(options) {
        assert.equal(options.apiKey, 'synthetic-key');
        assert.equal(options.timeout, 2468);
        this.chat = { completions: { create: async request => {
          requests.push(request);
          return { choices: [{ message: { content: '{"ok":true}' } }] };
        } } };
      }
    } };
    const config = require('./framework/ai/config/ai.config').loadAIConfig();
    const client = require('./framework/ai/core/ai-client-factory').createAIClient(config);
    (async () => {
      assert.deepEqual(await client.chatCompletionJSON('system', 'prompt'), { ok: true });
      await client.visionCompletionJSON('system', 'prompt', Buffer.from('synthetic-image'));
      assert.deepEqual(requests.map(request => request.model), ['synthetic-chat', 'synthetic-vision']);
    })().catch(error => { console.error(error); process.exitCode = 1; });
  `, { OPENAI_API_KEY: 'synthetic-key', AI_HEALING_MODEL: 'synthetic-chat',
    AI_ANALYSIS_MODEL: 'synthetic-vision', AI_OPENAI_TIMEOUT: '2468', AI_METRICS_ENABLED: 'false' });
});

test('Azure chat and vision use deployment model and retain usage and latency metrics', () => {
  runIsolated(`
    const assert = require('node:assert/strict');
    const fs = require('node:fs');
    const config = require('./framework/ai/config/ai.config').loadAIConfig();
    const client = require('./framework/ai/core/ai-client-factory').createAIClient(config);
    const requests = [];
    client._post = async body => {
      requests.push(body);
      return { content: [{ type: 'text', text: '{"ok":true}' }], usage: { input_tokens: 2, output_tokens: 3 } };
    };
    const writes = [];
    fs.existsSync = () => false;
    fs.mkdirSync = () => {};
    fs.writeFileSync = (filename, content) => writes.push({ filename, content: JSON.parse(content) });
    (async () => {
      const chat = await client.chatCompletionJSON('system', 'prompt', { model: config.healingModel });
      assert.equal(chat.__usage.total_tokens, 5);
      await client.visionCompletionJSON('system', 'prompt', Buffer.from('synthetic-image'), { model: config.analysisModel });
      assert.deepEqual(requests.map(request => request.model), ['synthetic-deployment', 'synthetic-deployment']);
      assert.equal(writes.filter(write => write.filename.endsWith('latency-log.json')).length, 2);
      assert.equal(writes.filter(write => write.filename.endsWith('cost-log.json')).length, 2);
    })().catch(error => { console.error(error); process.exitCode = 1; });
  `, { AI_PROVIDER: 'azure', AZURE_ANTHROPIC_ENDPOINT: 'https://example.invalid/messages',
    AZURE_ANTHROPIC_API_KEY: 'synthetic-key', AZURE_ANTHROPIC_MODEL: 'synthetic-deployment' });
});

test('runtime healing remains reachable and graph cache does not cross provider configurations', () => {
  runIsolated(`
    const assert = require('node:assert/strict');
    const providers = [];
    const graphPath = require.resolve('./framework/ai/graph/runtime-graph');
    require.cache[graphPath] = { exports: { createRuntimeHealingGraph: config => {
      providers.push(config.provider);
      return { invoke: async () => ({ healed: true, healedSelector: 'synthetic', confidence: 0.5, actionResult: config.provider }) };
    } } };
    const cachePath = require.resolve('./framework/ai/storage/healing-cache');
    require.cache[cachePath] = { exports: { getCachedHealing: () => null } };
    const popupPath = require.resolve('./framework/utils/popupInterceptor');
    require.cache[popupPath] = { exports: { dismissPopups: async () => false } };
    const { createLocatorProxy } = require('./framework/ai/core/locator-proxy');
    async function execute(config) {
      const locator = createLocatorProxy({ click: async () => {
        throw Object.assign(new Error('waiting for locator'), { name: 'TimeoutError' });
      } }, { page: {}, config, healerAgent: {}, selectorDescription: 'synthetic-navigation' });
      assert.equal(await locator.click(), config.provider);
    }
    (async () => {
      const config = { locatorHealing: true, healingModel: 'same-model', maxRetries: 1, provider: 'openai' };
      await execute(config);
      await execute(config);
      await execute({ ...config, provider: 'azure' });
      assert.deepEqual(providers, ['openai', 'azure']);
    })().catch(error => { console.error(error); process.exitCode = 1; });
  `);
});