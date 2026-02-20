/**
 * Central UI Abstraction Layer
 *
 * Provides semantic, TTY-aware styling for CLI output.
 * Wraps chalk, boxen, cli-table3, ora with consistent API.
 *
 * Constraints:
 * - NO EMOJIS (ASCII only: [OK], [X], [!], [i])
 * - TTY-aware (plain text in pipes/CI)
 * - Respects NO_COLOR environment variable
 *
 * @module utils/ui
 */

// Re-export everything from modular files
export {
  // Initialization
  initUI,
  isInteractive,
  isClaudeCodeContext,

  // Colors
  color,
  gradientText,
  bold,
  dim,

  // Status indicators
  ok,
  fail,
  warn,
  info,

  // Boxes
  box,
  errorBox,
  infoBox,
  warnBox,

  // Tables
  table,

  // Spinner
  spinner,

  // Tasks

  // Text formatting
  header,
  subheader,
  hr,
  sectionHeader,

  // Unified object
  ui,
} from './ui/index';

// Re-export types

// Default export
export { default } from './ui/index';
