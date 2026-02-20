/**
 * CCS Type Definitions
 * Single entry point for all types
 */

// Config types
export type {
  Config,
  ProfilesConfig,
  Settings,
  EnvVars,
  EnvValue,
  ProfileMetadata,
  ProfilesRegistry,
} from './config';
export { isConfig, isSettings } from './config';

// CLI types
export type { ParsedArgs, ClaudeSpawnOptions, Platform, ClaudeCliInfo } from './cli';
export { ExitCode } from './cli';

// Delegation types
export type {
  SessionMetadata,
  DelegationSession,
  DelegationSessionsRegistry,
  ExecutionResult,
  ToolEvent,
  OutputEvent,
  DelegationEvent,
} from './delegation';

// Utility types
export { LogLevel } from './utils';
export type { ErrorCode, ColorName, TerminalInfo, Result } from './utils';
