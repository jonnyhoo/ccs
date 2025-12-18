/**
 * Copilot Module Index
 *
 * Central exports for GitHub Copilot integration via copilot-api.
 */

// Types
export * from './types';

// Package Manager (self-managed installation)
export {
  getCopilotDir,
  getCopilotApiBinPath,
  isCopilotApiInstalled,
  getInstalledVersion,
  getPinnedVersion,
  savePinnedVersion,
  clearPinnedVersion,
  checkForUpdates,
  ensureCopilotApi,
  installCopilotApiVersion,
  uninstallCopilotApi,
  getCopilotApiInfo,
} from './copilot-package-manager';

// Auth
export { checkAuthStatus, startAuthFlow, getCopilotDebugInfo } from './copilot-auth';

// Daemon
export { isDaemonRunning, getDaemonStatus, startDaemon, stopDaemon } from './copilot-daemon';

// Models
export {
  DEFAULT_COPILOT_MODELS,
  fetchModelsFromDaemon,
  getAvailableModels,
  getDefaultModel,
} from './copilot-models';

// Executor
export { getCopilotStatus, generateCopilotEnv, executeCopilotProfile } from './copilot-executor';
