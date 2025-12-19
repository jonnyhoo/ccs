/**
 * Config Generator for CLIProxyAPI
 *
 * Generates config.yaml for CLIProxyAPI based on provider.
 * Handles OAuth token paths and provider-specific settings.
 *
 * Model mappings are loaded from config/base-{provider}.settings.json files
 * to allow easy updates without code changes.
 */

import * as fs from 'fs';
import * as path from 'path';
import { getCcsDir } from '../utils/config-manager';
import { warn } from '../utils/ui';
import { CLIProxyProvider, ProviderConfig, ProviderModelMapping } from './types';
import { getModelMappingFromConfig, getEnvVarsFromConfig } from './base-config-loader';
import { loadOrCreateUnifiedConfig, getGlobalEnvConfig } from '../config/unified-config-loader';

/** Settings file structure for user overrides */
interface ProviderSettings {
  env: NodeJS.ProcessEnv;
}

/** Default CLIProxy port */
export const CLIPROXY_DEFAULT_PORT = 8317;

/** Internal API key for CCS-managed requests */
export const CCS_INTERNAL_API_KEY = 'ccs-internal-managed';

/** Simple secret key for Control Panel login (user-facing) */
export const CCS_CONTROL_PANEL_SECRET = 'ccs';

/**
 * Get CLIProxy writable directory for logs and runtime files.
 * This directory is set as WRITABLE_PATH env var when spawning CLIProxy.
 * Logs will be stored in ~/.ccs/cliproxy/logs/
 */
export function getCliproxyWritablePath(): string {
  return path.join(getCcsDir(), 'cliproxy');
}

/**
 * Config version - bump when config format changes to trigger regeneration
 * v1: Initial config (port, auth-dir, api-keys only)
 * v2: Full-featured config with dashboard, quota mgmt, simplified key
 * v3: Logging disabled by default (user opt-in via ~/.ccs/config.yaml)
 */
export const CLIPROXY_CONFIG_VERSION = 3;

/** Provider display names (static metadata) */
const PROVIDER_DISPLAY_NAMES: Record<CLIProxyProvider, string> = {
  gemini: 'Gemini',
  codex: 'Codex',
  agy: 'Antigravity',
  qwen: 'Qwen Code',
  iflow: 'iFlow',
};

/**
 * Get provider configuration
 * Model mappings are loaded from config/base-{provider}.settings.json
 */
export function getProviderConfig(provider: CLIProxyProvider): ProviderConfig {
  const displayName = PROVIDER_DISPLAY_NAMES[provider];
  if (!displayName) {
    throw new Error(`Unknown provider: ${provider}`);
  }

  // Load models from base config file
  const models = getModelMappingFromConfig(provider);

  return {
    name: provider,
    displayName,
    models,
    requiresOAuth: true, // All CLIProxy providers require OAuth
  };
}

/**
 * Get model mapping for provider
 * Loads from config/base-{provider}.settings.json
 */
export function getModelMapping(provider: CLIProxyProvider): ProviderModelMapping {
  return getProviderConfig(provider).models;
}

/**
 * Get CLIProxy base directory
 * All CLIProxy-related files are stored under ~/.ccs/cliproxy/
 */
export function getCliproxyDir(): string {
  return path.join(getCcsDir(), 'cliproxy');
}

/**
 * Get auth directory for provider
 * All providers use a FLAT auth directory structure for unified config.
 * CLIProxyAPI stores OAuth tokens directly in auth/ (not subdirectories).
 * This enables all providers to be discovered and used concurrently.
 */
export function getProviderAuthDir(_provider: CLIProxyProvider): string {
  // Use flat structure - all auth files in same directory for unified discovery
  // Provider param kept for API compatibility (CLIProxyAPI handles via auth file type field)
  return path.join(getCliproxyDir(), 'auth');
}

/**
 * Get base auth directory for CLIProxyAPI
 */
export function getAuthDir(): string {
  return path.join(getCliproxyDir(), 'auth');
}

/**
 * Get config file path
 */
export function getConfigPath(): string {
  return path.join(getCliproxyDir(), 'config.yaml');
}

/**
 * Get binary directory path
 */
export function getBinDir(): string {
  return path.join(getCliproxyDir(), 'bin');
}

/**
 * Get CLIProxy logging settings from user config.
 * Defaults to disabled to prevent disk bloat.
 */
function getLoggingSettings(): { loggingToFile: boolean; requestLog: boolean } {
  const config = loadOrCreateUnifiedConfig();
  return {
    loggingToFile: config.cliproxy.logging?.enabled ?? false,
    requestLog: config.cliproxy.logging?.request_log ?? false,
  };
}

/**
 * Generate UNIFIED config.yaml content for ALL providers
 * This enables concurrent usage of gemini/codex/agy without config conflicts.
 * CLIProxyAPI routes requests by model name to the appropriate provider.
 */
function generateUnifiedConfigContent(port: number = CLIPROXY_DEFAULT_PORT): string {
  const authDir = getAuthDir(); // Base auth dir - CLIProxyAPI scans subdirectories
  // Convert Windows backslashes to forward slashes for YAML compatibility
  const authDirNormalized = authDir.split(path.sep).join('/');

  // Get logging settings from user config (disabled by default)
  const { loggingToFile, requestLog } = getLoggingSettings();

  // Unified config with enhanced CLIProxyAPI features
  const config = `# CLIProxyAPI config generated by CCS v${CLIPROXY_CONFIG_VERSION}
# Supports: gemini, codex, agy, qwen, iflow (concurrent usage)
# Generated: ${new Date().toISOString()}
#
# This config is auto-managed by CCS. Manual edits may be overwritten.
# Use 'ccs doctor' to regenerate with latest settings.

# =============================================================================
# Server Settings
# =============================================================================

port: ${port}
debug: false

# =============================================================================
# Logging
# =============================================================================
# WARNING: Logs can grow to several GB if enabled!
# To enable logging, edit ~/.ccs/config.yaml:
#   cliproxy:
#     logging:
#       enabled: true
#       request_log: true
# Then run 'ccs doctor --fix' to regenerate this config.
# Use 'ccs cleanup' to remove old logs.

# Write logs to file (stored in ~/.ccs/cliproxy/logs/)
logging-to-file: ${loggingToFile}

# Log individual API requests for debugging/analytics
request-log: ${requestLog}

# =============================================================================
# Dashboard & Management
# =============================================================================

# Enable usage statistics for CCS dashboard analytics
usage-statistics-enabled: true

# Remote management API for CCS dashboard integration
remote-management:
  allow-remote: true
  secret-key: "${CCS_CONTROL_PANEL_SECRET}"
  disable-control-panel: false

# =============================================================================
# Reliability & Quota Management
# =============================================================================

# Auto-retry on transient errors (403, 408, 500, 502, 503, 504)
request-retry: 0
max-retry-interval: 0

# Auto-switch accounts on quota exceeded (429)
# This enables seamless multi-account rotation when rate limited
quota-exceeded:
  switch-project: true
  switch-preview-model: true

# =============================================================================
# Authentication
# =============================================================================

# API keys for CCS internal requests
api-keys:
  - "${CCS_INTERNAL_API_KEY}"

# OAuth tokens directory (auto-discovered by CLIProxyAPI)
auth-dir: "${authDirNormalized}"
`;

  return config;
}

/**
 * Generate unified config.yaml file (supports all providers concurrently)
 * Only regenerates if config doesn't exist.
 * @returns Path to config file
 */
export function generateConfig(
  provider: CLIProxyProvider,
  port: number = CLIPROXY_DEFAULT_PORT
): string {
  const configPath = getConfigPath();

  // Ensure provider auth directory exists
  const authDir = getProviderAuthDir(provider);
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.mkdirSync(authDir, { recursive: true, mode: 0o700 });

  // Only generate config if it doesn't exist (unified config serves all providers)
  if (!fs.existsSync(configPath)) {
    const configContent = generateUnifiedConfigContent(port);
    fs.writeFileSync(configPath, configContent, { mode: 0o600 });
  }

  return configPath;
}

/**
 * Force regenerate config.yaml with latest settings
 * Deletes existing config and creates fresh one with current port
 * @returns Path to new config file
 */
export function regenerateConfig(port: number = CLIPROXY_DEFAULT_PORT): string {
  const configPath = getConfigPath();

  // Read existing port if config exists (preserve user's port choice)
  let effectivePort = port;
  if (fs.existsSync(configPath)) {
    try {
      const content = fs.readFileSync(configPath, 'utf-8');
      const portMatch = content.match(/^port:\s*(\d+)/m);
      if (portMatch) {
        effectivePort = parseInt(portMatch[1], 10);
      }
    } catch {
      // Use default port if reading fails
    }
    // Delete existing config
    fs.unlinkSync(configPath);
  }

  // Ensure directories exist
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.mkdirSync(getAuthDir(), { recursive: true, mode: 0o700 });

  // Generate fresh config
  const configContent = generateUnifiedConfigContent(effectivePort);
  fs.writeFileSync(configPath, configContent, { mode: 0o600 });

  return configPath;
}

/**
 * Check if config needs regeneration (version mismatch)
 * @returns true if config should be regenerated
 */
export function configNeedsRegeneration(): boolean {
  const configPath = getConfigPath();
  if (!fs.existsSync(configPath)) {
    return false; // Will be created on first use
  }

  try {
    const content = fs.readFileSync(configPath, 'utf-8');

    // Check for version marker
    const versionMatch = content.match(/CCS v(\d+)/);
    if (!versionMatch) {
      return true; // No version marker = old config
    }

    const configVersion = parseInt(versionMatch[1], 10);
    return configVersion < CLIPROXY_CONFIG_VERSION;
  } catch {
    return true; // Error reading = regenerate
  }
}

/**
 * Check if config exists for provider
 */
export function configExists(): boolean {
  return fs.existsSync(getConfigPath());
}

/**
 * Delete config file
 */
export function deleteConfig(): void {
  const configPath = getConfigPath();
  if (fs.existsSync(configPath)) {
    fs.unlinkSync(configPath);
  }
}

/**
 * Get path to user settings file for provider
 * Example: ~/.ccs/gemini.settings.json
 */
export function getProviderSettingsPath(provider: CLIProxyProvider): string {
  return path.join(getCcsDir(), `${provider}.settings.json`);
}

/**
 * Get environment variables for Claude CLI (bundled defaults)
 * Uses provider-specific endpoint (e.g., /api/provider/gemini) for explicit routing.
 * This enables concurrent gemini/codex usage - each session routes to its provider via URL path.
 */
export function getClaudeEnvVars(
  provider: CLIProxyProvider,
  port: number = CLIPROXY_DEFAULT_PORT
): NodeJS.ProcessEnv {
  const models = getModelMapping(provider);

  // Base env vars from config file (includes ANTHROPIC_MAX_TOKENS, etc.)
  const baseEnvVars = getEnvVarsFromConfig(provider);

  // Core env vars that we always set dynamically
  const coreEnvVars = {
    // Provider-specific endpoint - routes to correct provider via URL path
    ANTHROPIC_BASE_URL: `http://127.0.0.1:${port}/api/provider/${provider}`,
    ANTHROPIC_AUTH_TOKEN: CCS_INTERNAL_API_KEY,
    ANTHROPIC_MODEL: models.claudeModel,
    ANTHROPIC_DEFAULT_OPUS_MODEL: models.opusModel || models.claudeModel,
    ANTHROPIC_DEFAULT_SONNET_MODEL: models.sonnetModel || models.claudeModel,
    ANTHROPIC_DEFAULT_HAIKU_MODEL: models.haikuModel || models.claudeModel,
  };

  // Filter out core env vars from base config to avoid conflicts
  const {
    ANTHROPIC_BASE_URL: _baseUrl,
    ANTHROPIC_AUTH_TOKEN: _authToken,
    ANTHROPIC_MODEL: _model,
    ANTHROPIC_DEFAULT_OPUS_MODEL: _opusModel,
    ANTHROPIC_DEFAULT_SONNET_MODEL: _sonnetModel,
    ANTHROPIC_DEFAULT_HAIKU_MODEL: _haikuModel,
    ...additionalEnvVars
  } = baseEnvVars;

  // Merge core env vars with additional env vars from base config
  return {
    ...coreEnvVars,
    ...additionalEnvVars, // Includes ANTHROPIC_MAX_TOKENS, etc.
  };
}

/**
 * Get global env vars to inject into all third-party profiles.
 * Returns empty object if disabled.
 */
function getGlobalEnvVars(): Record<string, string> {
  const globalEnvConfig = getGlobalEnvConfig();
  if (!globalEnvConfig.enabled) {
    return {};
  }
  return globalEnvConfig.env;
}

/**
 * Get effective environment variables for provider
 *
 * Priority order:
 * 1. Custom settings path (for user-defined CLIProxy variants)
 * 2. User settings file (~/.ccs/{provider}.settings.json) if exists
 * 3. Bundled defaults from PROVIDER_CONFIGS
 *
 * All results are merged with global_env vars (telemetry/reporting disables).
 * User takes full responsibility for custom settings.
 */
export function getEffectiveEnvVars(
  provider: CLIProxyProvider,
  port: number = CLIPROXY_DEFAULT_PORT,
  customSettingsPath?: string
): NodeJS.ProcessEnv {
  // Get global env vars (DISABLE_TELEMETRY, etc.)
  const globalEnv = getGlobalEnvVars();

  // Priority 1: Custom settings path (for user-defined variants)
  if (customSettingsPath) {
    const expandedPath = customSettingsPath.replace(/^~/, require('os').homedir());
    if (fs.existsSync(expandedPath)) {
      try {
        const content = fs.readFileSync(expandedPath, 'utf-8');
        const settings: ProviderSettings = JSON.parse(content);

        if (settings.env && typeof settings.env === 'object') {
          // Custom variant settings found - merge with global env
          return { ...globalEnv, ...settings.env };
        }
      } catch {
        // Invalid JSON - fall through to provider defaults
        console.warn(warn(`Invalid settings file: ${customSettingsPath}`));
      }
    } else {
      console.warn(warn(`Settings file not found: ${customSettingsPath}`));
    }
  }

  // Priority 2: Default provider settings file
  const settingsPath = getProviderSettingsPath(provider);

  // Check for user override file
  if (fs.existsSync(settingsPath)) {
    try {
      const content = fs.readFileSync(settingsPath, 'utf-8');
      const settings: ProviderSettings = JSON.parse(content);

      if (settings.env && typeof settings.env === 'object') {
        // User override found - merge with global env
        return { ...globalEnv, ...settings.env };
      }
    } catch {
      // Invalid JSON or structure - fall through to defaults
      // Silent fallback: don't spam errors for broken user files
    }
  }

  // No override or invalid - use bundled defaults merged with global env
  return { ...globalEnv, ...getClaudeEnvVars(provider, port) };
}

/**
 * Copy bundled settings template to user directory if not exists
 * Called during installation/first run
 */
export function ensureProviderSettings(provider: CLIProxyProvider): void {
  const settingsPath = getProviderSettingsPath(provider);

  // Only create if doesn't exist (preserve user edits)
  if (fs.existsSync(settingsPath)) {
    return;
  }

  // Generate default settings from PROVIDER_CONFIGS
  const envVars = getClaudeEnvVars(provider);
  const settings: ProviderSettings = { env: envVars };

  // Ensure directory exists
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });

  // Write with restricted permissions
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n', {
    mode: 0o600,
  });
}

/**
 * Get environment variables for remote proxy mode.
 * Uses the remote proxy's provider endpoint as the base URL.
 *
 * @param provider CLIProxy provider (gemini, codex, agy, qwen, iflow)
 * @param remoteConfig Remote proxy connection details
 * @returns Environment variables for Claude CLI
 */
export function getRemoteEnvVars(
  provider: CLIProxyProvider,
  remoteConfig: { host: string; port: number; protocol: 'http' | 'https'; authToken?: string }
): Record<string, string> {
  const baseUrl = `${remoteConfig.protocol}://${remoteConfig.host}:${remoteConfig.port}/api/provider/${provider}`;
  const models = getModelMapping(provider);

  // Get global env vars (DISABLE_TELEMETRY, etc.)
  const globalEnv = getGlobalEnvVars();

  // Get additional env vars from base config (ANTHROPIC_MAX_TOKENS, etc.)
  const baseEnvVars = getEnvVarsFromConfig(provider);

  // Filter out core env vars from base config to avoid conflicts
  const {
    ANTHROPIC_BASE_URL: _baseUrl,
    ANTHROPIC_AUTH_TOKEN: _authToken,
    ANTHROPIC_MODEL: _model,
    ANTHROPIC_DEFAULT_OPUS_MODEL: _opusModel,
    ANTHROPIC_DEFAULT_SONNET_MODEL: _sonnetModel,
    ANTHROPIC_DEFAULT_HAIKU_MODEL: _haikuModel,
    ...additionalEnvVars
  } = baseEnvVars;

  const env: Record<string, string> = {
    ...globalEnv,
    ...additionalEnvVars,
    ANTHROPIC_BASE_URL: baseUrl,
    ANTHROPIC_AUTH_TOKEN: remoteConfig.authToken || CCS_INTERNAL_API_KEY,
    ANTHROPIC_MODEL: models.claudeModel,
    ANTHROPIC_DEFAULT_OPUS_MODEL: models.opusModel || models.claudeModel,
    ANTHROPIC_DEFAULT_SONNET_MODEL: models.sonnetModel || models.claudeModel,
    ANTHROPIC_DEFAULT_HAIKU_MODEL: models.haikuModel || models.claudeModel,
  };

  return env;
}
