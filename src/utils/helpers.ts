import * as path from 'path';
import * as os from 'os';
import { ColorName, TerminalInfo } from '../types';

/**
 * TTY-aware color detection (matches lib/ccs bash logic)
 */
function getColors(): Record<ColorName, string> {
  const forcedColors = process.env.FORCE_COLOR;
  const noColor = process.env.NO_COLOR;
  const isTTY = process.stdout.isTTY === true; // Must be explicitly true

  const useColors = !!forcedColors || (isTTY && !noColor);

  if (useColors) {
    return {
      red: '\x1b[0;31m',
      yellow: '\x1b[1;33m',
      cyan: '\x1b[0;36m',
      green: '\x1b[0;32m',
      blue: '\x1b[0;34m',
      bold: '\x1b[1m',
      cyanBold: '\x1b[1;36m',
      reset: '\x1b[0m',
    };
  }

  return { red: '', yellow: '', cyan: '', green: '', blue: '', bold: '', cyanBold: '', reset: '' };
}

// Colors object (dynamic)
export const colors = getColors();

/**
 * Helper: Apply color to text (returns plain text if colors disabled)
 */
export function colored(text: string, colorName: ColorName = 'reset'): string {
  const currentColors = getColors();
  const color = currentColors[colorName] || '';
  return color ? `${color}${text}${currentColors.reset}` : text;
}

/**
 * Simple error formatting
 */
export function error(message: string): never {
  console.error(`ERROR: ${message}`);
  console.error('Try: npm install -g @kaitranntt/ccs --force');
  process.exit(1);
}

/**
 * Path expansion (~ and env vars)
 */
export function expandPath(pathStr: string): string {
  // Handle tilde expansion
  if (pathStr.startsWith('~/') || pathStr.startsWith('~\\')) {
    pathStr = path.join(os.homedir(), pathStr.slice(2));
  }

  // Expand environment variables (Windows and Unix)
  pathStr = pathStr.replace(/\$\{([^}]+)\}/g, (_, name) => process.env[name] || '');
  pathStr = pathStr.replace(/\$([A-Z_][A-Z0-9_]*)/gi, (_, name) => process.env[name] || '');

  // Windows %VAR% style
  if (process.platform === 'win32') {
    pathStr = pathStr.replace(/%([^%]+)%/g, (_, name) => process.env[name] || '');
  }

  return path.normalize(pathStr);
}

/**
 * Detect terminal capabilities
 */
export function getTerminalInfo(): TerminalInfo {
  return {
    isTTY: process.stdout.isTTY ?? false,
    supportsColor: (process.stdout.isTTY ?? false) && !process.env.NO_COLOR,
    noColorEnv: !!process.env.NO_COLOR,
  };
}

/**
 * Calculate Levenshtein distance between two strings
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];

  // Initialize first row and column
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  // Fill in the rest of the matrix
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Find similar strings using fuzzy matching
 */
export function findSimilarStrings(
  target: string,
  candidates: string[],
  maxDistance: number = 2
): string[] {
  const targetLower = target.toLowerCase();

  const matches = candidates
    .map((candidate) => ({
      name: candidate,
      distance: levenshteinDistance(targetLower, candidate.toLowerCase()),
    }))
    .filter((item) => item.distance <= maxDistance && item.distance > 0)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 3) // Show at most 3 suggestions
    .map((item) => item.name);

  return matches;
}
