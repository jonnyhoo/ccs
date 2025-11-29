const assert = require('assert');
const { execSync } = require('child_process');
const path = require('path');
const { createTestEnvironment } = require('../fixtures/test-environment');

describe('npm postinstall', () => {
  let testEnv;
  const postinstallScript = path.join(__dirname, '..', '..', 'scripts', 'postinstall.js');

  beforeEach(() => {
    // Create isolated test environment for each test
    testEnv = createTestEnvironment();
  });

  afterEach(() => {
    // Clean up test environment
    if (testEnv) {
      testEnv.cleanup();
    }
  });

  it('creates config.json', () => {
    execSync(`node "${postinstallScript}"`, {
      stdio: 'ignore',
      env: { ...process.env, CCS_HOME: testEnv.testHome }
    });

    assert(testEnv.fileExists('config.json'), 'config.json should be created');

    const config = testEnv.readFile('config.json', true);
    assert(config.profiles, 'config.json should have profiles');
    assert(typeof config.profiles === 'object', 'profiles should be an object');
  });

  it('creates glm.settings.json', () => {
    execSync(`node "${postinstallScript}"`, {
      stdio: 'ignore',
      env: { ...process.env, CCS_HOME: testEnv.testHome }
    });

    assert(testEnv.fileExists('glm.settings.json'), 'glm.settings.json should be created');

    const glmSettings = testEnv.readFile('glm.settings.json', true);
    assert(glmSettings.env, 'glm.settings.json should have env section');
    assert(glmSettings.env.ANTHROPIC_MODEL, 'should have ANTHROPIC_MODEL set');
    assert.strictEqual(glmSettings.env.ANTHROPIC_MODEL, 'glm-4.6');
  });

  it('is idempotent', () => {
    const env = { ...process.env, CCS_HOME: testEnv.testHome };

    // Run postinstall first time
    execSync(`node "${postinstallScript}"`, { stdio: 'ignore', env });

    // Create custom config
    const customConfig = {
      profiles: {
        custom: '~/.custom.json',
        glm: '~/.ccs/glm.settings.json'
      }
    };
    testEnv.createFile('config.json', customConfig);

    // Run postinstall again
    execSync(`node "${postinstallScript}"`, { stdio: 'ignore', env });

    // Verify custom config preserved
    const config = testEnv.readFile('config.json', true);
    assert(config.profiles.custom, 'Custom profile should be preserved');
    assert.strictEqual(config.profiles.custom, '~/.custom.json');
  });

  it('uses ASCII symbols', () => {
    const output = execSync(`node "${postinstallScript}"`, {
      encoding: 'utf8',
      env: { ...process.env, CCS_HOME: testEnv.testHome }
    });

    // Check for ASCII symbols [OK], [!], [X], [i] - not emojis
    assert(/\[(OK|!|X|i)\]/.test(output), 'Should use ASCII symbols, not emojis');

    // Verify no emojis in output
    const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u;
    assert(!emojiRegex.test(output), 'Should not contain emojis');
  });

  it('handles existing directory gracefully', () => {
    // Create directory manually first
    testEnv.createFile('existing.txt', 'exists');

    // Run postinstall
    execSync(`node "${postinstallScript}"`, {
      stdio: 'ignore',
      env: { ...process.env, CCS_HOME: testEnv.testHome }
    });

    // Verify existing file still exists and new files are created
    assert(testEnv.fileExists('existing.txt'), 'Existing files should be preserved');
    assert(testEnv.fileExists('config.json'), 'config.json should be created');
    assert(testEnv.fileExists('glm.settings.json'), 'glm.settings.json should be created');
  });

  it('does not create VERSION file', () => {
    execSync(`node "${postinstallScript}"`, {
      stdio: 'ignore',
      env: { ...process.env, CCS_HOME: testEnv.testHome }
    });

    // The postinstall script doesn't create VERSION file (only native install does)
    assert(!testEnv.fileExists('VERSION'), 'VERSION file should NOT be created by npm postinstall');
  });
});
