/**
 * UI Initialization
 *
 * Handles lazy loading of ESM dependencies
 * @module utils/ui/init
 */

import { moduleCache, initialized, setInitialized } from './types';

/**
 * Initialize UI dependencies (call once at startup)
 * Uses dynamic imports for ESM packages in CommonJS project
 */
export async function initUI(): Promise<void> {
  if (initialized) return;

  try {
    // Dynamic import for ESM-only packages
    const [chalkImport, boxenImport, gradientImport, oraImport] = await Promise.all([
      import('chalk'),
      import('boxen'),
      import('gradient-string'),
      import('ora'),
    ]);

    // CJS modules: use .default if available (ESM interop), otherwise use module directly
    moduleCache.chalk = chalkImport.default || chalkImport;
    moduleCache.boxen = boxenImport.default || boxenImport;
    moduleCache.gradient = gradientImport.default || gradientImport;
    moduleCache.ora = oraImport.default || oraImport;
    setInitialized(true);
  } catch (_e) {
    // Fallback: UI works without colors if imports fail
    console.error('[!] UI initialization failed, using plain text mode');
    setInitialized(true);
  }
}

/**
 * Check if colors should be used
 * Respects NO_COLOR and FORCE_COLOR environment variables
 */
export function useColors(): boolean {
  // FORCE_COLOR overrides all checks
  if (process.env.FORCE_COLOR) return true;
  // NO_COLOR disables colors
  if (process.env.NO_COLOR) return false;
  // Otherwise, check if TTY
  return !!process.stdout.isTTY;
}

/**
 * Check if interactive mode (TTY + not CI)
 */
export function isInteractive(): boolean {
  return !!process.stdout.isTTY && !process.env.CI && !process.env.NO_COLOR;
}

/**
 * Detect if running inside Claude Code tool context
 *
 * Heuristics:
 * - No TTY (stdout captured)
 * - CI-like environment
 * - CLAUDE_CODE env var set
 */
export function isClaudeCodeContext(): boolean {
  return (
    !process.stdout.isTTY ||
    !!process.env.CI ||
    !!process.env.CLAUDE_CODE ||
    process.env.TERM === 'dumb'
  );
}
