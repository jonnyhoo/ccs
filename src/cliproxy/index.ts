/**
 * CLIProxy Module Exports
 * Central export point for CLIProxyAPI binary management and execution
 */

// Types
export type {
  PlatformInfo,
  SupportedOS,
  SupportedArch,
  ArchiveExtension,
  BinaryManagerConfig,
  BinaryInfo,
  DownloadProgress,
  ProgressCallback,
  ChecksumResult,
  DownloadResult,
  CLIProxyProvider,
  CLIProxyConfig,
  ExecutorConfig,
  ProviderConfig,
  ProviderModelMapping,
} from './types';

// Platform detection
export {
  detectPlatform,
  getDownloadUrl,
  getChecksumsUrl,
  getExecutableName,
  getArchiveBinaryName,
  isPlatformSupported,
  getPlatformDescription,
  CLIPROXY_VERSION,
} from './platform-detector';

// Binary management
export {
  BinaryManager,
  ensureCLIProxyBinary,
  isCLIProxyInstalled,
  getCLIProxyPath,
} from './binary-manager';

// Config generation
export {
  generateConfig,
  getClaudeEnvVars,
  getEffectiveEnvVars,
  getProviderSettingsPath,
  ensureProviderSettings,
  getProviderConfig,
  getModelMapping,
  getCliproxyDir,
  getProviderAuthDir,
  getAuthDir,
  getConfigPath,
  getBinDir,
  configExists,
  deleteConfig,
  CLIPROXY_DEFAULT_PORT,
} from './config-generator';

// Base config loader (for reading config/base-*.settings.json)
export {
  loadBaseConfig,
  getModelMappingFromConfig,
  getEnvVarsFromConfig,
  clearConfigCache,
} from './base-config-loader';

// Executor
export { execClaudeWithCLIProxy, isPortAvailable, findAvailablePort } from './cliproxy-executor';

// Authentication
export type { AuthStatus } from './auth-handler';
export {
  isAuthenticated,
  getAuthStatus,
  getAllAuthStatus,
  clearAuth,
  triggerOAuth,
  ensureAuth,
  getOAuthConfig,
  getProviderTokenDir,
  displayAuthStatus,
} from './auth-handler';
