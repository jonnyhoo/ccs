const assert = require('assert');
const path = require('path');
const os = require('os');
const { expandPath } = require('../../../dist/utils/helpers');

describe('helpers', () => {
  describe('expandPath', () => {
    it('expands tilde to home directory', () => {
      const expanded = expandPath('~/test');
      assert.strictEqual(expanded, path.join(os.homedir(), 'test'));
    });

    it('expands environment variables', () => {
      process.env.TEST_VAR = '/test/path';
      const expanded = expandPath('${TEST_VAR}/file');
      assert(expanded.includes('test'));
      delete process.env.TEST_VAR;
    });

    it('handles Windows paths', () => {
      if (process.platform === 'win32') {
        const expanded = expandPath('%USERPROFILE%\\test');
        assert(expanded.includes(os.homedir()));
      }
    });
  });
});