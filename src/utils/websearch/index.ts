/**
 * WebSearch Module Barrel Export
 *
 * Re-exports all WebSearch functionality from submodules.
 *
 * @module utils/websearch
 */

// Types
export type {
  GeminiCliStatus,
  GrokCliStatus,
  OpenCodeCliStatus,
  WebSearchReadiness,
  WebSearchStatus,
  WebSearchCliInfo,
  WebSearchProviderConfig,
  WebSearchConfig,
} from './types';

// Gemini CLI
export {
  getGeminiCliStatus,
  hasGeminiCli,
  isGeminiAuthenticated,
  clearGeminiCliCache,
} from './gemini-cli';

// Grok CLI
export { getGrokCliStatus, hasGrokCli, clearGrokCliCache } from './grok-cli';

// OpenCode CLI
export { getOpenCodeCliStatus, hasOpenCodeCli, clearOpenCodeCliCache } from './opencode-cli';

// Hook Installation
export {
  getHookPath,
  hasWebSearchHook,
  getWebSearchHookConfig,
  installWebSearchHook,
  uninstallWebSearchHook,
} from './hook-installer';

// Hook Config (removal)
export { removeHookConfig } from './hook-config';

// Hook Environment
export { getWebSearchHookEnv } from './hook-env';

// Status and Readiness
export {
  getWebSearchCliProviders,
  hasAnyWebSearchCli,
  getCliInstallHints,
  getWebSearchReadiness,
  displayWebSearchStatus,
} from './status';

// Profile Hook Injection
export { ensureProfileHooks, removeMigrationMarker } from './profile-hook-injector';
