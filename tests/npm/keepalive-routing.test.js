const assert = require('assert');
const { execSync } = require('child_process');
const path = require('path');
const { createTestEnvironment } = require('../shared/fixtures/test-environment');

describe('npm keepalive routing', () => {
  const ccsPath = path.join(__dirname, '..', '..', 'dist', 'ccs.js');
  let testEnv;
  let testCcsHome;

  beforeAll(() => {
    testEnv = createTestEnvironment();
    testCcsHome = testEnv.testHome;

    const postinstallScript = path.join(__dirname, '..', '..', 'scripts', 'postinstall.js');
    execSync(`node "${postinstallScript}"`, {
      stdio: 'ignore',
      env: { ...process.env, CCS_HOME: testCcsHome },
    });
  });

  afterAll(() => {
    if (testEnv) {
      testEnv.cleanup();
    }
  });

  function runCli(args, options = {}) {
    return execSync(`node "${ccsPath}" ${args}`, {
      ...options,
      env: { ...process.env, CCS_HOME: testCcsHome },
    });
  }

  it('shows keepalive help with explicit keepalive command', function() {
    const output = runCli('keepalive --help', { encoding: 'utf8' });
    assert(output.includes('CCS Keepalive Tools'), 'Should show keepalive command help');
  });

  it('does not hijack cache profiles into keepalive command routing', function() {
    try {
      runCli('cache --help', { stdio: 'pipe', timeout: 3000 });
      assert(false, 'Should not succeed when cache profile does not exist');
    } catch (e) {
      const output = e.stderr?.toString() || e.stdout?.toString() || '';
      assert(!output.includes('CCS Keepalive Tools'), 'Should not route cache to keepalive help');
      assert(!output.includes('Unknown keepalive command'), 'Should not route cache to keepalive handler');
      assert(
        output.includes("Profile 'cache' not found") || /cache/i.test(output),
        'Should still mention the cache profile name'
      );
    }
  });
});
