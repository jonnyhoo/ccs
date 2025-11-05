const assert = require('assert');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

describe('npm CLI', () => {
  const ccsPath = path.join(__dirname, '..', '..', 'bin', 'ccs.js');
  const ccsDir = path.join(os.homedir(), '.ccs');
  const configPath = path.join(ccsDir, 'config.json');

  before(() => {
    // Ensure CCS is installed and configured
    if (!fs.existsSync(configPath)) {
      const postinstallScript = path.join(__dirname, '..', '..', 'scripts', 'postinstall.js');
      execSync(`node "${postinstallScript}"`, { stdio: 'ignore' });
    }
  });

  describe('Argument parsing', () => {
    it('handles flag -c without profile error', function() {
      this.timeout(5000);

      try {
        execSync(`node "${ccsPath}" -c`, { stdio: 'pipe' });
      } catch (e) {
        const output = e.stderr?.toString() || e.stdout?.toString() || '';
        // Should NOT show "Profile '-c' not found" error
        assert(!output.includes("Profile '-c' not found"), 'Should not treat -c as profile');
      }
    });

    it('handles flag --verbose without profile error', function() {
      this.timeout(5000);

      try {
        execSync(`node "${ccsPath}" --verbose`, { stdio: 'pipe' });
      } catch (e) {
        const output = e.stderr?.toString() || e.stdout?.toString() || '';
        assert(!output.includes("Profile '--verbose' not found"), 'Should not treat --verbose as profile');
      }
    });

    it('handles flag -p with value', function() {
      this.timeout(10000);

      try {
        execSync(`node "${ccsPath}" -p "test prompt"`, { stdio: 'pipe', timeout: 8000 });
      } catch (e) {
        const output = e.stderr?.toString() || e.stdout?.toString() || '';
        assert(!output.includes("Profile '-p' not found"), 'Should not treat -p as profile');
      }
    });

    it('handles multiple flags', function() {
      this.timeout(5000);

      try {
        execSync(`node "${ccsPath}" -c --verbose`, { stdio: 'pipe' });
      } catch (e) {
        const output = e.stderr?.toString() || e.stdout?.toString() || '';
        assert(!output.includes("Profile '-c' not found"), 'Should not treat flags as profiles');
        assert(!output.includes("Profile '--verbose' not found"), 'Should not treat flags as profiles');
      }
    });
  });

  describe('Profile handling', () => {
    it('loads glm profile', function() {
      this.timeout(5000);

      try {
        execSync(`node "${ccsPath}" glm --help`, { stdio: 'pipe' });
      } catch (e) {
        const output = e.stderr?.toString() || '';
        assert(!output.includes("Profile 'glm' not found"), 'GLM profile should exist');
      }
    });

    it('shows error for invalid profile', function() {
      this.timeout(5000);

      try {
        execSync(`node "${ccsPath}" invalid-profile-name`, { stdio: 'pipe' });
        assert(false, 'Should have thrown an error for invalid profile');
      } catch (e) {
        const output = e.stderr?.toString() || e.stdout?.toString() || '';
        assert(output.includes("not found") || output.includes("invalid"), 'Should show profile not found error');
      }
    });

    it('handles profile with flags', function() {
      this.timeout(5000);

      try {
        execSync(`node "${ccsPath}" glm -c`, { stdio: 'pipe' });
      } catch (e) {
        const output = e.stderr?.toString() || '';
        assert(!output.includes("Profile 'glm' not found"), 'GLM profile should exist');
        assert(!output.includes("Profile '-c' not found"), 'Should not treat -c as profile');
      }
    });
  });

  describe('Version and help', () => {
    it('shows version with --version flag', function() {
      this.timeout(5000);

      const output = execSync(`node "${ccsPath}" --version`, { encoding: 'utf8' });
      assert(/\d+\.\d+\.\d+/.test(output), 'Should show version number');
    });

    it('shows version with -v flag', function() {
      this.timeout(5000);

      const output = execSync(`node "${ccsPath}" -v`, { encoding: 'utf8' });
      assert(/\d+\.\d+\.\d+/.test(output), 'Should show version number');
    });

    it('shows help with --help flag', function() {
      this.timeout(5000);

      const output = execSync(`node "${ccsPath}" --help`, { encoding: 'utf8' });
      assert(/usage|help|options/i.test(output), 'Should show help information');
    });

    it('shows help with -h flag', function() {
      this.timeout(5000);

      const output = execSync(`node "${ccsPath}" -h`, { encoding: 'utf8' });
      assert(/usage|help|options/i.test(output), 'Should show help information');
    });
  });

  describe('Error handling', () => {
    it('handles empty arguments gracefully', function() {
      this.timeout(5000);

      try {
        execSync(`node "${ccsPath}"`, { stdio: 'pipe' });
      } catch (e) {
        // Should either succeed or fail gracefully with a helpful error
        const output = e.stderr?.toString() || e.stdout?.toString() || '';
        assert(!output.includes('TypeError') && !output.includes('Cannot read'), 'Should not crash with TypeError');
      }
    });

    it('handles very long argument', function() {
      this.timeout(5000);

      const longArg = 'a'.repeat(1000);
      try {
        execSync(`node "${ccsPath}" "${longArg}"`, { stdio: 'pipe' });
      } catch (e) {
        // Should handle gracefully, not crash
        const output = e.stderr?.toString() || e.stdout?.toString() || '';
        assert(!output.includes('TypeError') && !output.includes('Cannot read'), 'Should not crash with TypeError');
      }
    });
  });
});