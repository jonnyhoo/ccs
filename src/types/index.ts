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
export type {
  ParsedArgs,
  ClaudeSpawnOptions,
  Platform,
  ClaudeCliInfo,
} from './cli';
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

// GLMT types
export type {
  AnthropicMessage,
  ContentBlock,
  AnthropicRequest,
  AnthropicTool,
  OpenAIMessage,
  OpenAIToolCall,
  OpenAIRequest,
  OpenAITool,
  SSEEvent,
  DeltaChunk,
  TransformationContext,
} from './glmt';

// Utility types
export { ErrorCode, LogLevel } from './utils';
export type {
  ColorName,
  TerminalInfo,
  Result,
} from './utils';