/**
 * Copilot Auth Handler
 *
 * Handles GitHub OAuth authentication for copilot-api.
 * Uses local installation from ~/.ccs/copilot/ (managed by copilot-package-manager).
 */

import { spawn } from 'child_process';
import { CopilotAuthStatus, CopilotDebugInfo } from './types';
import {
  isCopilotApiInstalled as checkInstalled,
  getCopilotApiBinPath,
} from './copilot-package-manager';

/**
 * Check if copilot-api is installed locally.
 * Uses copilot-package-manager to check ~/.ccs/copilot/node_modules/.bin/copilot-api
 */
export function isCopilotApiInstalled(): boolean {
  return checkInstalled();
}

/**
 * Get copilot-api debug info.
 * Returns authentication status and version info.
 */
export async function getCopilotDebugInfo(): Promise<CopilotDebugInfo | null> {
  const binPath = getCopilotApiBinPath();

  return new Promise((resolve) => {
    try {
      const proc = spawn(binPath, ['debug', '--json'], {
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: process.platform === 'win32',
        timeout: 15000,
      });

      let stdout = '';
      let _stderr = '';

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        _stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0 && stdout) {
          try {
            const info = JSON.parse(stdout.trim()) as CopilotDebugInfo;
            resolve(info);
          } catch {
            resolve(null);
          }
        } else {
          resolve(null);
        }
      });

      proc.on('error', () => {
        resolve(null);
      });

      // Timeout after 15 seconds
      setTimeout(() => {
        proc.kill();
        resolve(null);
      }, 15000);
    } catch {
      resolve(null);
    }
  });
}

/**
 * Check copilot authentication status.
 */
export async function checkAuthStatus(): Promise<CopilotAuthStatus> {
  const debugInfo = await getCopilotDebugInfo();

  if (!debugInfo) {
    return {
      authenticated: false,
      error: 'Could not check auth status. Is copilot-api installed?',
    };
  }

  return {
    authenticated: debugInfo.authenticated ?? false,
  };
}

/**
 * Start GitHub OAuth authentication flow.
 * Opens browser for user to authenticate with GitHub.
 *
 * @returns Promise that resolves when auth flow completes
 */
export function startAuthFlow(): Promise<{ success: boolean; error?: string }> {
  const binPath = getCopilotApiBinPath();

  return new Promise((resolve) => {
    console.log('[i] Starting GitHub authentication for Copilot...');
    console.log('[i] A browser window will open for GitHub OAuth.');
    console.log('');

    const proc = spawn(binPath, ['auth'], {
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true });
      } else {
        resolve({
          success: false,
          error: `Authentication failed with exit code ${code}`,
        });
      }
    });

    proc.on('error', (err) => {
      resolve({
        success: false,
        error: `Failed to start auth: ${err.message}`,
      });
    });
  });
}
