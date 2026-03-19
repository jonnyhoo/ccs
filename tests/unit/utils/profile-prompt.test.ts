import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  hasExplicitPromptOverride,
  injectProfilePromptArgs,
} from '../../../src/utils/profile-prompt';

describe('profile-prompt', () => {
  const originalEnv = { ...process.env };
  let tempHome = '';

  beforeEach(() => {
    tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'ccs-profile-prompt-'));
    process.env.CCS_HOME = tempHome;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    if (tempHome) {
      fs.rmSync(tempHome, { recursive: true, force: true });
    }
  });

  test('injects append-system-prompt-file for profile presets', () => {
    const promptDir = path.join(tempHome, '.ccs', 'prompts');
    const promptFile = path.join(promptDir, 'codeflow.md');
    fs.mkdirSync(promptDir, { recursive: true });
    fs.writeFileSync(promptFile, 'Use Chinese output.\n', 'utf8');

    const result = injectProfilePromptArgs('codeflow', ['--model', 'sonnet'], {
      appendSystemPromptFile: 'prompts/codeflow.md',
    });

    expect(result).toEqual(['--append-system-prompt-file', promptFile, '--model', 'sonnet']);
  });

  test('injects inline append-system-prompt when configured', () => {
    const result = injectProfilePromptArgs('codeflow', ['--verbose'], {
      appendSystemPrompt: 'Always answer in Chinese.',
    });

    expect(result).toEqual(['--append-system-prompt', 'Always answer in Chinese.', '--verbose']);
  });

  test('does not inject when user already passed a prompt override flag', () => {
    const args = ['--append-system-prompt', 'Manual prompt', '--verbose'];

    const result = injectProfilePromptArgs('codeflow', args, {
      appendSystemPrompt: 'Preset prompt',
    });

    expect(result).toEqual(args);
  });

  test('detects prompt override flags passed with equals syntax', () => {
    expect(hasExplicitPromptOverride(['--append-system-prompt=Manual prompt'])).toBe(true);
    expect(hasExplicitPromptOverride(['--model', 'sonnet'])).toBe(false);
  });

  test('throws when both inline and file presets are configured', () => {
    expect(() =>
      injectProfilePromptArgs('codeflow', [], {
        appendSystemPrompt: 'A',
        appendSystemPromptFile: 'prompts/codeflow.md',
      })
    ).toThrow(
      "Profile 'codeflow' cannot define both appendSystemPrompt and appendSystemPromptFile"
    );
  });
});
