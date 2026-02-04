/**
 * Shell Executor Utilities
 *
 * Cross-platform shell execution utilities for CCS.
 */

import { spawn, ChildProcess } from 'child_process';
import { ErrorManager } from './error-manager';
import { getWebSearchHookEnv } from './websearch-manager';
import { getImageReadBlockHookEnv } from './hooks/image-read-block-hook-env';

/**
 * Escape arguments for shell execution (Windows compatibility)
 * Handles PowerShell special characters: backticks, $variables, double quotes
 */
export function escapeShellArg(arg: string): string {
  const isWindows = process.platform === 'win32';

  if (isWindows) {
    // PowerShell: Use single quotes for literal strings to prevent variable expansion
    // Escape single quotes by doubling them (PowerShell syntax)
    // Fallback to double quotes with escapes if single quotes present
    if (arg.includes("'")) {
      // Contains single quote - use double quotes with escape sequences
      return (
        '"' +
        String(arg)
          .replace(/\$/g, '`$') // Escape $ to prevent variable expansion
          .replace(/`/g, '``') // Escape backticks
          .replace(/"/g, '`"') + // Escape double quotes
        '"'
      );
    } else {
      // No single quotes - use single quotes for literal string (safest)
      return "'" + String(arg) + "'";
    }
  } else {
    // Unix/macOS: Double quotes with escaped inner quotes
    return '"' + String(arg).replace(/"/g, '""') + '"';
  }
}

/**
 * Execute Claude CLI with unified spawn logic
 */
export function execClaude(
  claudeCli: string,
  args: string[],
  envVars: NodeJS.ProcessEnv | null = null
): void {
  const isWindows = process.platform === 'win32';
  const needsShell = isWindows && /\.(cmd|bat|ps1)$/i.test(claudeCli);

  // Get WebSearch hook config env vars
  const webSearchEnv = getWebSearchHookEnv();
  const imageReadBlockEnv = getImageReadBlockHookEnv();

  // Prepare environment (merge with process.env if envVars provided)
  const env = envVars
    ? { ...process.env, ...envVars, ...webSearchEnv, ...imageReadBlockEnv }
    : { ...process.env, ...webSearchEnv, ...imageReadBlockEnv };

  let child: ChildProcess;
  if (needsShell) {
    // When shell needed: concatenate into string to avoid DEP0190 warning
    const cmdString = [claudeCli, ...args].map(escapeShellArg).join(' ');
    child = spawn(cmdString, {
      stdio: 'inherit',
      windowsHide: true,
      shell: true,
      env,
    });
  } else {
    // When no shell needed: use array form (faster, no shell overhead)
    child = spawn(claudeCli, args, {
      stdio: 'inherit',
      windowsHide: true,
      env,
    });
  }

  child.on('exit', (code, signal) => {
    if (signal) process.kill(process.pid, signal as NodeJS.Signals);
    else process.exit(code || 0);
  });

  child.on('error', async () => {
    await ErrorManager.showClaudeNotFound();
    process.exit(1);
  });
}
