/**
 * API Profile Writer Service - Create/remove operations for API profiles.
 * Supports both unified YAML config and legacy JSON config.
 */
import * as fs from 'fs';
import * as path from 'path';
import { getCcsDir, getConfigPath, loadConfigSafe } from '../../utils/config-manager';
import { expandPath } from '../../utils/helpers';
import {
  loadOrCreateUnifiedConfig,
  saveUnifiedConfig,
  isUnifiedMode,
} from '../../config/unified-config-loader';
import { ensureProfileHooks } from '../../utils/websearch/profile-hook-injector';
import type { ModelMapping, CreateApiProfileResult, RemoveApiProfileResult } from './profile-types';

/** Check if URL is an OpenRouter endpoint */
function isOpenRouterUrl(baseUrl: string): boolean {
  return baseUrl.toLowerCase().includes('openrouter.ai');
}

/** Create settings.json file for API profile (legacy format) */
function createSettingsFile(
  name: string,
  baseUrl: string,
  apiKey: string,
  models: ModelMapping
): string {
  const ccsDir = getCcsDir();
  const settingsPath = path.join(ccsDir, `${name}.settings.json`);

  const settings = {
    env: {
      ANTHROPIC_BASE_URL: baseUrl,
      ANTHROPIC_AUTH_TOKEN: apiKey,
      ANTHROPIC_MODEL: models.default,
      ANTHROPIC_DEFAULT_OPUS_MODEL: models.opus,
      ANTHROPIC_DEFAULT_SONNET_MODEL: models.sonnet,
      ANTHROPIC_DEFAULT_HAIKU_MODEL: models.haiku,
      // OpenRouter requires explicitly blanking the API key to prevent conflicts
      ...(isOpenRouterUrl(baseUrl) && { ANTHROPIC_API_KEY: '' }),
    },
  };

  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf8');

  // Inject WebSearch hooks into profile settings
  ensureProfileHooks(name);

  return settingsPath;
}

/** Update config.json with new API profile (legacy format) */
function updateLegacyConfig(name: string): void {
  const configPath = getConfigPath();
  const ccsDir = getCcsDir();

  let config: { profiles: Record<string, string>; cliproxy?: Record<string, unknown> };
  try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch {
    config = { profiles: {} };
  }

  const relativePath = `~/.ccs/${name}.settings.json`;
  config.profiles[name] = relativePath;

  if (!fs.existsSync(ccsDir)) {
    fs.mkdirSync(ccsDir, { recursive: true });
  }

  // Write config atomically
  const tempPath = configPath + '.tmp';
  fs.writeFileSync(tempPath, JSON.stringify(config, null, 2) + '\n', 'utf8');
  fs.renameSync(tempPath, configPath);
}

/** Create API profile in unified config */
function createApiProfileUnified(
  name: string,
  baseUrl: string,
  apiKey: string,
  models: ModelMapping
): void {
  const ccsDir = getCcsDir();
  const settingsFile = `${name}.settings.json`;
  const settingsPath = path.join(ccsDir, settingsFile);

  const settings = {
    env: {
      ANTHROPIC_BASE_URL: baseUrl,
      ANTHROPIC_AUTH_TOKEN: apiKey,
      ANTHROPIC_MODEL: models.default,
      ANTHROPIC_DEFAULT_OPUS_MODEL: models.opus,
      ANTHROPIC_DEFAULT_SONNET_MODEL: models.sonnet,
      ANTHROPIC_DEFAULT_HAIKU_MODEL: models.haiku,
      // OpenRouter requires explicitly blanking the API key to prevent conflicts
      ...(isOpenRouterUrl(baseUrl) && { ANTHROPIC_API_KEY: '' }),
    },
  };

  if (!fs.existsSync(ccsDir)) {
    fs.mkdirSync(ccsDir, { recursive: true });
  }

  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf8');

  // Inject WebSearch hooks into profile settings
  ensureProfileHooks(name);

  const config = loadOrCreateUnifiedConfig();
  config.profiles[name] = {
    type: 'api',
    settings: `~/.ccs/${settingsFile}`,
  };
  saveUnifiedConfig(config);
}

/** Create a new API profile */
export function createApiProfile(
  name: string,
  baseUrl: string,
  apiKey: string,
  models: ModelMapping
): CreateApiProfileResult {
  try {
    const settingsFile = `~/.ccs/${name}.settings.json`;

    if (isUnifiedMode()) {
      createApiProfileUnified(name, baseUrl, apiKey, models);
    } else {
      createSettingsFile(name, baseUrl, apiKey, models);
      updateLegacyConfig(name);
    }

    return { success: true, settingsFile };
  } catch (error) {
    return {
      success: false,
      settingsFile: '',
      error: (error as Error).message,
    };
  }
}

/** Remove API profile from unified config */
function removeApiProfileUnified(name: string): void {
  const config = loadOrCreateUnifiedConfig();
  const profile = config.profiles[name];

  if (!profile) {
    throw new Error(`API profile not found: ${name}`);
  }

  // Delete the settings file if it exists.
  // Uses expandPath() for cross-platform path handling.
  if (profile.settings) {
    const settingsPath = expandPath(profile.settings);
    if (fs.existsSync(settingsPath)) {
      fs.unlinkSync(settingsPath);
    }
  }

  delete config.profiles[name];

  // Clear default if it was the deleted profile
  if (config.default === name) {
    config.default = undefined;
  }

  saveUnifiedConfig(config);
}

/** Remove API profile from legacy config */
function removeApiProfileLegacy(name: string): void {
  const config = loadConfigSafe();
  delete config.profiles[name];

  const configPath = getConfigPath();
  const tempPath = configPath + '.tmp';
  fs.writeFileSync(tempPath, JSON.stringify(config, null, 2) + '\n', 'utf8');
  fs.renameSync(tempPath, configPath);

  // Remove settings file if it exists
  const expandedPath = path.join(getCcsDir(), `${name}.settings.json`);
  if (fs.existsSync(expandedPath)) {
    fs.unlinkSync(expandedPath);
  }
}

/** Remove an API profile */
export function removeApiProfile(name: string): RemoveApiProfileResult {
  try {
    if (isUnifiedMode()) {
      removeApiProfileUnified(name);
    } else {
      removeApiProfileLegacy(name);
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}
