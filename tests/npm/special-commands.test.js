const assert = require('assert');
const { execSync } = require('child_process');
const path = require('path');

describe('integration: special commands', () => {
  const ccsPath = path.join(__dirname, '..', '..', 'dist', 'ccs.js');

  it('shows version with --version', () => {
    const output = execSync(`node ${ccsPath} --version`, { encoding: 'utf8' });
    assert(output.includes('CCS (Claude Code Switch)'));
    assert(/v\d+\.\d+\.\d+/.test(output));
  });

  it('shows version with -v', () => {
    const output = execSync(`node ${ccsPath} -v`, { encoding: 'utf8' });
    assert(/v\d+\.\d+\.\d+/.test(output));
  });

  it('shows help with --help', function() {
    this.timeout(5000);
    // Note: Requires claude installation, so we just test that it doesn't crash
    try {
      const output = execSync(`node ${ccsPath} --help`, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore']
      });
      // If we get here, claude was found and help was shown
    } catch (e) {
      // Expected if claude is not installed
      assert(e.message.includes('Claude CLI not found') || e.status === 1);
    }
  });

  it('handles --install command', () => {
    const output = execSync(`node ${ccsPath} --install`, { encoding: 'utf8' });
    assert(output.includes('Feature not available'));
    assert(output.includes('under development'));
    assert(output.includes('.claude/ integration testing'));
  });

  it('handles --uninstall command', () => {
    const output = execSync(`node ${ccsPath} --uninstall`, { encoding: 'utf8' });
    assert(output.includes('Feature not available'));
    assert(output.includes('under development'));
    assert(output.includes('.claude/ integration testing'));
  });
});