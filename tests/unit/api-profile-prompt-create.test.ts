import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createEmptyUnifiedConfig } from '../../src/config/unified-config-types';
import { getCcsDir } from '../../src/utils/config-manager';
import { loadUnifiedConfig, saveUnifiedConfig } from '../../src/config/unified-config-loader';
import { createApiProfile } from '../../src/api/services/profile-writer';

describe('createApiProfile prompt preset support', () => {
  const originalEnv = { ...process.env };
  let tempHome = '';

  beforeEach(() => {
    tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'ccs-api-prompt-'));
    process.env.CCS_HOME = tempHome;
    fs.mkdirSync(getCcsDir(), { recursive: true });
    saveUnifiedConfig(createEmptyUnifiedConfig());
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    if (tempHome) {
      fs.rmSync(tempHome, { recursive: true, force: true });
    }
  });

  test('writes appendSystemPromptFile into unified config and creates file', () => {
    const result = createApiProfile(
      'codeflow',
      'https://api.example.com',
      'test-key',
      {
        default: 'claude-sonnet-4-5',
        opus: 'claude-sonnet-4-5',
        sonnet: 'claude-sonnet-4-5',
        haiku: 'claude-sonnet-4-5',
      },
      undefined,
      false,
      undefined,
      undefined,
      '~/.ccs/prompts/codeflow.md'
    );

    expect(result.success).toBe(true);
    expect(result.promptFile).toBe('~/.ccs/prompts/codeflow.md');
    expect(result.promptFileCreated).toBe(true);

    const config = loadUnifiedConfig();
    expect(config?.profiles.codeflow.appendSystemPromptFile).toBe('~/.ccs/prompts/codeflow.md');

    const promptPath = path.join(tempHome, '.ccs', 'prompts', 'codeflow.md');
    expect(fs.existsSync(promptPath)).toBe(true);
  });

  test('writes appendSystemPrompt into unified config', () => {
    const result = createApiProfile(
      'codeflow-inline',
      'https://api.example.com',
      'test-key',
      {
        default: 'claude-sonnet-4-5',
        opus: 'claude-sonnet-4-5',
        sonnet: 'claude-sonnet-4-5',
        haiku: 'claude-sonnet-4-5',
      },
      undefined,
      false,
      undefined,
      'Always answer in Chinese.'
    );

    expect(result.success).toBe(true);

    const config = loadUnifiedConfig();
    expect(config?.profiles['codeflow-inline'].appendSystemPrompt).toBe(
      'Always answer in Chinese.'
    );
  });
});
