import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { readFileTailLines } from '../../../src/utils/file-tail';

describe('readFileTailLines', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ccs-file-tail-test-'));
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('returns an empty list for missing files', () => {
    const missingPath = path.join(testDir, 'missing.log');
    expect(readFileTailLines(missingPath, 10)).toEqual([]);
  });

  it('returns the last non-empty lines in order', () => {
    const logPath = path.join(testDir, 'keepalive.log');
    const lines = Array.from({ length: 200 }, (_, index) => `line ${index + 1}`);
    const content = [...lines.slice(0, 120), '', ...lines.slice(120)].join('\r\n') + '\r\n';

    fs.writeFileSync(logPath, content, 'utf8');

    expect(readFileTailLines(logPath, 3)).toEqual(['line 198', 'line 199', 'line 200']);
  });

  it('reads only the available content when maxLines exceeds file length', () => {
    const logPath = path.join(testDir, 'short.log');
    fs.writeFileSync(logPath, ' first \n\nsecond\n third \n', 'utf8');

    expect(readFileTailLines(logPath, 10)).toEqual(['first', 'second', 'third']);
  });
});
