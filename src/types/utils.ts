/**
 * Utility Types
 */

// Re-export from error-codes for consistency
export { ERROR_CODES, ErrorCode, getErrorDocUrl, getErrorCategory } from '../utils/error-codes';

/**
 * Log levels
 */
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

/**
 * Color codes (TTY-aware)
 */
export type ColorName =
  | 'red'
  | 'green'
  | 'yellow'
  | 'blue'
  | 'cyan'
  | 'bold'
  | 'cyanBold'
  | 'reset';

/**
 * Terminal capabilities
 */
export interface TerminalInfo {
  isTTY: boolean;
  supportsColor: boolean;
  noColorEnv: boolean; // NO_COLOR env var set
}

/**
 * Helper result types
 */
export type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };
