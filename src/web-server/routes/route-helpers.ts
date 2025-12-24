/**
 * Route Helpers - Shared utility functions for route handlers
 */

import * as fs from 'fs';
import * as path from 'path';
import { getCcsDir, getConfigPath, loadConfig, loadSettings } from '../../utils/config-manager';
import { expandPath } from '../../utils/helpers';
import type { Config, Settings } from '../../types/config';

/** Model mapping for API profiles */
export interface ModelMapping {
  model?: string;
  opusModel?: string;
  sonnetModel?: string;
  haikuModel?: string;
}

/**
 * Read config safely with fallback
 */
export function readConfigSafe(): Config {
  try {
    return loadConfig();
  } catch {
    return { profiles: {} };
  }
}

/**
 * Write config atomically
 */
export function writeConfig(config: Config): void {
  const configPath = getConfigPath();
  const tempPath = configPath + '.tmp';
  fs.writeFileSync(tempPath, JSON.stringify(config, null, 2) + '\n');
  fs.renameSync(tempPath, configPath);
}

/**
 * Check if profile is configured (has valid settings file)
 */
export function isConfigured(profileName: string, config: Config): boolean {
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
 * Create settings file for profile
 */
export function createSettingsFile(
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
 * Update settings file
 */
export function updateSettingsFile(
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
 * Security: Validate file path is within allowed directories
 * - ~/.ccs/ directory: read/write allowed
 * - ~/.claude/settings.json: read-only
 */
export function validateFilePath(filePath: string): {
  valid: boolean;
  readonly: boolean;
  error?: string;
} {
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
