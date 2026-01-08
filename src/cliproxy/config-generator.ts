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
import { expandPath } from '../utils/helpers';
import { warn } from '../utils/ui';
import { CLIProxyProvider, ProviderConfig, ProviderModelMapping } from './types';
import { getModelMappingFromConfig, getEnvVarsFromConfig } from './base-config-loader';
import {
  loadOrCreateUnifiedConfig,
  getGlobalEnvConfig,
  getThinkingConfig,
} from '../config/unified-config-loader';
import { getEffectiveApiKey, getEffectiveManagementSecret } from './auth-token-manager';
import { supportsThinking } from './model-catalog';
import { ThinkingConfig } from '../config/unified-config-types';
import { validateThinking } from './thinking-validator';

/** Settings file structure for user overrides */
interface ProviderSettings {
  env: NodeJS.ProcessEnv;
}

/**
 * Detect current tier from model name.
 * Looks at ANTHROPIC_MODEL to determine if using opus/sonnet/haiku tier.
 */
export type ModelTier = 'opus' | 'sonnet' | 'haiku';

/**
 * Detect tier from model name.
 * Returns 'sonnet' as default if unclear.
 */
export function detectTierFromModel(modelName: string): ModelTier {
  const lower = modelName.toLowerCase();
  if (lower.includes('opus')) return 'opus';
  if (lower.includes('haiku')) return 'haiku';
  return 'sonnet'; // Default to sonnet (most common)
}

/**
 * Apply thinking suffix to model name.
 * CLIProxyAPIPlus parses suffixes like model(level) or model(budget).
 *
 * @param model - Base model name
 * @param thinkingValue - Level name (e.g., 'high') or numeric budget
 * @returns Model name with thinking suffix, e.g., "gemini-3-pro-preview(high)"
 *
 * @note Paren matching only handles one level. Nested parens like "model(foo)(8192)"
 *       will be treated as already having suffix and returned unchanged.
 */
export function applyThinkingSuffix(model: string, thinkingValue: string | number): string {
  // Don't apply if already has suffix
  // NOTE: This only detects ANY paren pair, not proper nesting (e.g., "model(foo)(8192)" passes through)
  if (model.includes('(') && model.includes(')')) {
    return model;
  }
  return `${model}(${thinkingValue})`;
}

/**
 * Get thinking value for tier based on config.
 * Respects provider-specific overrides if configured.
 */
export function getThinkingValueForTier(
  tier: ModelTier,
  provider: CLIProxyProvider,
  thinkingConfig: ThinkingConfig
): string {
  // Check provider-specific override first
  const providerOverride = thinkingConfig.provider_overrides?.[provider]?.[tier];
  if (providerOverride) {
    return providerOverride;
  }
  // Fall back to global tier default (with null guard)
  return thinkingConfig.tier_defaults?.[tier] ?? 'medium';
}

/**
 * Apply thinking configuration to env vars.
 * Modifies ANTHROPIC_MODEL and tier models with thinking suffixes.
 *
 * @param envVars - Environment variables to modify
 * @param provider - CLIProxy provider
 * @param thinkingOverride - Optional CLI override (takes priority over config)
 * @returns Modified env vars with thinking suffixes applied
 */
export function applyThinkingConfig(
  envVars: NodeJS.ProcessEnv,
  provider: CLIProxyProvider,
  thinkingOverride?: string | number
): NodeJS.ProcessEnv {
  const thinkingConfig = getThinkingConfig();
  const result = { ...envVars };

  // Check if thinking is off
  if (thinkingConfig.mode === 'off' && thinkingOverride === undefined) {
    return result;
  }

  // Get base model to check thinking support
  const baseModel = result.ANTHROPIC_MODEL || '';
  if (!supportsThinking(provider, baseModel)) {
    return result; // Model doesn't support thinking
  }

  // Determine thinking value to use
  let thinkingValue: string | number;

  if (thinkingOverride !== undefined) {
    // CLI override takes priority
    thinkingValue = thinkingOverride;
  } else if (thinkingConfig.mode === 'manual' && thinkingConfig.override !== undefined) {
    // Config manual mode with override
    thinkingValue = thinkingConfig.override;
  } else if (thinkingConfig.mode === 'auto') {
    // Auto mode: detect tier and apply default
    const tier = detectTierFromModel(baseModel);
    thinkingValue = getThinkingValueForTier(tier, provider, thinkingConfig);
  } else {
    return result; // No thinking to apply
  }

  // Validate thinking value against model capabilities
  const validation = validateThinking(provider, baseModel, thinkingValue);
  if (validation.warning && thinkingConfig.show_warnings !== false) {
    console.warn(warn(validation.warning));
  }
  thinkingValue = validation.value;

  // If validation says off, don't apply suffix
  if (thinkingValue === 'off') {
    return result;
  }

  // Apply thinking suffix to main model
  if (result.ANTHROPIC_MODEL) {
    result.ANTHROPIC_MODEL = applyThinkingSuffix(result.ANTHROPIC_MODEL, thinkingValue);
  }

  // Apply to tier models if they support thinking
  const tierModels = [
    'ANTHROPIC_DEFAULT_OPUS_MODEL',
    'ANTHROPIC_DEFAULT_SONNET_MODEL',
    'ANTHROPIC_DEFAULT_HAIKU_MODEL',
  ] as const;

  for (const tierVar of tierModels) {
    const model = result[tierVar];
    if (model && supportsThinking(provider, model)) {
      // Get tier-specific thinking value
      const tier = tierVar.includes('OPUS')
        ? 'opus'
        : tierVar.includes('SONNET')
          ? 'sonnet'
          : 'haiku';
      const tierThinkingValue =
        thinkingOverride ?? getThinkingValueForTier(tier, provider, thinkingConfig);
      result[tierVar] = applyThinkingSuffix(model, tierThinkingValue);
    }
  }

  return result;
}

/**
 * Validate port is a valid positive integer (1-65535).
 * Returns default port if invalid.
 *
 * @param port - Port number to validate
 * @returns Valid port or CLIPROXY_DEFAULT_PORT (8317) if invalid
 */
export function validatePort(port: number | undefined): number {
  if (port === undefined || port === null) {
    return CLIPROXY_DEFAULT_PORT;
  }
  if (!Number.isFinite(port) || port < 1 || port > 65535 || !Number.isInteger(port)) {
    return CLIPROXY_DEFAULT_PORT;
  }
  return port;
}

/**
 * Ensure required CLIProxy env vars are present.
 * Falls back to bundled defaults if missing from user settings.
 * This prevents 404 errors when users forget to set BASE_URL/AUTH_TOKEN.
 */
function ensureRequiredEnvVars(
  envVars: NodeJS.ProcessEnv,
  provider: CLIProxyProvider,
  port: number
): NodeJS.ProcessEnv {
  const validPort = validatePort(port);
  const result = { ...envVars };
  const defaults = getClaudeEnvVars(provider, validPort);

  // Fill in missing required vars from defaults
  if (!result.ANTHROPIC_BASE_URL?.trim()) {
    result.ANTHROPIC_BASE_URL = defaults.ANTHROPIC_BASE_URL;
  }
  if (!result.ANTHROPIC_AUTH_TOKEN?.trim()) {
    result.ANTHROPIC_AUTH_TOKEN = defaults.ANTHROPIC_AUTH_TOKEN;
  }

  return result;
}

/** Default CLIProxy port */
export const CLIPROXY_DEFAULT_PORT = 8317;

/**
 * Normalize protocol to lowercase and validate.
 * Handles runtime case sensitivity (e.g., 'HTTPS' → 'https').
 * Defaults to 'http' for invalid values.
 */
export function normalizeProtocol(protocol: string | undefined): 'http' | 'https' {
  if (!protocol) return 'http';
  const normalized = protocol.toLowerCase();
  if (normalized === 'https') return 'https';
  if (normalized === 'http') return 'http';
  // Invalid protocol (e.g., 'ftp') - default to http
  return 'http';
}

/**
 * Validate and sanitize port number for remote connections.
 * Returns undefined for invalid ports (letting caller use default).
 * Valid range: 1-65535, must be integer.
 */
export function validateRemotePort(port: number | undefined): number | undefined {
  if (port === undefined || port === null) return undefined;
  if (typeof port !== 'number' || !Number.isInteger(port)) return undefined;
  if (port <= 0 || port > 65535) return undefined;
  return port;
}

/**
 * Get default port for remote CLIProxyAPI based on protocol.
 * - HTTP: 8317 (CLIProxyAPI default)
 * - HTTPS: 443 (standard SSL port)
 */
export function getRemoteDefaultPort(protocol: 'http' | 'https'): number {
  return protocol === 'https' ? 443 : CLIPROXY_DEFAULT_PORT;
}

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
 * v4: Added Kiro (AWS) and GitHub Copilot providers
 */
export const CLIPROXY_CONFIG_VERSION = 4;

/** Provider display names (static metadata) */
const PROVIDER_DISPLAY_NAMES: Record<CLIProxyProvider, string> = {
  gemini: 'Gemini',
  codex: 'Codex',
  agy: 'Antigravity',
  qwen: 'Qwen Code',
  iflow: 'iFlow',
  kiro: 'Kiro (AWS)',
  ghcp: 'GitHub Copilot (OAuth)',
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
 * Get config file path for a specific port.
 * Default port uses config.yaml, others use config-{port}.yaml.
 */
export function getConfigPathForPort(port: number): string {
  if (port === CLIPROXY_DEFAULT_PORT) {
    return path.join(getCliproxyDir(), 'config.yaml');
  }
  return path.join(getCliproxyDir(), `config-${port}.yaml`);
}

/**
 * Get CLIProxy config file path (default port)
 * Named distinctly from config-manager's getConfigPath to avoid confusion.
 */
export function getCliproxyConfigPath(): string {
  return getConfigPathForPort(CLIPROXY_DEFAULT_PORT);
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
 *
 * @param port - Server port (default: 8317)
 * @param userApiKeys - User-added API keys to preserve (default: [])
 */
function generateUnifiedConfigContent(
  port: number = CLIPROXY_DEFAULT_PORT,
  userApiKeys: string[] = []
): string {
  const authDir = getAuthDir(); // Base auth dir - CLIProxyAPI scans subdirectories
  // Convert Windows backslashes to forward slashes for YAML compatibility
  const authDirNormalized = authDir.split(path.sep).join('/');

  // Get logging settings from user config (disabled by default)
  const { loggingToFile, requestLog } = getLoggingSettings();

  // Get effective auth tokens (respects user customization)
  const effectiveApiKey = getEffectiveApiKey();
  const effectiveSecret = getEffectiveManagementSecret();

  // Build api-keys section with internal key + preserved user keys
  const allApiKeys = [effectiveApiKey, ...userApiKeys];
  const apiKeysYaml = allApiKeys.map((key) => `  - "${key}"`).join('\n');

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
  secret-key: "${effectiveSecret}"
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

# API keys for CCS and user-added external requests
# NOTE: User-added keys are preserved across CCS updates (fix for issue #200)
api-keys:
${apiKeysYaml}

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
  const configPath = getConfigPathForPort(port);

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
 * Parse user-added API keys from existing config content.
 * Extracts all keys except the internal CCS key for preservation.
 *
 * @param content - Existing config.yaml content
 * @returns Array of user-added API keys (excludes CCS_INTERNAL_API_KEY)
 */
export function parseUserApiKeys(content: string): string[] {
  const userKeys: string[] = [];

  // Find the api-keys section by looking for lines starting with "  - " after "api-keys:"
  // Normalize line endings first
  const normalizedContent = content.replace(/\r\n/g, '\n');

  // Find the api-keys: line and extract all subsequent key entries
  const lines = normalizedContent.split('\n');
  let inApiKeysSection = false;

  for (const line of lines) {
    // Check if this is the start of api-keys section
    if (line.match(/^api-keys:\s*$/)) {
      inApiKeysSection = true;
      continue;
    }

    // If we're in the api-keys section, look for key entries
    if (inApiKeysSection) {
      // Key entries are indented with "  - " or similar
      const keyMatch = line.match(/^\s+-\s*"([^"]*)"/);
      if (keyMatch) {
        const key = keyMatch[1];
        // Exclude the internal CCS key and empty strings
        if (key && key !== CCS_INTERNAL_API_KEY) {
          userKeys.push(key);
        }
      } else if (line.match(/^\S/) && line.trim().length > 0) {
        // Non-indented line that's not empty means we've left the api-keys section
        break;
      }
      // Continue for blank lines or other indented content
    }
  }

  return userKeys;
}

/**
 * Force regenerate config.yaml with latest settings.
 * Preserves user-added API keys and port settings.
 *
 * @param port - Default port to use if not found in existing config
 * @returns Path to new config file
 */
export function regenerateConfig(port: number = CLIPROXY_DEFAULT_PORT): string {
  const configPath = getConfigPathForPort(port);

  // Preserve user settings from existing config
  let effectivePort = port;
  let userApiKeys: string[] = [];

  if (fs.existsSync(configPath)) {
    try {
      const content = fs.readFileSync(configPath, 'utf-8');

      // Preserve port setting
      const portMatch = content.match(/^port:\s*(\d+)/m);
      if (portMatch) {
        effectivePort = parseInt(portMatch[1], 10);
      }

      // Preserve user-added API keys (fix for issue #200)
      userApiKeys = parseUserApiKeys(content);
    } catch {
      // Use defaults if reading fails
    }
    // Delete existing config
    fs.unlinkSync(configPath);
  }

  // Ensure directories exist
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.mkdirSync(getAuthDir(), { recursive: true, mode: 0o700 });

  // Generate fresh config with preserved user API keys
  const configContent = generateUnifiedConfigContent(effectivePort, userApiKeys);
  fs.writeFileSync(configPath, configContent, { mode: 0o600 });

  return configPath;
}

/**
 * Check if config needs regeneration (version mismatch)
 * @returns true if config should be regenerated
 */
export function configNeedsRegeneration(): boolean {
  const configPath = getCliproxyConfigPath();
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
 * Check if config exists for port
 */
export function configExists(port: number = CLIPROXY_DEFAULT_PORT): boolean {
  return fs.existsSync(getConfigPathForPort(port));
}

/**
 * Delete config file for specific port
 */
export function deleteConfigForPort(port: number): void {
  const configPath = getConfigPathForPort(port);
  if (fs.existsSync(configPath)) {
    fs.unlinkSync(configPath);
  }
}

/**
 * Delete config file (default port)
 */
export function deleteConfig(): void {
  deleteConfigForPort(CLIPROXY_DEFAULT_PORT);
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
    ANTHROPIC_AUTH_TOKEN: getEffectiveApiKey(),
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

/** Remote proxy configuration for URL rewriting */
interface RemoteProxyRewriteConfig {
  host: string;
  port?: number;
  protocol: 'http' | 'https';
  authToken?: string;
}

/**
 * Rewrite localhost URLs to remote server URLs.
 * Handles various localhost patterns: 127.0.0.1, localhost, 0.0.0.0
 */
function rewriteLocalhostUrls(
  envVars: NodeJS.ProcessEnv,
  provider: CLIProxyProvider,
  remoteConfig: RemoteProxyRewriteConfig
): NodeJS.ProcessEnv {
  const result = { ...envVars };
  const baseUrl = result.ANTHROPIC_BASE_URL;

  if (!baseUrl) return result;

  // Check if URL points to localhost (127.0.0.1, localhost, 0.0.0.0)
  const localhostPattern = /^https?:\/\/(127\.0\.0\.1|localhost|0\.0\.0\.0)(:\d+)?/i;
  if (!localhostPattern.test(baseUrl)) return result;

  // Build remote URL with smart port handling (8317 for HTTP, 443 for HTTPS)
  // Validate port and normalize protocol for defensive handling
  const normalizedProtocol = normalizeProtocol(remoteConfig.protocol);
  const validatedPort = validateRemotePort(remoteConfig.port);
  const effectivePort = validatedPort ?? getRemoteDefaultPort(normalizedProtocol);
  // Omit port suffix for standard web ports (80/443) for cleaner URLs
  const standardWebPort = normalizedProtocol === 'https' ? 443 : 80;
  const portSuffix = effectivePort === standardWebPort ? '' : `:${effectivePort}`;
  const remoteBaseUrl = `${normalizedProtocol}://${remoteConfig.host}${portSuffix}/api/provider/${provider}`;

  result.ANTHROPIC_BASE_URL = remoteBaseUrl;

  // Update auth token if provided
  if (remoteConfig.authToken) {
    result.ANTHROPIC_AUTH_TOKEN = remoteConfig.authToken;
  }

  return result;
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
 *
 * If remoteRewriteConfig is provided, localhost URLs are rewritten to remote server.
 */
export function getEffectiveEnvVars(
  provider: CLIProxyProvider,
  port: number = CLIPROXY_DEFAULT_PORT,
  customSettingsPath?: string,
  remoteRewriteConfig?: RemoteProxyRewriteConfig
): NodeJS.ProcessEnv {
  // Get global env vars (DISABLE_TELEMETRY, etc.)
  const globalEnv = getGlobalEnvVars();

  let envVars: NodeJS.ProcessEnv;

  // Priority 1: Custom settings path (for user-defined variants)
  if (customSettingsPath) {
    const expandedPath = expandPath(customSettingsPath);
    if (fs.existsSync(expandedPath)) {
      try {
        const content = fs.readFileSync(expandedPath, 'utf-8');
        const settings: ProviderSettings = JSON.parse(content);

        if (settings.env && typeof settings.env === 'object') {
          // Custom variant settings found - merge with global env
          envVars = { ...globalEnv, ...settings.env };
          // Ensure required vars are present (fall back to defaults if missing)
          envVars = ensureRequiredEnvVars(envVars, provider, port);
          // Apply remote rewrite if configured
          if (remoteRewriteConfig) {
            envVars = rewriteLocalhostUrls(envVars, provider, remoteRewriteConfig);
          }
          return envVars;
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
        envVars = { ...globalEnv, ...settings.env };
        // Ensure required vars are present (fall back to defaults if missing)
        envVars = ensureRequiredEnvVars(envVars, provider, port);
        // Apply remote rewrite if configured
        if (remoteRewriteConfig) {
          envVars = rewriteLocalhostUrls(envVars, provider, remoteRewriteConfig);
        }
        return envVars;
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
 * Respects user model settings from custom settings path or provider settings file.
 *
 * @param provider CLIProxy provider (gemini, codex, agy, qwen, iflow)
 * @param remoteConfig Remote proxy connection details
 * @param customSettingsPath Optional path to user's custom settings file
 * @returns Environment variables for Claude CLI
 */
export function getRemoteEnvVars(
  provider: CLIProxyProvider,
  remoteConfig: { host: string; port?: number; protocol: 'http' | 'https'; authToken?: string },
  customSettingsPath?: string
): Record<string, string> {
  // Build URL with smart port handling (8317 for HTTP, 443 for HTTPS)
  // Validate port and normalize protocol for defensive handling
  const normalizedProtocol = normalizeProtocol(remoteConfig.protocol);
  const validatedPort = validateRemotePort(remoteConfig.port);
  const effectivePort = validatedPort ?? getRemoteDefaultPort(normalizedProtocol);
  // Omit port suffix for standard web ports (80/443) for cleaner URLs
  const standardWebPort = normalizedProtocol === 'https' ? 443 : 80;
  const portSuffix = effectivePort === standardWebPort ? '' : `:${effectivePort}`;
  const baseUrl = `${normalizedProtocol}://${remoteConfig.host}${portSuffix}/api/provider/${provider}`;

  // Get global env vars (DISABLE_TELEMETRY, etc.)
  const globalEnv = getGlobalEnvVars();

  // Load user settings with priority: custom path > user settings file > base config
  let userEnvVars: Record<string, string> = {};

  // Priority 1: Custom settings path (for user-defined variants)
  if (customSettingsPath) {
    const expandedPath = expandPath(customSettingsPath);
    if (fs.existsSync(expandedPath)) {
      try {
        const content = fs.readFileSync(expandedPath, 'utf-8');
        const settings: ProviderSettings = JSON.parse(content);
        if (settings.env && typeof settings.env === 'object') {
          userEnvVars = settings.env as Record<string, string>;
        }
      } catch {
        // Invalid JSON - fall through to provider defaults
        console.warn(warn(`Invalid settings file: ${customSettingsPath}`));
      }
    }
  }

  // Priority 2: Default provider settings file (~/.ccs/{provider}.settings.json)
  if (Object.keys(userEnvVars).length === 0) {
    const settingsPath = getProviderSettingsPath(provider);
    if (fs.existsSync(settingsPath)) {
      try {
        const content = fs.readFileSync(settingsPath, 'utf-8');
        const settings: ProviderSettings = JSON.parse(content);
        if (settings.env && typeof settings.env === 'object') {
          userEnvVars = settings.env as Record<string, string>;
        }
      } catch {
        // Invalid JSON - fall through to base config
      }
    }
  }

  // Priority 3: Base config defaults
  if (Object.keys(userEnvVars).length === 0) {
    const models = getModelMapping(provider);
    const baseEnvVars = getEnvVarsFromConfig(provider);
    // Filter out URL/auth from base config (we'll set those from remote config)
    const {
      ANTHROPIC_BASE_URL: _baseUrl,
      ANTHROPIC_AUTH_TOKEN: _authToken,
      ...additionalEnvVars
    } = baseEnvVars;
    userEnvVars = {
      ...additionalEnvVars,
      ANTHROPIC_MODEL: models.claudeModel,
      ANTHROPIC_DEFAULT_OPUS_MODEL: models.opusModel || models.claudeModel,
      ANTHROPIC_DEFAULT_SONNET_MODEL: models.sonnetModel || models.claudeModel,
      ANTHROPIC_DEFAULT_HAIKU_MODEL: models.haikuModel || models.claudeModel,
    };
  }

  // Build final env: global + user settings + remote URL/auth override
  const env: Record<string, string> = {
    ...globalEnv,
    ...userEnvVars,
    // Always override URL and auth token with remote config
    ANTHROPIC_BASE_URL: baseUrl,
    ANTHROPIC_AUTH_TOKEN: remoteConfig.authToken || getEffectiveApiKey(),
  };

  return env;
}
