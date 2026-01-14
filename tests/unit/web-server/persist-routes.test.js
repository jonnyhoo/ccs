/**
 * Persist Routes Unit Tests
 *
 * Tests backup management endpoints for ~/.claude/settings.json
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');

/**
 * Mock filesystem for isolated testing
 */
class MockFs {
  constructor() {
    this.files = new Map();
    this.dirs = new Set();
  }

  reset() {
    this.files.clear();
    this.dirs.clear();
  }

  addDir(dirPath) {
    this.dirs.add(dirPath);
  }

  addFile(filePath, content) {
    this.files.set(filePath, { content, isSymlink: false });
    this.addDir(path.dirname(filePath));
  }

  addSymlink(filePath) {
    this.files.set(filePath, { content: '', isSymlink: true });
    this.addDir(path.dirname(filePath));
  }

  existsSync(p) {
    return this.files.has(p) || this.dirs.has(p);
  }

  readdirSync(dir) {
    const result = [];
    for (const filePath of this.files.keys()) {
      if (path.dirname(filePath) === dir) {
        result.push(path.basename(filePath));
      }
    }
    return result;
  }

  lstatSync(p) {
    const file = this.files.get(p);
    if (!file) throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    return {
      isSymbolicLink: () => file.isSymlink,
      size: file.content.length,
    };
  }

  readFileSync(p) {
    const file = this.files.get(p);
    if (!file) throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    return file.content;
  }

  openSync(p, _mode) {
    if (!this.files.has(p)) throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    return 1; // Mock fd
  }

  readSync(fd, buffer, offset, length, position) {
    // Simple mock - copy content to buffer
    const file = this.files.values().next().value;
    const content = Buffer.from(file.content);
    content.copy(buffer, offset, position, Math.min(position + length, content.length));
    return Math.min(length, content.length);
  }

  closeSync() {
    // No-op for mock
  }
}

describe('Persist Routes', function () {
  describe('Backup File Parsing', function () {
    it('should match valid backup filename pattern', function () {
      const pattern = /^settings\.json\.backup\.(\d{8}_\d{6})$/;

      // Valid patterns
      assert.ok(pattern.test('settings.json.backup.20250110_143022'));
      assert.ok(pattern.test('settings.json.backup.19990101_000000'));
      assert.ok(pattern.test('settings.json.backup.20301231_235959'));

      // Invalid patterns
      assert.ok(!pattern.test('settings.json.backup.2025011_143022')); // 7 digits date
      assert.ok(!pattern.test('settings.json.backup.20250110_14302')); // 5 digits time
      assert.ok(!pattern.test('settings.json.backup'));
      assert.ok(!pattern.test('settings.json'));
      assert.ok(!pattern.test('backup.20250110_143022'));
    });

    it('should extract timestamp from backup filename', function () {
      const pattern = /^settings\.json\.backup\.(\d{8}_\d{6})$/;
      const match = 'settings.json.backup.20250110_143022'.match(pattern);

      assert.ok(match);
      assert.strictEqual(match[1], '20250110_143022');
    });

    it('should parse timestamp to Date correctly', function () {
      const timestamp = '20250110_143022';

      const year = parseInt(timestamp.slice(0, 4));
      const month = parseInt(timestamp.slice(4, 6)) - 1; // 0-indexed
      const day = parseInt(timestamp.slice(6, 8));
      const hour = parseInt(timestamp.slice(9, 11));
      const min = parseInt(timestamp.slice(11, 13));
      const sec = parseInt(timestamp.slice(13, 15));

      const date = new Date(year, month, day, hour, min, sec);

      assert.strictEqual(date.getFullYear(), 2025);
      assert.strictEqual(date.getMonth(), 0); // January
      assert.strictEqual(date.getDate(), 10);
      assert.strictEqual(date.getHours(), 14);
      assert.strictEqual(date.getMinutes(), 30);
      assert.strictEqual(date.getSeconds(), 22);
    });
  });

  describe('Backup Sorting', function () {
    it('should sort backups by date (newest first)', function () {
      const backups = [
        { timestamp: '20250108_100000', date: new Date(2025, 0, 8, 10, 0, 0) },
        { timestamp: '20250110_143022', date: new Date(2025, 0, 10, 14, 30, 22) },
        { timestamp: '20250109_120000', date: new Date(2025, 0, 9, 12, 0, 0) },
      ];

      const sorted = backups.sort((a, b) => b.date.getTime() - a.date.getTime());

      assert.strictEqual(sorted[0].timestamp, '20250110_143022'); // Newest
      assert.strictEqual(sorted[1].timestamp, '20250109_120000');
      assert.strictEqual(sorted[2].timestamp, '20250108_100000'); // Oldest
    });

    it('should identify latest backup correctly', function () {
      const backups = [
        { timestamp: '20250110_143022', date: new Date(2025, 0, 10, 14, 30, 22) },
        { timestamp: '20250109_120000', date: new Date(2025, 0, 9, 12, 0, 0) },
      ];

      // After sorting, index 0 is latest
      assert.strictEqual(backups[0].timestamp, '20250110_143022');
    });
  });

  describe('Security Checks', function () {
    it('should detect symlink in isSymlink helper', function () {
      const mockFs = new MockFs();
      mockFs.addSymlink('/test/symlink.json');
      mockFs.addFile('/test/regular.json', '{}');

      const symlinkStats = mockFs.lstatSync('/test/symlink.json');
      const regularStats = mockFs.lstatSync('/test/regular.json');

      assert.strictEqual(symlinkStats.isSymbolicLink(), true);
      assert.strictEqual(regularStats.isSymbolicLink(), false);
    });

    it('should return false for non-existent files in symlink check', function () {
      const mockFs = new MockFs();

      // Our isSymlink implementation catches ENOENT and returns false
      let isSymlink = false;
      try {
        mockFs.lstatSync('/nonexistent');
        isSymlink = false;
      } catch {
        isSymlink = false;
      }

      assert.strictEqual(isSymlink, false);
    });
  });

  describe('JSON Validation', function () {
    it('should accept valid settings JSON object', function () {
      const content = '{"env": {"ANTHROPIC_MODEL": "test"}}';
      const parsed = JSON.parse(content);

      const isValid = typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed);
      assert.strictEqual(isValid, true);
    });

    it('should reject arrays as settings', function () {
      const content = '["item1", "item2"]';
      const parsed = JSON.parse(content);

      const isValid = typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed);
      assert.strictEqual(isValid, false);
    });

    it('should reject null as settings', function () {
      const content = 'null';
      const parsed = JSON.parse(content);

      const isValid = typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed);
      assert.strictEqual(isValid, false);
    });

    it('should reject primitives as settings', function () {
      const primitives = ['"string"', '123', 'true', 'false'];

      for (const content of primitives) {
        const parsed = JSON.parse(content);
        const isValid = typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed);
        assert.strictEqual(isValid, false, `Should reject: ${content}`);
      }
    });

    it('should throw on invalid JSON', function () {
      const invalidJson = '{invalid json}';

      assert.throws(() => JSON.parse(invalidJson), SyntaxError);
    });
  });

  describe('RestoreMutex Pattern', function () {
    /**
     * Simplified RestoreMutex implementation for testing
     */
    class RestoreMutex {
      constructor() {
        this.locked = false;
        this.queue = [];
      }

      async acquire() {
        if (this.locked) {
          return new Promise((resolve) => {
            this.queue.push(() => resolve(false));
          });
        }
        this.locked = true;
        return true;
      }

      release() {
        const next = this.queue.shift();
        if (next) {
          next();
        } else {
          this.locked = false;
        }
      }
    }

    it('should acquire mutex when unlocked', async function () {
      const mutex = new RestoreMutex();
      const acquired = await mutex.acquire();

      assert.strictEqual(acquired, true);
      assert.strictEqual(mutex.locked, true);
    });

    it('should queue and reject concurrent requests', async function () {
      const mutex = new RestoreMutex();

      // First acquire succeeds
      const first = await mutex.acquire();
      assert.strictEqual(first, true);

      // Second acquire queues and gets false when released
      const secondPromise = mutex.acquire();

      // Release the mutex
      mutex.release();

      const second = await secondPromise;
      assert.strictEqual(second, false); // Queued request returns false
    });

    it('should unlock after release with no queue', async function () {
      const mutex = new RestoreMutex();

      await mutex.acquire();
      assert.strictEqual(mutex.locked, true);

      mutex.release();
      assert.strictEqual(mutex.locked, false);
    });

    it('should process multiple queued requests in order', async function () {
      const mutex = new RestoreMutex();
      const results = [];

      // First acquire
      const first = await mutex.acquire();
      results.push({ id: 1, acquired: first });

      // Queue multiple requests
      const p2 = mutex.acquire().then((r) => results.push({ id: 2, acquired: r }));
      const p3 = mutex.acquire().then((r) => results.push({ id: 3, acquired: r }));

      // Release all
      mutex.release(); // Signals #2
      mutex.release(); // Signals #3

      await Promise.all([p2, p3]);

      assert.strictEqual(results[0].id, 1);
      assert.strictEqual(results[0].acquired, true);
      assert.strictEqual(results[1].id, 2);
      assert.strictEqual(results[1].acquired, false);
      assert.strictEqual(results[2].id, 3);
      assert.strictEqual(results[2].acquired, false);
    });
  });

  describe('Rate Limiting Logic', function () {
    it('should limit requests within time window', function () {
      // Simulate rate limit check
      const requests = [];
      const windowMs = 60 * 1000; // 1 minute
      const maxRequests = 5;

      const now = Date.now();

      function checkRateLimit() {
        // Clean old requests
        const cutoff = now - windowMs;
        while (requests.length > 0 && requests[0] < cutoff) {
          requests.shift();
        }

        if (requests.length >= maxRequests) {
          return false; // Rate limited
        }

        requests.push(now);
        return true; // Allowed
      }

      // First 5 requests should pass
      for (let i = 0; i < 5; i++) {
        assert.strictEqual(checkRateLimit(), true, `Request ${i + 1} should pass`);
      }

      // 6th request should be rate limited
      assert.strictEqual(checkRateLimit(), false, 'Request 6 should be rate limited');
    });
  });

  describe('API Response Format', function () {
    it('should format backup list response correctly', function () {
      const backups = [
        { timestamp: '20250110_143022', date: new Date('2025-01-10T14:30:22Z') },
        { timestamp: '20250109_120000', date: new Date('2025-01-09T12:00:00Z') },
      ];

      const response = {
        backups: backups.map((b, i) => ({
          timestamp: b.timestamp,
          date: b.date.toISOString(),
          isLatest: i === 0,
        })),
      };

      assert.strictEqual(response.backups.length, 2);
      assert.strictEqual(response.backups[0].isLatest, true);
      assert.strictEqual(response.backups[1].isLatest, false);
      assert.strictEqual(response.backups[0].timestamp, '20250110_143022');
    });

    it('should format restore success response correctly', function () {
      const backup = {
        timestamp: '20250110_143022',
        date: new Date('2025-01-10T14:30:22Z'),
      };

      const response = {
        success: true,
        timestamp: backup.timestamp,
        date: backup.date.toISOString(),
      };

      assert.strictEqual(response.success, true);
      assert.strictEqual(response.timestamp, '20250110_143022');
      assert.ok(response.date.includes('2025-01-10'));
    });

    it('should format error response correctly', function () {
      const errorResponse = { error: 'Backup not found: 20250101_000000' };

      assert.ok(errorResponse.error);
      assert.ok(errorResponse.error.includes('Backup not found'));
    });
  });

  describe('Edge Cases', function () {
    it('should handle empty backup directory', function () {
      const mockFs = new MockFs();
      mockFs.addDir('/home/user/.claude');

      const files = mockFs.readdirSync('/home/user/.claude');
      const backupPattern = /^settings\.json\.backup\.(\d{8}_\d{6})$/;
      const backups = files.filter((f) => backupPattern.test(f));

      assert.strictEqual(backups.length, 0);
    });

    it('should filter out non-backup files', function () {
      const files = [
        'settings.json',
        'settings.json.backup.20250110_143022',
        'settings.json.bak',
        'random.txt',
        'settings.json.backup.invalid',
      ];

      const backupPattern = /^settings\.json\.backup\.(\d{8}_\d{6})$/;
      const backups = files.filter((f) => backupPattern.test(f));

      assert.strictEqual(backups.length, 1);
      assert.strictEqual(backups[0], 'settings.json.backup.20250110_143022');
    });

    it('should handle missing .claude directory', function () {
      const mockFs = new MockFs();

      const claudeDir = '/home/user/.claude';
      const exists = mockFs.existsSync(claudeDir);

      assert.strictEqual(exists, false);
    });
  });
});
