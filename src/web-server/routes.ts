/**
 * REST API Routes (Phase 03)
 *
 * Implements CRUD operations for profiles, cliproxy variants, and accounts.
 */

import { Router, Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { getCcsDir, getConfigPath, loadConfig, loadSettings } from '../utils/config-manager';
import { Config, Settings } from '../types/config';
import { expandPath } from '../utils/helpers';
import { runHealthChecks, fixHealthIssue } from './health-service';
import {
  getAllAuthStatus,
  getOAuthConfig,
  initializeAccounts,
  triggerOAuth,
} from '../cliproxy/auth-handler';
import {
  fetchCliproxyStats,
  fetchCliproxyModels,
  isCliproxyRunning,
} from '../cliproxy/stats-fetcher';
import {
  listOpenAICompatProviders,
  getOpenAICompatProvider,
  addOpenAICompatProvider,
  updateOpenAICompatProvider,
  removeOpenAICompatProvider,
  OPENROUTER_TEMPLATE,
  TOGETHER_TEMPLATE,
} from '../cliproxy/openai-compat-manager';
import {
  getAllAccountsSummary,
  getProviderAccounts,
  setDefaultAccount as setDefaultAccountFn,
  removeAccount as removeAccountFn,
} from '../cliproxy/account-manager';
import type { CLIProxyProvider } from '../cliproxy/types';
import { getClaudeEnvVars } from '../cliproxy/config-generator';
// Unified config imports
import {
  hasUnifiedConfig,
  loadUnifiedConfig,
  saveUnifiedConfig,
  getConfigFormat,
} from '../config/unified-config-loader';
import {
  needsMigration,
  migrate,
  rollback,
  getBackupDirectories,
} from '../config/migration-manager';
import { getProfileSecrets, setProfileSecrets } from '../config/secrets-manager';
import { isUnifiedConfig } from '../config/unified-config-types';
import { isSensitiveKey, maskSensitiveValue } from '../utils/sensitive-keys';

export const apiRoutes = Router();

/**
 * Helper: Read config safely with fallback
 */
function readConfigSafe(): Config {
  try {
    return loadConfig();
  } catch {
    return { profiles: {} };
  }
}

/**
 * Helper: Write config atomically
 */
function writeConfig(config: Config): void {
  const configPath = getConfigPath();
  const tempPath = configPath + '.tmp';
  fs.writeFileSync(tempPath, JSON.stringify(config, null, 2) + '\n');
  fs.renameSync(tempPath, configPath);
}

/**
 * Helper: Check if profile is configured (has valid settings file)
 */
function isConfigured(profileName: string, config: Config): boolean {
  const settingsPath = config.profiles[profileName];
  if (!settingsPath) return false;

  try {
    const expandedPath = expandPath(settingsPath);
    if (!fs.existsSync(expandedPath)) return false;

    const settings = loadSettings(expandedPath);
    return !!(settings.env?.ANTHROPIC_BASE_URL && settings.env?.ANTHROPIC_AUTH_TOKEN);
  } catch {
    return false;
  }
}

/** Model mapping for API profiles */
interface ModelMapping {
  model?: string;
  opusModel?: string;
  sonnetModel?: string;
  haikuModel?: string;
}

/**
 * Helper: Create settings file for profile
 */
function createSettingsFile(
  name: string,
  baseUrl: string,
  apiKey: string,
  models: ModelMapping = {}
): string {
  const settingsPath = path.join(getCcsDir(), `${name}.settings.json`);
  const { model, opusModel, sonnetModel, haikuModel } = models;

  const settings: Settings = {
    env: {
      ANTHROPIC_BASE_URL: baseUrl,
      ANTHROPIC_AUTH_TOKEN: apiKey,
      ...(model && { ANTHROPIC_MODEL: model }),
      ...(opusModel && { ANTHROPIC_DEFAULT_OPUS_MODEL: opusModel }),
      ...(sonnetModel && { ANTHROPIC_DEFAULT_SONNET_MODEL: sonnetModel }),
      ...(haikuModel && { ANTHROPIC_DEFAULT_HAIKU_MODEL: haikuModel }),
    },
  };

  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
  return `~/.ccs/${name}.settings.json`;
}

/**
 * Helper: Update settings file
 */
function updateSettingsFile(
  name: string,
  updates: {
    baseUrl?: string;
    apiKey?: string;
    model?: string;
    opusModel?: string;
    sonnetModel?: string;
    haikuModel?: string;
  }
): void {
  const settingsPath = path.join(getCcsDir(), `${name}.settings.json`);

  if (!fs.existsSync(settingsPath)) {
    throw new Error('Settings file not found');
  }

  const settings = loadSettings(settingsPath);

  if (updates.baseUrl) {
    settings.env = settings.env || {};
    settings.env.ANTHROPIC_BASE_URL = updates.baseUrl;
  }

  if (updates.apiKey) {
    settings.env = settings.env || {};
    settings.env.ANTHROPIC_AUTH_TOKEN = updates.apiKey;
  }

  if (updates.model !== undefined) {
    settings.env = settings.env || {};
    if (updates.model) {
      settings.env.ANTHROPIC_MODEL = updates.model;
    } else {
      delete settings.env.ANTHROPIC_MODEL;
    }
  }

  // Handle model mapping fields
  if (updates.opusModel !== undefined) {
    settings.env = settings.env || {};
    if (updates.opusModel) {
      settings.env.ANTHROPIC_DEFAULT_OPUS_MODEL = updates.opusModel;
    } else {
      delete settings.env.ANTHROPIC_DEFAULT_OPUS_MODEL;
    }
  }

  if (updates.sonnetModel !== undefined) {
    settings.env = settings.env || {};
    if (updates.sonnetModel) {
      settings.env.ANTHROPIC_DEFAULT_SONNET_MODEL = updates.sonnetModel;
    } else {
      delete settings.env.ANTHROPIC_DEFAULT_SONNET_MODEL;
    }
  }

  if (updates.haikuModel !== undefined) {
    settings.env = settings.env || {};
    if (updates.haikuModel) {
      settings.env.ANTHROPIC_DEFAULT_HAIKU_MODEL = updates.haikuModel;
    } else {
      delete settings.env.ANTHROPIC_DEFAULT_HAIKU_MODEL;
    }
  }

  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
}

/**
 * Helper: Create cliproxy variant settings
 * Includes base URL and auth token for proper Claude CLI integration
 */
function createCliproxySettings(name: string, provider: CLIProxyProvider, model?: string): string {
  const settingsPath = path.join(getCcsDir(), `${name}.settings.json`);

  // Get base env vars from provider config (includes BASE_URL, AUTH_TOKEN)
  const baseEnv = getClaudeEnvVars(provider);

  const settings: Settings = {
    env: {
      ANTHROPIC_BASE_URL: baseEnv.ANTHROPIC_BASE_URL || '',
      ANTHROPIC_AUTH_TOKEN: baseEnv.ANTHROPIC_AUTH_TOKEN || '',
      ANTHROPIC_MODEL: model || (baseEnv.ANTHROPIC_MODEL as string) || '',
      ANTHROPIC_DEFAULT_OPUS_MODEL: model || (baseEnv.ANTHROPIC_DEFAULT_OPUS_MODEL as string) || '',
      ANTHROPIC_DEFAULT_SONNET_MODEL:
        model || (baseEnv.ANTHROPIC_DEFAULT_SONNET_MODEL as string) || '',
      ANTHROPIC_DEFAULT_HAIKU_MODEL:
        (baseEnv.ANTHROPIC_DEFAULT_HAIKU_MODEL as string) || model || '',
    },
  };

  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
  return `~/.ccs/${name}.settings.json`;
}

// ==================== Profile CRUD ====================

/**
 * GET /api/profiles - List all profiles
 */
apiRoutes.get('/profiles', (_req: Request, res: Response) => {
  const config = readConfigSafe();
  const profiles = Object.entries(config.profiles).map(([name, settingsPath]) => ({
    name,
    settingsPath,
    configured: isConfigured(name, config),
  }));

  res.json({ profiles });
});

/**
 * POST /api/profiles - Create new profile
 */
apiRoutes.post('/profiles', (req: Request, res: Response): void => {
  const { name, baseUrl, apiKey, model, opusModel, sonnetModel, haikuModel } = req.body;

  if (!name || !baseUrl || !apiKey) {
    res.status(400).json({ error: 'Missing required fields: name, baseUrl, apiKey' });
    return;
  }

  const config = readConfigSafe();

  if (config.profiles[name]) {
    res.status(409).json({ error: 'Profile already exists' });
    return;
  }

  // Ensure .ccs directory exists
  if (!fs.existsSync(getCcsDir())) {
    fs.mkdirSync(getCcsDir(), { recursive: true });
  }

  // Create settings file with model mapping
  const settingsPath = createSettingsFile(name, baseUrl, apiKey, {
    model,
    opusModel,
    sonnetModel,
    haikuModel,
  });

  // Update config
  config.profiles[name] = settingsPath;
  writeConfig(config);

  res.status(201).json({ name, settingsPath });
});

/**
 * PUT /api/profiles/:name - Update profile
 */
apiRoutes.put('/profiles/:name', (req: Request, res: Response): void => {
  const { name } = req.params;
  const { baseUrl, apiKey, model, opusModel, sonnetModel, haikuModel } = req.body;

  const config = readConfigSafe();

  if (!config.profiles[name]) {
    res.status(404).json({ error: 'Profile not found' });
    return;
  }

  try {
    updateSettingsFile(name, { baseUrl, apiKey, model, opusModel, sonnetModel, haikuModel });
    res.json({ name, updated: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * DELETE /api/profiles/:name - Delete profile
 */
apiRoutes.delete('/profiles/:name', (req: Request, res: Response): void => {
  const { name } = req.params;

  const config = readConfigSafe();

  if (!config.profiles[name]) {
    res.status(404).json({ error: 'Profile not found' });
    return;
  }

  // Delete settings file
  const settingsPath = path.join(getCcsDir(), `${name}.settings.json`);
  if (fs.existsSync(settingsPath)) {
    fs.unlinkSync(settingsPath);
  }

  // Remove from config
  delete config.profiles[name];
  writeConfig(config);

  res.json({ name, deleted: true });
});

// ==================== CLIProxy CRUD ====================

/**
 * GET /api/cliproxy - List cliproxy variants
 */
apiRoutes.get('/cliproxy', (_req: Request, res: Response) => {
  const config = readConfigSafe();
  const variants = Object.entries(config.cliproxy || {}).map(([name, variant]) => ({
    name,
    provider: variant.provider,
    settings: variant.settings,
    account: variant.account || 'default', // Include account field
  }));

  res.json({ variants });
});

/**
 * POST /api/cliproxy - Create cliproxy variant
 */
apiRoutes.post('/cliproxy', (req: Request, res: Response): void => {
  const { name, provider, model, account } = req.body;

  if (!name || !provider) {
    res.status(400).json({ error: 'Missing required fields: name, provider' });
    return;
  }

  const config = readConfigSafe();
  config.cliproxy = config.cliproxy || {};

  if (config.cliproxy[name]) {
    res.status(409).json({ error: 'Variant already exists' });
    return;
  }

  // Ensure .ccs directory exists
  if (!fs.existsSync(getCcsDir())) {
    fs.mkdirSync(getCcsDir(), { recursive: true });
  }

  // Create settings file for variant
  const settingsPath = createCliproxySettings(name, provider as CLIProxyProvider, model);

  // Include account if specified (defaults to 'default' if not provided)
  config.cliproxy[name] = {
    provider,
    settings: settingsPath,
    ...(account && { account }),
  };
  writeConfig(config);

  res.status(201).json({ name, provider, settings: settingsPath, account: account || 'default' });
});

/**
 * PUT /api/cliproxy/:name - Update cliproxy variant
 */
apiRoutes.put('/cliproxy/:name', (req: Request, res: Response): void => {
  const { name } = req.params;
  const { provider, account, model } = req.body;

  const config = readConfigSafe();

  if (!config.cliproxy?.[name]) {
    res.status(404).json({ error: 'Variant not found' });
    return;
  }

  const variant = config.cliproxy[name];

  // Update fields if provided
  if (provider) {
    variant.provider = provider;
  }
  if (account !== undefined) {
    if (account) {
      variant.account = account;
    } else {
      delete variant.account; // Remove account to use default
    }
  }

  // Update model in settings file if provided
  if (model !== undefined) {
    const settingsPath = path.join(getCcsDir(), `${name}.settings.json`);
    if (fs.existsSync(settingsPath)) {
      const settings = loadSettings(settingsPath);
      if (model) {
        settings.env = settings.env || {};
        settings.env.ANTHROPIC_MODEL = model;
      } else if (settings.env) {
        delete settings.env.ANTHROPIC_MODEL;
      }
      fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
    }
  }

  writeConfig(config);

  res.json({
    name,
    provider: variant.provider,
    account: variant.account || 'default',
    settings: variant.settings,
    updated: true,
  });
});

/**
 * DELETE /api/cliproxy/:name - Delete cliproxy variant
 */
apiRoutes.delete('/cliproxy/:name', (req: Request, res: Response): void => {
  const { name } = req.params;

  const config = readConfigSafe();

  if (!config.cliproxy?.[name]) {
    res.status(404).json({ error: 'Variant not found' });
    return;
  }

  // Delete settings file
  const settingsPath = path.join(getCcsDir(), `${name}.settings.json`);
  if (fs.existsSync(settingsPath)) {
    fs.unlinkSync(settingsPath);
  }

  delete config.cliproxy[name];
  writeConfig(config);

  res.json({ name, deleted: true });
});

/**
 * GET /api/cliproxy/auth - Get auth status for built-in CLIProxy profiles
 */
apiRoutes.get('/cliproxy/auth', (_req: Request, res: Response) => {
  // Initialize accounts from existing tokens on first request
  initializeAccounts();

  const statuses = getAllAuthStatus();

  const authStatus = statuses.map((status) => {
    const oauthConfig = getOAuthConfig(status.provider);
    return {
      provider: status.provider,
      displayName: oauthConfig.displayName,
      authenticated: status.authenticated,
      lastAuth: status.lastAuth?.toISOString() || null,
      tokenFiles: status.tokenFiles.length,
      accounts: status.accounts,
      defaultAccount: status.defaultAccount,
    };
  });

  res.json({ authStatus });
});

// ==================== Account Management (Multi-Account Support) ====================

/**
 * GET /api/cliproxy/accounts - Get all accounts across all providers
 */
apiRoutes.get('/cliproxy/accounts', (_req: Request, res: Response) => {
  // Initialize accounts from existing tokens
  initializeAccounts();

  const accounts = getAllAccountsSummary();
  res.json({ accounts });
});

/**
 * GET /api/cliproxy/accounts/:provider - Get accounts for a specific provider
 */
apiRoutes.get('/cliproxy/accounts/:provider', (req: Request, res: Response): void => {
  const { provider } = req.params;

  // Validate provider
  const validProviders: CLIProxyProvider[] = ['gemini', 'codex', 'agy', 'qwen', 'iflow'];
  if (!validProviders.includes(provider as CLIProxyProvider)) {
    res.status(400).json({ error: `Invalid provider: ${provider}` });
    return;
  }

  const accounts = getProviderAccounts(provider as CLIProxyProvider);
  res.json({ provider, accounts });
});

/**
 * POST /api/cliproxy/accounts/:provider/default - Set default account for provider
 */
apiRoutes.post('/cliproxy/accounts/:provider/default', (req: Request, res: Response): void => {
  const { provider } = req.params;
  const { accountId } = req.body;

  if (!accountId) {
    res.status(400).json({ error: 'Missing required field: accountId' });
    return;
  }

  // Validate provider
  const validProviders: CLIProxyProvider[] = ['gemini', 'codex', 'agy', 'qwen', 'iflow'];
  if (!validProviders.includes(provider as CLIProxyProvider)) {
    res.status(400).json({ error: `Invalid provider: ${provider}` });
    return;
  }

  const success = setDefaultAccountFn(provider as CLIProxyProvider, accountId);

  if (success) {
    res.json({ provider, defaultAccount: accountId });
  } else {
    res.status(404).json({ error: 'Account not found' });
  }
});

/**
 * DELETE /api/cliproxy/accounts/:provider/:accountId - Remove an account
 */
apiRoutes.delete('/cliproxy/accounts/:provider/:accountId', (req: Request, res: Response): void => {
  const { provider, accountId } = req.params;

  // Validate provider
  const validProviders: CLIProxyProvider[] = ['gemini', 'codex', 'agy', 'qwen', 'iflow'];
  if (!validProviders.includes(provider as CLIProxyProvider)) {
    res.status(400).json({ error: `Invalid provider: ${provider}` });
    return;
  }

  const success = removeAccountFn(provider as CLIProxyProvider, accountId);

  if (success) {
    res.json({ provider, accountId, deleted: true });
  } else {
    res.status(404).json({ error: 'Account not found' });
  }
});

/**
 * POST /api/cliproxy/auth/:provider/start - Start OAuth flow for a provider
 * Opens browser for authentication and returns account info when complete
 */
apiRoutes.post(
  '/cliproxy/auth/:provider/start',
  async (req: Request, res: Response): Promise<void> => {
    const { provider } = req.params;
    const { nickname } = req.body;

    // Validate provider
    const validProviders: CLIProxyProvider[] = ['gemini', 'codex', 'agy', 'qwen', 'iflow'];
    if (!validProviders.includes(provider as CLIProxyProvider)) {
      res.status(400).json({ error: `Invalid provider: ${provider}` });
      return;
    }

    try {
      // Trigger OAuth flow - this opens browser and waits for completion
      const account = await triggerOAuth(provider as CLIProxyProvider, {
        add: true, // Always add mode from UI
        headless: false, // Force interactive mode
        nickname: nickname || undefined,
      });

      if (account) {
        res.json({
          success: true,
          account: {
            id: account.id,
            email: account.email,
            nickname: account.nickname,
            provider: account.provider,
            isDefault: account.isDefault,
          },
        });
      } else {
        res.status(400).json({ error: 'Authentication failed or was cancelled' });
      }
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }
);

// ==================== Settings (Phase 05) ====================

/**
 * Helper: Mask API keys in settings
 */
function maskApiKeys(settings: Settings): Settings {
  if (!settings.env) return settings;

  const masked = { ...settings, env: { ...settings.env } };

  for (const key of Object.keys(masked.env)) {
    if (isSensitiveKey(key)) {
      masked.env[key] = maskSensitiveValue(masked.env[key]);
    }
  }

  return masked;
}

/**
 * GET /api/settings/:profile - Get settings with masked API keys
 */
apiRoutes.get('/settings/:profile', (req: Request, res: Response): void => {
  const { profile } = req.params;
  const ccsDir = getCcsDir();
  const settingsPath = path.join(ccsDir, `${profile}.settings.json`);

  if (!fs.existsSync(settingsPath)) {
    res.status(404).json({ error: 'Settings not found' });
    return;
  }

  const stat = fs.statSync(settingsPath);
  const settings = loadSettings(settingsPath);

  // Mask API keys in response
  const masked = maskApiKeys(settings);

  res.json({
    profile,
    settings: masked,
    mtime: stat.mtime.getTime(),
    path: settingsPath,
  });
});

/**
 * GET /api/settings/:profile/raw - Get full settings (for editing)
 */
apiRoutes.get('/settings/:profile/raw', (req: Request, res: Response): void => {
  const { profile } = req.params;
  const ccsDir = getCcsDir();
  const settingsPath = path.join(ccsDir, `${profile}.settings.json`);

  if (!fs.existsSync(settingsPath)) {
    res.status(404).json({ error: 'Settings not found' });
    return;
  }

  const stat = fs.statSync(settingsPath);
  const settings = loadSettings(settingsPath);

  res.json({
    profile,
    settings,
    mtime: stat.mtime.getTime(),
    path: settingsPath,
  });
});

/**
 * PUT /api/settings/:profile - Update settings with conflict detection and backup
 */
apiRoutes.put('/settings/:profile', (req: Request, res: Response): void => {
  const { profile } = req.params;
  const { settings, expectedMtime } = req.body;
  const ccsDir = getCcsDir();
  const settingsPath = path.join(ccsDir, `${profile}.settings.json`);

  if (!fs.existsSync(settingsPath)) {
    res.status(404).json({ error: 'Settings not found' });
    return;
  }

  // Conflict detection
  const stat = fs.statSync(settingsPath);
  if (expectedMtime && stat.mtime.getTime() !== expectedMtime) {
    res.status(409).json({
      error: 'File modified externally',
      currentMtime: stat.mtime.getTime(),
    });
    return;
  }

  // Create backup
  const backupDir = path.join(ccsDir, 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupDir, `${profile}.${timestamp}.settings.json`);
  fs.copyFileSync(settingsPath, backupPath);

  // Write new settings atomically
  const tempPath = settingsPath + '.tmp';
  fs.writeFileSync(tempPath, JSON.stringify(settings, null, 2) + '\n');
  fs.renameSync(tempPath, settingsPath);

  const newStat = fs.statSync(settingsPath);
  res.json({
    profile,
    mtime: newStat.mtime.getTime(),
    backupPath,
  });
});

// ==================== Presets ====================

/**
 * GET /api/settings/:profile/presets - Get saved presets for a provider
 */
apiRoutes.get('/settings/:profile/presets', (req: Request, res: Response): void => {
  const { profile } = req.params;
  const ccsDir = getCcsDir();
  const settingsPath = path.join(ccsDir, `${profile}.settings.json`);

  if (!fs.existsSync(settingsPath)) {
    res.json({ presets: [] });
    return;
  }

  const settings = loadSettings(settingsPath);
  res.json({ presets: settings.presets || [] });
});

/**
 * POST /api/settings/:profile/presets - Create a new preset
 */
apiRoutes.post('/settings/:profile/presets', (req: Request, res: Response): void => {
  const { profile } = req.params;
  const { name, default: defaultModel, opus, sonnet, haiku } = req.body;

  if (!name || !defaultModel) {
    res.status(400).json({ error: 'Missing required fields: name, default' });
    return;
  }

  const ccsDir = getCcsDir();
  const settingsPath = path.join(ccsDir, `${profile}.settings.json`);

  // Create settings file if it doesn't exist
  if (!fs.existsSync(settingsPath)) {
    fs.writeFileSync(settingsPath, JSON.stringify({ env: {}, presets: [] }, null, 2) + '\n');
  }

  const settings = loadSettings(settingsPath);
  settings.presets = settings.presets || [];

  // Check for duplicate name
  if (settings.presets.some((p) => p.name === name)) {
    res.status(409).json({ error: 'Preset with this name already exists' });
    return;
  }

  const preset = {
    name,
    default: defaultModel,
    opus: opus || defaultModel,
    sonnet: sonnet || defaultModel,
    haiku: haiku || defaultModel,
  };

  settings.presets.push(preset);
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');

  res.status(201).json({ preset });
});

/**
 * DELETE /api/settings/:profile/presets/:name - Delete a preset
 */
apiRoutes.delete('/settings/:profile/presets/:name', (req: Request, res: Response): void => {
  const { profile, name } = req.params;
  const ccsDir = getCcsDir();
  const settingsPath = path.join(ccsDir, `${profile}.settings.json`);

  if (!fs.existsSync(settingsPath)) {
    res.status(404).json({ error: 'Settings not found' });
    return;
  }

  const settings = loadSettings(settingsPath);
  if (!settings.presets || !settings.presets.some((p) => p.name === name)) {
    res.status(404).json({ error: 'Preset not found' });
    return;
  }

  settings.presets = settings.presets.filter((p) => p.name !== name);
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');

  res.json({ success: true });
});

// ==================== Accounts ====================

/**
 * GET /api/accounts - List accounts from profiles.json
 */
apiRoutes.get('/accounts', (_req: Request, res: Response): void => {
  const profilesPath = path.join(getCcsDir(), 'profiles.json');

  if (!fs.existsSync(profilesPath)) {
    res.json({ accounts: [], default: null });
    return;
  }

  const data = JSON.parse(fs.readFileSync(profilesPath, 'utf8'));
  const accounts = Object.entries(data.profiles || {}).map(([name, meta]) => {
    // Type-safe handling of metadata
    const metadata = meta as Record<string, unknown>;
    return {
      name,
      ...metadata,
    };
  });

  res.json({ accounts, default: data.default || null });
});

/**
 * POST /api/accounts/default - Set default account
 */
apiRoutes.post('/accounts/default', (req: Request, res: Response): void => {
  const { name } = req.body;

  if (!name) {
    res.status(400).json({ error: 'Missing required field: name' });
    return;
  }

  const profilesPath = path.join(getCcsDir(), 'profiles.json');

  const data = fs.existsSync(profilesPath)
    ? JSON.parse(fs.readFileSync(profilesPath, 'utf8'))
    : { profiles: {} };

  data.default = name;
  fs.writeFileSync(profilesPath, JSON.stringify(data, null, 2) + '\n');

  res.json({ default: name });
});

// ==================== Health (Phase 06) ====================

/**
 * GET /api/health - Run health checks
 */
apiRoutes.get('/health', async (_req: Request, res: Response) => {
  const report = await runHealthChecks();
  res.json(report);
});

/**
 * POST /api/health/fix/:checkId - Fix a health issue
 */
apiRoutes.post('/health/fix/:checkId', (req: Request, res: Response): void => {
  const { checkId } = req.params;
  const result = fixHealthIssue(checkId);

  if (result.success) {
    res.json({ success: true, message: result.message });
  } else {
    res.status(400).json({ success: false, message: result.message });
  }
});

// ==================== Unified Config (Phase 5) ====================

/**
 * GET /api/config/format - Return current config format and migration status
 */
apiRoutes.get('/config/format', (_req: Request, res: Response) => {
  res.json({
    format: getConfigFormat(),
    migrationNeeded: needsMigration(),
    backups: getBackupDirectories(),
  });
});

/**
 * GET /api/config - Return unified config (excludes secrets)
 */
apiRoutes.get('/config', (_req: Request, res: Response): void => {
  if (!hasUnifiedConfig()) {
    res.status(400).json({ error: 'Unified config not enabled' });
    return;
  }

  const config = loadUnifiedConfig();
  if (!config) {
    res.status(500).json({ error: 'Failed to load config' });
    return;
  }

  res.json(config);
});

/**
 * PUT /api/config - Update unified config
 */
apiRoutes.put('/config', (req: Request, res: Response): void => {
  const config = req.body;

  if (!isUnifiedConfig(config)) {
    res.status(400).json({ error: 'Invalid config format' });
    return;
  }

  try {
    saveUnifiedConfig(config);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * POST /api/config/migrate - Trigger migration from JSON to YAML
 */
apiRoutes.post('/config/migrate', async (req: Request, res: Response) => {
  const dryRun = req.query.dryRun === 'true';
  const result = await migrate(dryRun);
  res.json(result);
});

/**
 * POST /api/config/rollback - Rollback migration to JSON format
 */
apiRoutes.post('/config/rollback', async (req: Request, res: Response): Promise<void> => {
  const { backupPath } = req.body;

  if (!backupPath || typeof backupPath !== 'string') {
    res.status(400).json({ error: 'Missing required field: backupPath' });
    return;
  }

  const success = await rollback(backupPath);
  res.json({ success });
});

/**
 * PUT /api/secrets/:profile - Update profile secrets (write-only)
 */
apiRoutes.put('/secrets/:profile', (req: Request, res: Response): void => {
  const { profile } = req.params;
  const secrets = req.body;

  if (!secrets || typeof secrets !== 'object') {
    res.status(400).json({ error: 'Invalid secrets format' });
    return;
  }

  try {
    setProfileSecrets(profile, secrets as Record<string, string>);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * GET /api/secrets/:profile/exists - Check if secrets exist (no values returned)
 */
apiRoutes.get('/secrets/:profile/exists', (req: Request, res: Response) => {
  const { profile } = req.params;
  const secrets = getProfileSecrets(profile);
  res.json({
    exists: Object.keys(secrets).length > 0,
    keys: Object.keys(secrets), // Only key names, not values
  });
});

// ==================== Generic File API (Issue #73) ====================

/**
 * Security: Validate file path is within allowed directories
 * - ~/.ccs/ directory: read/write allowed
 * - ~/.claude/settings.json: read-only
 */
function validateFilePath(filePath: string): { valid: boolean; readonly: boolean; error?: string } {
  const expandedPath = expandPath(filePath);
  const normalizedPath = path.normalize(expandedPath);
  const ccsDir = getCcsDir();
  const claudeSettingsPath = expandPath('~/.claude/settings.json');

  // Check if path is within ~/.ccs/
  if (normalizedPath.startsWith(ccsDir)) {
    // Block access to sensitive subdirectories
    const relativePath = normalizedPath.slice(ccsDir.length);
    if (relativePath.includes('/.git/') || relativePath.includes('/node_modules/')) {
      return { valid: false, readonly: false, error: 'Access to this path is not allowed' };
    }
    return { valid: true, readonly: false };
  }

  // Allow read-only access to ~/.claude/settings.json
  if (normalizedPath === claudeSettingsPath) {
    return { valid: true, readonly: true };
  }

  return { valid: false, readonly: false, error: 'Access to this path is not allowed' };
}

/**
 * GET /api/file - Read a file with path validation
 * Query params: path (required)
 * Returns: { content: string, mtime: number, readonly: boolean, path: string }
 */
apiRoutes.get('/file', (req: Request, res: Response): void => {
  const filePath = req.query.path as string;

  if (!filePath) {
    res.status(400).json({ error: 'Missing required query parameter: path' });
    return;
  }

  const validation = validateFilePath(filePath);
  if (!validation.valid) {
    res.status(403).json({ error: validation.error });
    return;
  }

  const expandedPath = expandPath(filePath);

  if (!fs.existsSync(expandedPath)) {
    res.status(404).json({ error: 'File not found' });
    return;
  }

  try {
    const stat = fs.statSync(expandedPath);
    const content = fs.readFileSync(expandedPath, 'utf8');

    res.json({
      content,
      mtime: stat.mtime.getTime(),
      readonly: validation.readonly,
      path: expandedPath,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * PUT /api/file - Write a file with conflict detection and backup
 * Query params: path (required)
 * Body: { content: string, expectedMtime?: number }
 * Returns: { success: true, mtime: number, backupPath?: string }
 */
apiRoutes.put('/file', (req: Request, res: Response): void => {
  const filePath = req.query.path as string;
  const { content, expectedMtime } = req.body;

  if (!filePath) {
    res.status(400).json({ error: 'Missing required query parameter: path' });
    return;
  }

  if (typeof content !== 'string') {
    res.status(400).json({ error: 'Missing required field: content' });
    return;
  }

  const validation = validateFilePath(filePath);
  if (!validation.valid) {
    res.status(403).json({ error: validation.error });
    return;
  }

  if (validation.readonly) {
    res.status(403).json({ error: 'File is read-only' });
    return;
  }

  const expandedPath = expandPath(filePath);
  const ccsDir = getCcsDir();

  // Conflict detection (if file exists and expectedMtime provided)
  if (fs.existsSync(expandedPath) && expectedMtime !== undefined) {
    const stat = fs.statSync(expandedPath);
    if (stat.mtime.getTime() !== expectedMtime) {
      res.status(409).json({
        error: 'File modified externally',
        currentMtime: stat.mtime.getTime(),
      });
      return;
    }
  }

  try {
    // Create backup if file exists
    let backupPath: string | undefined;
    if (fs.existsSync(expandedPath)) {
      const backupDir = path.join(ccsDir, 'backups');
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }
      const filename = path.basename(expandedPath);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      backupPath = path.join(backupDir, `${filename}.${timestamp}.bak`);
      fs.copyFileSync(expandedPath, backupPath);
    }

    // Ensure parent directory exists
    const parentDir = path.dirname(expandedPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    // Write atomically
    const tempPath = expandedPath + '.tmp';
    fs.writeFileSync(tempPath, content);
    fs.renameSync(tempPath, expandedPath);

    const newStat = fs.statSync(expandedPath);
    res.json({
      success: true,
      mtime: newStat.mtime.getTime(),
      backupPath,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/files - List editable files in ~/.ccs/
 * Returns: { files: Array<{ name: string, path: string, mtime: number }> }
 */
apiRoutes.get('/files', (_req: Request, res: Response): void => {
  const ccsDir = getCcsDir();

  if (!fs.existsSync(ccsDir)) {
    res.json({ files: [] });
    return;
  }

  try {
    const entries = fs.readdirSync(ccsDir, { withFileTypes: true });
    const files = entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
      .map((entry) => {
        const filePath = path.join(ccsDir, entry.name);
        const stat = fs.statSync(filePath);
        return {
          name: entry.name,
          path: `~/.ccs/${entry.name}`,
          mtime: stat.mtime.getTime(),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    res.json({ files });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/cliproxy/stats - Get CLIProxyAPI usage statistics
 * Returns: CliproxyStats or error if proxy not running
 */
apiRoutes.get('/cliproxy/stats', async (_req: Request, res: Response): Promise<void> => {
  try {
    // Check if proxy is running first
    const running = await isCliproxyRunning();
    if (!running) {
      res.status(503).json({
        error: 'CLIProxyAPI not running',
        message: 'Start a CLIProxy session (gemini, codex, agy) to collect stats',
      });
      return;
    }

    // Fetch stats from management API
    const stats = await fetchCliproxyStats();
    if (!stats) {
      res.status(503).json({
        error: 'Stats unavailable',
        message: 'CLIProxyAPI is running but stats endpoint not responding',
      });
      return;
    }

    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/cliproxy/status - Check CLIProxyAPI running status
 * Returns: { running: boolean }
 */
apiRoutes.get('/cliproxy/status', async (_req: Request, res: Response): Promise<void> => {
  try {
    const running = await isCliproxyRunning();
    res.json({ running });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/cliproxy/models - Get available models from CLIProxyAPI
 * Returns: { models: CliproxyModel[], byCategory: Record<string, CliproxyModel[]>, totalCount: number }
 */
apiRoutes.get('/cliproxy/models', async (_req: Request, res: Response): Promise<void> => {
  try {
    // Check if proxy is running first
    const running = await isCliproxyRunning();
    if (!running) {
      res.status(503).json({
        error: 'CLIProxyAPI not running',
        message: 'Start a CLIProxy session (gemini, codex, agy) to fetch available models',
      });
      return;
    }

    // Fetch models from /v1/models endpoint
    const modelsResponse = await fetchCliproxyModels();
    if (!modelsResponse) {
      res.status(503).json({
        error: 'Models unavailable',
        message: 'CLIProxyAPI is running but /v1/models endpoint not responding',
      });
      return;
    }

    res.json(modelsResponse);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// ============================================
// OpenAI Compatibility Layer Routes
// ============================================

/**
 * GET /api/cliproxy/openai-compat - List all OpenAI-compatible providers
 */
apiRoutes.get('/cliproxy/openai-compat', (_req: Request, res: Response): void => {
  try {
    const providers = listOpenAICompatProviders();
    // Mask API keys for security
    const masked = providers.map((p) => ({
      ...p,
      apiKey: p.apiKey ? `...${p.apiKey.slice(-4)}` : '',
    }));
    res.json({ providers: masked });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/cliproxy/openai-compat/templates - Get pre-configured provider templates
 */
apiRoutes.get('/cliproxy/openai-compat/templates', (_req: Request, res: Response): void => {
  res.json({
    templates: [
      { ...OPENROUTER_TEMPLATE, description: 'OpenRouter - Access multiple AI models' },
      { ...TOGETHER_TEMPLATE, description: 'Together AI - Open source models' },
    ],
  });
});

/**
 * GET /api/cliproxy/openai-compat/:name - Get a specific provider
 */
apiRoutes.get('/cliproxy/openai-compat/:name', (req: Request, res: Response): void => {
  try {
    const provider = getOpenAICompatProvider(req.params.name);
    if (!provider) {
      res.status(404).json({ error: `Provider '${req.params.name}' not found` });
      return;
    }
    // Mask API key
    res.json({
      ...provider,
      apiKey: provider.apiKey ? `...${provider.apiKey.slice(-4)}` : '',
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /api/cliproxy/openai-compat - Add a new provider
 * Body: { name, baseUrl, apiKey, models: [{ name, alias }] }
 */
apiRoutes.post('/cliproxy/openai-compat', (req: Request, res: Response): void => {
  try {
    const { name, baseUrl, apiKey, models } = req.body;

    // Validation
    if (!name || typeof name !== 'string') {
      res.status(400).json({ error: 'name is required' });
      return;
    }
    if (!baseUrl || typeof baseUrl !== 'string') {
      res.status(400).json({ error: 'baseUrl is required' });
      return;
    }
    if (!apiKey || typeof apiKey !== 'string') {
      res.status(400).json({ error: 'apiKey is required' });
      return;
    }

    addOpenAICompatProvider({
      name,
      baseUrl,
      apiKey,
      models: models || [],
    });

    res.status(201).json({ success: true, name });
  } catch (error) {
    const message = (error as Error).message;
    if (message.includes('already exists')) {
      res.status(409).json({ error: message });
    } else {
      res.status(500).json({ error: message });
    }
  }
});

/**
 * PUT /api/cliproxy/openai-compat/:name - Update a provider
 * Body: { baseUrl?, apiKey?, models?, name? (for rename) }
 */
apiRoutes.put('/cliproxy/openai-compat/:name', (req: Request, res: Response): void => {
  try {
    const { baseUrl, apiKey, models, name: newName } = req.body;

    updateOpenAICompatProvider(req.params.name, {
      baseUrl,
      apiKey,
      models,
      name: newName,
    });

    res.json({ success: true });
  } catch (error) {
    const message = (error as Error).message;
    if (message.includes('not found')) {
      res.status(404).json({ error: message });
    } else {
      res.status(500).json({ error: message });
    }
  }
});

/**
 * DELETE /api/cliproxy/openai-compat/:name - Remove a provider
 */
apiRoutes.delete('/cliproxy/openai-compat/:name', (req: Request, res: Response): void => {
  try {
    const removed = removeOpenAICompatProvider(req.params.name);
    if (!removed) {
      res.status(404).json({ error: `Provider '${req.params.name}' not found` });
      return;
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});
