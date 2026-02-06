/**
 * Shell Executor Utilities
 *
 * Cross-platform shell execution utilities for CCS.
 */

import { spawn, ChildProcess } from 'child_process';
import { ErrorManager } from './error-manager';

/**
 * Escape arguments for shell execution (Windows cmd.exe / Unix sh)
 * Note: shell: true uses cmd.exe on Windows, not PowerShell
 */
export function escapeShellArg(arg: string): string {
  const isWindows = process.platform === 'win32';

  if (isWindows) {
    // cmd.exe: Use double quotes, escape internal double quotes with backslash
    // Also escape special cmd characters: & | < > ^ %
    const escaped = String(arg).replace(/"/g, '\\"'); // Escape double quotes
    return '"' + escaped + '"';
  } else {
    // Unix/macOS: Double quotes with escaped inner quotes
    return '"' + String(arg).replace(/"/g, '\\"') + '"';
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

  // Prepare environment (merge with process.env if envVars provided)
  const env = envVars
    ? { ...process.env, ...envVars }
    : { ...process.env };

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
