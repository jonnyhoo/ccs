import * as fs from 'fs';
import { execSync } from 'child_process';
import { expandPath } from './helpers';
import { ClaudeCliInfo } from '../types';

/**
 * Detect Claude CLI executable
 */
export function detectClaudeCli(): string | null {
  // Priority 1: CCS_CLAUDE_PATH environment variable (if user wants custom path)
  if (process.env.CCS_CLAUDE_PATH) {
    const ccsPath = expandPath(process.env.CCS_CLAUDE_PATH);
    // Basic validation: file exists
    if (fs.existsSync(ccsPath)) {
      return ccsPath;
    }
    // Invalid CCS_CLAUDE_PATH - show warning and fall back to PATH
    console.warn('[!] Warning: CCS_CLAUDE_PATH is set but file not found:', ccsPath);
    console.warn('    Falling back to system PATH lookup...');
  }

  // Priority 2: Resolve 'claude' from PATH using which/where.exe
  // This fixes Windows npm installation where spawn() can't resolve bare command names
  // SECURITY: Commands are hardcoded literals with no user input - safe from injection
  const isWindows = process.platform === 'win32';

  try {
    const cmd = isWindows ? 'where.exe claude' : 'which claude';
    const result = execSync(cmd, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 5000, // 5 second timeout to prevent hangs
    }).trim();

    // where.exe may return multiple lines (all matches in PATH order)
    const matches = result
      .split('\n')
      .map((p) => p.trim())
      .filter((p) => p);

    if (isWindows) {
      // On Windows, prefer executables with extensions (.exe, .cmd, .bat)
      // where.exe often returns file without extension first, then the actual .cmd wrapper
      const withExtension = matches.find((p) => /\.(exe|cmd|bat|ps1)$/i.test(p));
      const claudePath = withExtension || matches[0];

      if (claudePath && fs.existsSync(claudePath)) {
        return claudePath;
      }
    } else {
      // On Unix, first match is fine
      const claudePath = matches[0];

      if (claudePath && fs.existsSync(claudePath)) {
        return claudePath;
      }
    }
  } catch (_err) {
    // Command failed - claude not in PATH
    // Fall through to return null
  }

  // Priority 3: Claude not found
  return null;
}

/**
 * Get detailed Claude CLI information
 */
export function getClaudeCliInfo(): ClaudeCliInfo | null {
  const claudePath = detectClaudeCli();

  if (!claudePath) {
    return null;
  }

  const isWindows = process.platform === 'win32';
  const needsShell = isWindows && /\.(cmd|bat|ps1)$/i.test(claudePath);

  return {
    path: claudePath,
    isWindows,
    needsShell,
  };
}

/**
 * Show Claude not found error
 */
export function showClaudeNotFoundError(): never {
  console.error('ERROR: Claude CLI not found in PATH');
  console.error('Install from: https://docs.claude.com/en/docs/claude-code/installation');
  process.exit(1);
}
