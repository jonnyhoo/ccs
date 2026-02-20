/**
 * Utils module barrel export
 * Selective exports of commonly used utilities
 */

// UI utilities (main export)
export * from './ui';

// Time utilities
export * from './time';

// Shell execution
export { execClaude, escapeShellArg } from './shell-executor';

// Claude detection and management
export { getClaudeCliInfo } from './claude-detector';

// Utilities
export { ProgressIndicator } from './progress-indicator';
export { getVersion } from './version';
export { ErrorManager } from './error-manager';

// Platform utilities
export { default as getPlatformCommands } from './platform-commands';
