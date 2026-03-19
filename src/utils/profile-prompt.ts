import * as fs from 'fs';
import * as path from 'path';
import { getCcsDir, getCcsHome } from './config-manager';
import { expandPath } from './helpers';

export interface ProfilePromptConfig {
  appendSystemPrompt?: string;
  appendSystemPromptFile?: string;
}

const CLAUDE_PROMPT_FLAGS = [
  '--system-prompt',
  '--system-prompt-file',
  '--append-system-prompt',
  '--append-system-prompt-file',
];

export function hasExplicitPromptOverride(args: string[]): boolean {
  return args.some((arg) =>
    CLAUDE_PROMPT_FLAGS.some((flag) => arg === flag || arg.startsWith(`${flag}=`))
  );
}

export function resolveProfilePromptFilePath(promptFile: string): string {
  const trimmed = promptFile.trim();
  if (!trimmed) {
    throw new Error('Profile prompt file path cannot be empty');
  }

  const normalized = trimmed.replace(/\\/g, '/');
  let withHomeExpanded = normalized;

  if (normalized === '~') {
    withHomeExpanded = getCcsHome();
  } else if (normalized.startsWith('~/')) {
    withHomeExpanded = path.join(getCcsHome(), normalized.slice(2));
  }

  const expanded = expandPath(withHomeExpanded);
  if (path.isAbsolute(expanded)) {
    return expanded;
  }

  return path.join(getCcsDir(), expanded);
}

export function injectProfilePromptArgs(
  profileName: string,
  args: string[],
  promptConfig?: ProfilePromptConfig
): string[] {
  const promptText = promptConfig?.appendSystemPrompt?.trim();
  const promptFile = promptConfig?.appendSystemPromptFile?.trim();

  if (!promptText && !promptFile) {
    return args;
  }

  if (promptText && promptFile) {
    throw new Error(
      `Profile '${profileName}' cannot define both appendSystemPrompt and appendSystemPromptFile`
    );
  }

  if (hasExplicitPromptOverride(args)) {
    return args;
  }

  if (promptFile) {
    const resolvedPromptFile = resolveProfilePromptFilePath(promptFile);
    if (!fs.existsSync(resolvedPromptFile)) {
      throw new Error(`Profile '${profileName}' prompt file not found: ${resolvedPromptFile}`);
    }

    return ['--append-system-prompt-file', resolvedPromptFile, ...args];
  }

  return ['--append-system-prompt', promptText as string, ...args];
}
