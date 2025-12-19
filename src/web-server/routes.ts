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
import { submitProjectSelection, getPendingSelection } from '../cliproxy/project-selection-handler';
import {
  fetchCliproxyStats,
  fetchCliproxyModels,
  isCliproxyRunning,
  fetchCliproxyErrorLogs,
  fetchCliproxyErrorLogContent,
} from '../cliproxy/stats-fetcher';
import { getCliproxyWritablePath } from '../cliproxy/config-generator';
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
  touchAccount,
} from '../cliproxy/account-manager';
import type { CLIProxyProvider } from '../cliproxy/types';
import { getClaudeEnvVars } from '../cliproxy/config-generator';
import { getProxyStatus as getProxyProcessStatus, stopProxy } from '../cliproxy/session-tracker';
import { ensureCliproxyService } from '../cliproxy/service-manager';
import { checkCliproxyUpdate } from '../cliproxy/binary-manager';
// Unified config imports
import {
  hasUnifiedConfig,
  loadUnifiedConfig,
  saveUnifiedConfig,
  getConfigFormat,
  getConfigYamlPath,
} from '../config/unified-config-loader';
import {
  needsMigration,
  migrate,
  rollback,
  getBackupDirectories,
} from '../config/migration-manager';
import { getProfileSecrets, setProfileSecrets } from '../config/secrets-manager';
import { getWebSearchConfig } from '../config/unified-config-loader';
import type { WebSearchConfig } from '../config/unified-config-types';
import { isUnifiedConfig } from '../config/unified-config-types';
import { isSensitiveKey, maskSensitiveValue } from '../utils/sensitive-keys';
import {
  getWebSearchReadiness,
  getGeminiCliStatus,
  getGrokCliStatus,
  getOpenCodeCliStatus,
} from '../utils/websearch-manager';

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
 * Also fetches CLIProxyAPI stats to update lastUsedAt for active providers
 */
apiRoutes.get('/cliproxy/auth', async (_req: Request, res: Response) => {
  // Initialize accounts from existing tokens on first request
  initializeAccounts();

  // Fetch CLIProxyAPI usage stats to determine active providers
  const stats = await fetchCliproxyStats();

  // Map CLIProxyAPI provider names to our internal provider names
  const statsProviderMap: Record<string, CLIProxyProvider> = {
    gemini: 'gemini',
    antigravity: 'agy',
    codex: 'codex',
    qwen: 'qwen',
    iflow: 'iflow',
  };

  // Update lastUsedAt for providers with recent activity
  if (stats?.requestsByProvider) {
    for (const [statsProvider, requestCount] of Object.entries(stats.requestsByProvider)) {
      if (requestCount > 0) {
        const provider = statsProviderMap[statsProvider.toLowerCase()];
        if (provider) {
          // Touch the default account for this provider (or all accounts)
          const accounts = getProviderAccounts(provider);
          for (const account of accounts) {
            // Only touch if this is the default account (most likely being used)
            if (account.isDefault) {
              touchAccount(provider, account.id);
            }
          }
        }
      }
    }
  }

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
        fromUI: true, // Enable project selection prompt in UI
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

/**
 * GET /api/cliproxy/auth/project-selection/:sessionId - Get pending project selection prompt
 * Returns project list for user to select from during OAuth flow
 */
apiRoutes.get(
  '/cliproxy/auth/project-selection/:sessionId',
  (req: Request, res: Response): void => {
    const { sessionId } = req.params;

    const pending = getPendingSelection(sessionId);
    if (pending) {
      res.json(pending);
    } else {
      res.status(404).json({ error: 'No pending project selection for this session' });
    }
  }
);

/**
 * POST /api/cliproxy/auth/project-selection/:sessionId - Submit project selection
 * Submits user's project choice during OAuth flow
 */
apiRoutes.post(
  '/cliproxy/auth/project-selection/:sessionId',
  (req: Request, res: Response): void => {
    const { sessionId } = req.params;
    const { selectedId } = req.body;

    if (!selectedId && selectedId !== '') {
      res.status(400).json({ error: 'selectedId is required (use empty string for default)' });
      return;
    }

    const success = submitProjectSelection({ sessionId, selectedId });
    if (success) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'No pending project selection for this session' });
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
 * GET /api/config/raw - Return raw YAML content for display
 */
apiRoutes.get('/config/raw', (_req: Request, res: Response): void => {
  const yamlPath = getConfigYamlPath();
  if (!fs.existsSync(yamlPath)) {
    res.status(404).json({ error: 'Config file not found' });
    return;
  }
  try {
    const content = fs.readFileSync(yamlPath, 'utf8');
    res.type('text/plain').send(content);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
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
 * GET /api/cliproxy/proxy-status - Get detailed proxy process status
 * Returns: { running, port?, pid?, sessionCount?, startedAt? }
 * Combines session tracker data with actual port check for accuracy
 */
apiRoutes.get('/cliproxy/proxy-status', async (_req: Request, res: Response): Promise<void> => {
  try {
    // First check session tracker for detailed info
    const sessionStatus = getProxyProcessStatus();

    // If session tracker says running, trust it
    if (sessionStatus.running) {
      res.json(sessionStatus);
      return;
    }

    // Session tracker says not running, but proxy might be running without session tracking
    // (e.g., started before session persistence was implemented)
    const actuallyRunning = await isCliproxyRunning();

    if (actuallyRunning) {
      // Proxy running but no session lock - legacy/untracked instance
      res.json({
        running: true,
        port: 8317, // Default port
        sessionCount: 0, // Unknown sessions
        // No pid/startedAt since we don't have session lock
      });
    } else {
      res.json(sessionStatus);
    }
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /api/cliproxy/proxy-start - Start the CLIProxy service
 * Returns: { started, alreadyRunning, port, error? }
 * Starts proxy in background if not already running
 */
apiRoutes.post('/cliproxy/proxy-start', async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await ensureCliproxyService();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /api/cliproxy/proxy-stop - Stop the CLIProxy service
 * Returns: { stopped, pid?, sessionCount?, error? }
 */
apiRoutes.post('/cliproxy/proxy-stop', (_req: Request, res: Response): void => {
  try {
    const result = stopProxy();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/cliproxy/update-check - Check for CLIProxyAPI binary updates
 * Returns: { hasUpdate, currentVersion, latestVersion, fromCache }
 */
apiRoutes.get('/cliproxy/update-check', async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await checkCliproxyUpdate();
    res.json(result);
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

// ==================== Error Logs ====================

/**
 * GET /api/cliproxy/error-logs - Get list of error log files
 * Returns: { files: CliproxyErrorLog[] } or error if proxy not running
 */
apiRoutes.get('/cliproxy/error-logs', async (_req: Request, res: Response): Promise<void> => {
  try {
    const running = await isCliproxyRunning();
    if (!running) {
      res.status(503).json({
        error: 'CLIProxyAPI not running',
        message: 'Start a CLIProxy session to view error logs',
      });
      return;
    }

    const files = await fetchCliproxyErrorLogs();
    if (files === null) {
      res.status(503).json({
        error: 'Error logs unavailable',
        message: 'CLIProxyAPI is running but error logs endpoint not responding',
      });
      return;
    }

    // Inject absolute paths into each file entry
    const logsDir = path.join(getCliproxyWritablePath(), 'logs');
    const filesWithPaths = files.map((file) => ({
      ...file,
      absolutePath: path.join(logsDir, file.name),
    }));

    res.json({ files: filesWithPaths });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/cliproxy/error-logs/:name - Get content of a specific error log
 * Returns: plain text log content
 */
apiRoutes.get('/cliproxy/error-logs/:name', async (req: Request, res: Response): Promise<void> => {
  const { name } = req.params;

  // Validate filename format and prevent path traversal
  if (
    !name ||
    !name.startsWith('error-') ||
    !name.endsWith('.log') ||
    name.includes('..') ||
    name.includes('/') ||
    name.includes('\\')
  ) {
    res.status(400).json({ error: 'Invalid error log filename' });
    return;
  }

  try {
    const running = await isCliproxyRunning();
    if (!running) {
      res.status(503).json({ error: 'CLIProxyAPI not running' });
      return;
    }

    const content = await fetchCliproxyErrorLogContent(name);
    if (content === null) {
      res.status(404).json({ error: 'Error log not found' });
      return;
    }

    res.type('text/plain').send(content);
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

// ==================== WebSearch Configuration ====================

/**
 * GET /api/websearch - Get WebSearch configuration
 * Returns: WebSearchConfig with enabled, provider, fallback
 */
apiRoutes.get('/websearch', (_req: Request, res: Response): void => {
  try {
    const config = getWebSearchConfig();
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * PUT /api/websearch - Update WebSearch configuration
 * Body: WebSearchConfig fields (enabled, providers)
 * Dashboard is the source of truth for provider selection.
 */
apiRoutes.put('/websearch', (req: Request, res: Response): void => {
  const { enabled, providers } = req.body as Partial<WebSearchConfig>;

  // Validate enabled
  if (enabled !== undefined && typeof enabled !== 'boolean') {
    res.status(400).json({ error: 'Invalid value for enabled. Must be a boolean.' });
    return;
  }

  // Validate providers if specified
  if (providers !== undefined && typeof providers !== 'object') {
    res.status(400).json({ error: 'Invalid value for providers. Must be an object.' });
    return;
  }

  try {
    // Load existing config and update websearch section
    const existingConfig = loadUnifiedConfig();
    if (!existingConfig) {
      res.status(500).json({ error: 'Failed to load config' });
      return;
    }

    // Merge updates - supports Gemini CLI and Grok CLI
    existingConfig.websearch = {
      enabled: enabled ?? existingConfig.websearch?.enabled ?? true,
      providers: providers
        ? {
            gemini: {
              enabled:
                providers.gemini?.enabled ??
                existingConfig.websearch?.providers?.gemini?.enabled ??
                true,
              model:
                providers.gemini?.model ??
                existingConfig.websearch?.providers?.gemini?.model ??
                'gemini-2.5-flash',
              timeout:
                providers.gemini?.timeout ??
                existingConfig.websearch?.providers?.gemini?.timeout ??
                55,
            },
            grok: {
              enabled:
                providers.grok?.enabled ??
                existingConfig.websearch?.providers?.grok?.enabled ??
                false,
              timeout:
                providers.grok?.timeout ?? existingConfig.websearch?.providers?.grok?.timeout ?? 55,
            },
            opencode: {
              enabled:
                providers.opencode?.enabled ??
                existingConfig.websearch?.providers?.opencode?.enabled ??
                false,
              model:
                providers.opencode?.model ??
                existingConfig.websearch?.providers?.opencode?.model ??
                'opencode/grok-code',
              timeout:
                providers.opencode?.timeout ??
                existingConfig.websearch?.providers?.opencode?.timeout ??
                60,
            },
          }
        : existingConfig.websearch?.providers,
    };

    saveUnifiedConfig(existingConfig);

    res.json({
      success: true,
      websearch: existingConfig.websearch,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/websearch/status - Get WebSearch status
 * Returns: { geminiCli, grokCli, opencodeCli, readiness }
 */
apiRoutes.get('/websearch/status', (_req: Request, res: Response): void => {
  try {
    const geminiCli = getGeminiCliStatus();
    const grokCli = getGrokCliStatus();
    const opencodeCli = getOpenCodeCliStatus();
    const readiness = getWebSearchReadiness();

    res.json({
      geminiCli: {
        installed: geminiCli.installed,
        path: geminiCli.path,
        version: geminiCli.version,
      },
      grokCli: {
        installed: grokCli.installed,
        path: grokCli.path,
        version: grokCli.version,
      },
      opencodeCli: {
        installed: opencodeCli.installed,
        path: opencodeCli.path,
        version: opencodeCli.version,
      },
      readiness: {
        status: readiness.readiness,
        message: readiness.message,
      },
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// ============================================================================
// COPILOT API ROUTES
// GitHub Copilot integration via copilot-api proxy
// ============================================================================

import {
  checkAuthStatus as checkCopilotAuth,
  startAuthFlow as startCopilotAuth,
  getCopilotStatus,
  startDaemon as startCopilotDaemon,
  stopDaemon as stopCopilotDaemon,
  getAvailableModels as getCopilotModels,
  isCopilotApiInstalled,
  ensureCopilotApi,
  installCopilotApiVersion,
  getCopilotApiInfo,
  getInstalledVersion as getCopilotInstalledVersion,
} from '../copilot';
import { DEFAULT_COPILOT_CONFIG } from '../config/unified-config-types';
import { loadOrCreateUnifiedConfig, getGlobalEnvConfig } from '../config/unified-config-loader';

/**
 * GET /api/copilot/status - Get Copilot status (auth + daemon + install info)
 */
apiRoutes.get('/copilot/status', async (_req: Request, res: Response): Promise<void> => {
  try {
    const config = loadOrCreateUnifiedConfig();
    const copilotConfig = config.copilot ?? DEFAULT_COPILOT_CONFIG;
    const status = await getCopilotStatus(copilotConfig);
    const installed = isCopilotApiInstalled();
    const version = getCopilotInstalledVersion();

    res.json({
      enabled: copilotConfig.enabled,
      installed,
      version,
      authenticated: status.auth.authenticated,
      daemon_running: status.daemon.running,
      port: copilotConfig.port,
      model: copilotConfig.model,
      account_type: copilotConfig.account_type,
      auto_start: copilotConfig.auto_start,
      rate_limit: copilotConfig.rate_limit,
      wait_on_limit: copilotConfig.wait_on_limit,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/copilot/config - Get Copilot configuration
 */
apiRoutes.get('/copilot/config', (_req: Request, res: Response): void => {
  try {
    const config = loadOrCreateUnifiedConfig();
    const copilotConfig = config.copilot ?? DEFAULT_COPILOT_CONFIG;
    res.json(copilotConfig);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * PUT /api/copilot/config - Update Copilot configuration
 */
apiRoutes.put('/copilot/config', (req: Request, res: Response): void => {
  try {
    const updates = req.body;
    const config = loadOrCreateUnifiedConfig();

    // Merge updates with existing config
    config.copilot = {
      enabled: updates.enabled ?? config.copilot?.enabled ?? DEFAULT_COPILOT_CONFIG.enabled,
      auto_start:
        updates.auto_start ?? config.copilot?.auto_start ?? DEFAULT_COPILOT_CONFIG.auto_start,
      port: updates.port ?? config.copilot?.port ?? DEFAULT_COPILOT_CONFIG.port,
      account_type:
        updates.account_type ?? config.copilot?.account_type ?? DEFAULT_COPILOT_CONFIG.account_type,
      rate_limit:
        updates.rate_limit !== undefined
          ? updates.rate_limit
          : (config.copilot?.rate_limit ?? DEFAULT_COPILOT_CONFIG.rate_limit),
      wait_on_limit:
        updates.wait_on_limit ??
        config.copilot?.wait_on_limit ??
        DEFAULT_COPILOT_CONFIG.wait_on_limit,
      model: updates.model ?? config.copilot?.model ?? DEFAULT_COPILOT_CONFIG.model,
      // Model mapping for opus/sonnet/haiku tiers
      opus_model:
        updates.opus_model !== undefined ? updates.opus_model : config.copilot?.opus_model,
      sonnet_model:
        updates.sonnet_model !== undefined ? updates.sonnet_model : config.copilot?.sonnet_model,
      haiku_model:
        updates.haiku_model !== undefined ? updates.haiku_model : config.copilot?.haiku_model,
    };

    saveUnifiedConfig(config);
    res.json({ success: true, copilot: config.copilot });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /api/copilot/auth/start - Start GitHub OAuth flow
 * Note: This is a long-running operation that opens browser
 */
apiRoutes.post('/copilot/auth/start', async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await startCopilotAuth();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/copilot/auth/status - Get auth status only
 */
apiRoutes.get('/copilot/auth/status', async (_req: Request, res: Response): Promise<void> => {
  try {
    const status = await checkCopilotAuth();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/copilot/models - Get available models
 */
apiRoutes.get('/copilot/models', async (_req: Request, res: Response): Promise<void> => {
  try {
    const config = loadOrCreateUnifiedConfig();
    const port = config.copilot?.port ?? DEFAULT_COPILOT_CONFIG.port;
    const currentModel = config.copilot?.model ?? DEFAULT_COPILOT_CONFIG.model;
    const models = await getCopilotModels(port);

    // Mark current model
    const modelsWithCurrent = models.map((m) => ({
      ...m,
      isCurrent: m.id === currentModel,
    }));

    res.json({ models: modelsWithCurrent, current: currentModel });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /api/copilot/daemon/start - Start copilot-api daemon
 */
apiRoutes.post('/copilot/daemon/start', async (_req: Request, res: Response): Promise<void> => {
  try {
    const config = loadOrCreateUnifiedConfig();
    const copilotConfig = config.copilot ?? DEFAULT_COPILOT_CONFIG;
    const result = await startCopilotDaemon(copilotConfig);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /api/copilot/daemon/stop - Stop copilot-api daemon
 */
apiRoutes.post('/copilot/daemon/stop', async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await stopCopilotDaemon();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /api/copilot/install - Install copilot-api
 * Auto-installs latest version or specific version if provided
 */
apiRoutes.post('/copilot/install', async (req: Request, res: Response): Promise<void> => {
  try {
    const { version } = req.body || {};

    if (version) {
      // Install specific version
      await installCopilotApiVersion(version);
    } else {
      // Install latest version
      await ensureCopilotApi();
    }

    const info = getCopilotApiInfo();
    res.json({
      success: true,
      installed: info.installed,
      version: info.version,
      path: info.path,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/copilot/info - Get copilot-api installation info
 */
apiRoutes.get('/copilot/info', (_req: Request, res: Response): void => {
  try {
    const info = getCopilotApiInfo();
    res.json(info);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/copilot/settings/raw - Get raw copilot.settings.json
 * Returns the raw JSON content for editing in the code editor
 */
apiRoutes.get('/copilot/settings/raw', (_req: Request, res: Response): void => {
  try {
    const settingsPath = path.join(getCcsDir(), 'copilot.settings.json');
    const config = loadOrCreateUnifiedConfig();
    const copilotConfig = config.copilot ?? DEFAULT_COPILOT_CONFIG;

    // Default model for all tiers
    const defaultModel = copilotConfig.model;

    // If file doesn't exist, return default structure with all model mappings
    if (!fs.existsSync(settingsPath)) {
      // Create settings structure matching CLIProxy pattern - always include all model mappings
      // Use 127.0.0.1 instead of localhost for more reliable local connections
      const defaultSettings = {
        env: {
          ANTHROPIC_BASE_URL: `http://127.0.0.1:${copilotConfig.port}`,
          ANTHROPIC_AUTH_TOKEN: 'copilot-managed',
          ANTHROPIC_MODEL: defaultModel,
          ANTHROPIC_DEFAULT_OPUS_MODEL: copilotConfig.opus_model || defaultModel,
          ANTHROPIC_DEFAULT_SONNET_MODEL: copilotConfig.sonnet_model || defaultModel,
          ANTHROPIC_DEFAULT_HAIKU_MODEL: copilotConfig.haiku_model || defaultModel,
        },
      };

      res.json({
        settings: defaultSettings,
        mtime: Date.now(),
        path: `~/.ccs/copilot.settings.json`,
        exists: false,
      });
      return;
    }

    const content = fs.readFileSync(settingsPath, 'utf-8');
    const settings = JSON.parse(content);
    const stat = fs.statSync(settingsPath);

    res.json({
      settings,
      mtime: stat.mtimeMs,
      path: `~/.ccs/copilot.settings.json`,
      exists: true,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * PUT /api/copilot/settings/raw - Save raw copilot.settings.json
 * Saves the raw JSON content from the code editor
 */
apiRoutes.put('/copilot/settings/raw', (req: Request, res: Response): void => {
  try {
    const { settings, expectedMtime } = req.body;
    const settingsPath = path.join(getCcsDir(), 'copilot.settings.json');

    // Check for conflict if file exists and expectedMtime provided
    if (fs.existsSync(settingsPath) && expectedMtime) {
      const stat = fs.statSync(settingsPath);
      if (Math.abs(stat.mtimeMs - expectedMtime) > 1000) {
        res.status(409).json({ error: 'File modified externally', mtime: stat.mtimeMs });
        return;
      }
    }

    // Write settings file atomically
    const tempPath = settingsPath + '.tmp';
    fs.writeFileSync(tempPath, JSON.stringify(settings, null, 2) + '\n');
    fs.renameSync(tempPath, settingsPath);

    // Also sync model mappings back to unified config
    const config = loadOrCreateUnifiedConfig();
    const env = settings.env || {};

    config.copilot = {
      ...(config.copilot ?? DEFAULT_COPILOT_CONFIG),
      model: env.ANTHROPIC_MODEL || config.copilot?.model || DEFAULT_COPILOT_CONFIG.model,
      opus_model: env.ANTHROPIC_DEFAULT_OPUS_MODEL || undefined,
      sonnet_model: env.ANTHROPIC_DEFAULT_SONNET_MODEL || undefined,
      haiku_model: env.ANTHROPIC_DEFAULT_HAIKU_MODEL || undefined,
    };
    saveUnifiedConfig(config);

    const stat = fs.statSync(settingsPath);
    res.json({ success: true, mtime: stat.mtimeMs });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// ==================== Global Environment Variables ====================

/**
 * GET /api/global-env - Get global environment variables configuration
 * Returns the global_env section from config.yaml
 */
apiRoutes.get('/global-env', (_req: Request, res: Response): void => {
  try {
    const config = getGlobalEnvConfig();
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * PUT /api/global-env - Update global environment variables configuration
 * Updates the global_env section in config.yaml
 */
apiRoutes.put('/global-env', (req: Request, res: Response): void => {
  try {
    const { enabled, env } = req.body;
    const config = loadOrCreateUnifiedConfig();

    // Validate env is an object with string values
    if (env !== undefined && typeof env === 'object' && env !== null) {
      for (const [key, value] of Object.entries(env)) {
        if (typeof value !== 'string') {
          res.status(400).json({ error: `Invalid value for ${key}: must be a string` });
          return;
        }
      }
    }

    // Update global_env section
    config.global_env = {
      enabled: enabled ?? config.global_env?.enabled ?? true,
      env: env ?? config.global_env?.env ?? {},
    };

    saveUnifiedConfig(config);
    res.json({ success: true, config: config.global_env });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});
