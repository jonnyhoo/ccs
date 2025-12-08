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
import { getAllAuthStatus, getOAuthConfig } from '../cliproxy/auth-handler';

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

/**
 * Helper: Create settings file for profile
 */
function createSettingsFile(name: string, baseUrl: string, apiKey: string, model?: string): string {
  const settingsPath = path.join(getCcsDir(), `${name}.settings.json`);

  const settings: Settings = {
    env: {
      ANTHROPIC_BASE_URL: baseUrl,
      ANTHROPIC_AUTH_TOKEN: apiKey,
      ...(model && { ANTHROPIC_MODEL: model }),
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
  updates: { baseUrl?: string; apiKey?: string; model?: string }
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

  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
}

/**
 * Helper: Create cliproxy variant settings
 */
function createCliproxySettings(name: string, model?: string): string {
  const settingsPath = path.join(getCcsDir(), `${name}.settings.json`);

  const settings: Settings = {
    env: model ? { ANTHROPIC_MODEL: model } : {},
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
  const { name, baseUrl, apiKey, model } = req.body;

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

  // Create settings file
  const settingsPath = createSettingsFile(name, baseUrl, apiKey, model);

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
  const { baseUrl, apiKey, model } = req.body;

  const config = readConfigSafe();

  if (!config.profiles[name]) {
    res.status(404).json({ error: 'Profile not found' });
    return;
  }

  try {
    updateSettingsFile(name, { baseUrl, apiKey, model });
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
  }));

  res.json({ variants });
});

/**
 * POST /api/cliproxy - Create cliproxy variant
 */
apiRoutes.post('/cliproxy', (req: Request, res: Response): void => {
  const { name, provider, model } = req.body;

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
  const settingsPath = createCliproxySettings(name, model);

  config.cliproxy[name] = { provider, settings: settingsPath };
  writeConfig(config);

  res.status(201).json({ name, provider, settings: settingsPath });
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
  const statuses = getAllAuthStatus();

  const authStatus = statuses.map((status) => {
    const oauthConfig = getOAuthConfig(status.provider);
    return {
      provider: status.provider,
      displayName: oauthConfig.displayName,
      authenticated: status.authenticated,
      lastAuth: status.lastAuth?.toISOString() || null,
      tokenFiles: status.tokenFiles.length,
    };
  });

  res.json({ authStatus });
});

// ==================== Settings (Phase 05) ====================

/**
 * Helper: Mask API keys in settings
 */
function maskApiKeys(settings: Settings): Settings {
  if (!settings.env) return settings;

  const masked = { ...settings, env: { ...settings.env } };
  const sensitiveKeys = ['ANTHROPIC_AUTH_TOKEN', 'API_KEY', 'AUTH_TOKEN'];

  for (const key of Object.keys(masked.env)) {
    if (sensitiveKeys.some((sensitive) => key.includes(sensitive))) {
      const value = masked.env[key];
      if (value && value.length > 8) {
        masked.env[key] =
          value.slice(0, 4) + '*'.repeat(Math.max(0, value.length - 8)) + value.slice(-4);
      }
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
apiRoutes.get('/health', (_req: Request, res: Response) => {
  const report = runHealthChecks();
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
