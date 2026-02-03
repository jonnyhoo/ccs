const assert = require('assert');
const { ResultFormatter } = require('../../../dist/delegation/result-formatter');

describe('ResultFormatter', () => {
  describe('Basic formatting', () => {
    it('formats successful result', async () => {
      const result = {
        profile: 'glm',
        cwd: '/home/user/project',
        exitCode: 0,
        stdout: 'Task completed successfully',
        stderr: '',
        duration: 2300,
        success: true
      };

      const formatted = await ResultFormatter.format(result);

      assert.ok(formatted.toLowerCase().includes('delegated to glm'));
      assert.ok(formatted.includes('ccs:glm'));
      assert.ok(formatted.includes('/home/user/project'));
      assert.ok(formatted.includes('2.3s'));
      assert.ok(formatted.includes('0')); // Exit code in table
      assert.ok(formatted.includes('[OK]'));
    });

    it('formats failed result', async () => {
      const result = {
        profile: 'glm',
        cwd: '/home/user/project',
        exitCode: 1,
        stdout: 'Error occurred',
        stderr: 'Command failed',
        duration: 1500,
        success: false
      };

      const formatted = await ResultFormatter.format(result);

      assert.ok(formatted.includes('[X]'));
      assert.ok(formatted.includes('1')); // Exit code in table
      assert.ok(formatted.includes('Delegation failed'));
      assert.ok(formatted.includes('Stderr:'));
      assert.ok(formatted.includes('Command failed'));
    });

    it('handles empty output', async () => {
      const result = {
        profile: 'glm',
        cwd: '/test',
        exitCode: 0,
        stdout: '',
        stderr: '',
        duration: 1000,
        success: true
      };

      const formatted = await ResultFormatter.format(result);

      assert.ok(formatted.includes('No output'));
    });
  });

  describe('File changes extraction', () => {
    it('extracts created files from output', () => {
      const output = 'Created: src/auth.js\nCreated: tests/auth.test.js';

      const { created } = ResultFormatter.extractFileChanges(output);

      assert.strictEqual(created.length, 2);
      assert.ok(created[0].includes('src/auth.js'));
      assert.ok(created[1].includes('tests/auth.test.js'));
    });

    it('extracts modified files from output', () => {
      const output = 'Modified: src/index.js\nUpdated: package.json';

      const { modified } = ResultFormatter.extractFileChanges(output);

      assert.strictEqual(modified.length, 2);
      assert.ok(modified[0].includes('src/index.js'));
      assert.ok(modified[1].includes('package.json'));
    });

    it('extracts both created and modified files', () => {
      const output = 'Created: src/new.js\nModified: src/old.js\nCreated: tests/new.test.js';

      const { created, modified } = ResultFormatter.extractFileChanges(output);

      assert.strictEqual(created.length, 2);
      assert.strictEqual(modified.length, 1);
    });

    it('deduplicates files in lists', () => {
      const output = 'Created: src/file.js\nCreated: src/file.js\nModified: src/file.js';

      const { created, modified } = ResultFormatter.extractFileChanges(output);

      assert.strictEqual(created.length, 1);
      assert.strictEqual(modified.length, 0);
    });

    it('matches file patterns case-insensitively', () => {
      const output = 'CREATED: src/file.js\nMODIFIED: src/other.js';

      const { created, modified } = ResultFormatter.extractFileChanges(output);

      assert.strictEqual(created.length, 1);
      assert.strictEqual(modified.length, 1);
    });
  });

  describe('Output passthrough', () => {
    it('passes through stdout content', async () => {
      const result = {
        profile: 'glm',
        cwd: '/home/user/project',
        exitCode: 0,
        stdout: 'Created: src/new.js\nModified: src/old.js',
        stderr: '',
        duration: 1000,
        success: true
      };

      const formatted = await ResultFormatter.format(result);

      assert.ok(formatted.includes('src/new.js'));
      assert.ok(formatted.includes('src/old.js'));
    });

    it('preserves multi-line output', async () => {
      const result = {
        profile: 'glm',
        cwd: '/test',
        exitCode: 0,
        stdout: 'Line 1\nLine 2\nLine 3',
        stderr: '',
        duration: 1000,
        success: true
      };

      const formatted = await ResultFormatter.format(result);

      assert.ok(formatted.includes('Line 1'));
      assert.ok(formatted.includes('Line 2'));
      assert.ok(formatted.includes('Line 3'));
    });
  });

  describe('ASCII box formatting', () => {
    it('uses ASCII box characters', async () => {
      const result = {
        profile: 'glm',
        cwd: '/test',
        exitCode: 0,
        stdout: 'Done',
        stderr: '',
        duration: 1000,
        success: true
      };

      const formatted = await ResultFormatter.format(result);

      // Check for box characters (round border style)
      assert.ok(formatted.includes('─') || formatted.includes('╔'));
    });
  });

  describe('Model display names', () => {
    it('shows correct model display names', async () => {
      const glmResult = {
        profile: 'glm',
        cwd: '/test',
        exitCode: 0,
        stdout: '',
        stderr: '',
        duration: 1000,
        success: true
      };

      const glmFormatted = await ResultFormatter.format(glmResult);
      // Model display reads from settings or falls back to profile uppercase
      // Use case-insensitive check since format may vary (GLM, Glm-4.7, etc.)
      assert.ok(glmFormatted.toLowerCase().includes('glm'));

      const kimiResult = { ...glmResult, profile: 'kimi' };
      const kimiFormatted = await ResultFormatter.format(kimiResult);
      assert.ok(kimiFormatted.toLowerCase().includes('kimi'));
    });
  });

  describe('Duration formatting', () => {
    it('formats duration correctly', async () => {
      const result = {
        profile: 'glm',
        cwd: '/test',
        exitCode: 0,
        stdout: '',
        stderr: '',
        duration: 12345,
        success: true
      };

      const formatted = await ResultFormatter.format(result);

      assert.ok(formatted.includes('12.3s'));
    });
  });

  describe('Minimal format', () => {
    it('supports minimal format', async () => {
      const result = {
        profile: 'glm',
        cwd: '/test',
        exitCode: 0,
        stdout: 'Done',
        stderr: '',
        duration: 1500,
        success: true
      };

      const minimal = await ResultFormatter.formatMinimal(result);

      assert.ok(minimal.includes('[OK]'));
      // Model display reads from settings or falls back to profile uppercase
      assert.ok(minimal.toLowerCase().includes('glm'));
      assert.ok(minimal.includes('1.5s'));
      assert.ok(minimal.split('\n').length <= 3);
    });
  });

  describe('Cost handling', () => {
    it('handles undefined totalCost in timeout error', async () => {
      const result = {
        profile: 'glm',
        cwd: '/test',
        duration: 120000,
        sessionId: 'test-session-123',
        totalCost: undefined,
        numTurns: 5,
        timedOut: true
      };

      const formatted = await ResultFormatter.format(result);

      assert.ok(formatted.includes('timed out') || formatted.includes('Timeout'));
      assert.ok(formatted.includes('test-ses'));
      assert.ok(!formatted.includes('Cost: $'));
    });

    it('handles null totalCost in timeout error', async () => {
      const result = {
        profile: 'kimi',
        cwd: '/test',
        duration: 60000,
        sessionId: 'test-session-456',
        totalCost: null,
        numTurns: 3,
        timedOut: true
      };

      const formatted = await ResultFormatter.format(result);

      assert.ok(formatted.includes('timed out') || formatted.includes('Timeout'));
      assert.ok(!formatted.includes('Cost: $'));
    });

    it('shows totalCost when defined in timeout error', async () => {
      const result = {
        profile: 'glm',
        cwd: '/test',
        duration: 90000,
        sessionId: 'test-session-789',
        totalCost: 0.1234,
        numTurns: 4,
        timedOut: true
      };

      const formatted = await ResultFormatter.format(result);

      assert.ok(formatted.includes('Cost: $0.1234'));
    });

    it('handles undefined totalCost in normal result', async () => {
      const result = {
        profile: 'kimi',
        cwd: '/test',
        exitCode: 0,
        stdout: 'Task completed',
        stderr: '',
        duration: 5000,
        success: true,
        sessionId: 'session-abc',
        totalCost: undefined,
        numTurns: 2
      };

      const formatted = await ResultFormatter.format(result);

      assert.ok(formatted.includes('[OK]'));
      assert.ok(!formatted.includes('Cost: $'));
    });
  });
});
