/**
 * API Profile Reader Service
 *
 * Read operations for API profiles.
 * Supports both unified YAML config and legacy JSON config.
 */

import * as fs from 'fs';
import * as path from 'path';
import { getCcsDir, loadConfigSafe } from '../../utils/config-manager';
import { loadOrCreateUnifiedConfig, isUnifiedMode } from '../../config/unified-config-loader';
import type { ApiProfileInfo, ApiListResult } from './profile-types';

/**
 * Check if API profile exists in config
 */
export function apiProfileExists(name: string): boolean {
  try {
    if (isUnifiedMode()) {
      const config = loadOrCreateUnifiedConfig();
      return name in config.profiles;
    }
    const config = loadConfigSafe();
    return name in config.profiles;
  } catch {
    return false;
  }
}

/**
 * Check if API profile has real API key (not placeholder)
 */
export function isApiProfileConfigured(apiName: string): boolean {
  try {
    const ccsDir = getCcsDir();
    const settingsPath = path.join(ccsDir, `${apiName}.settings.json`);

    // Check settings.json file for API key
    if (!fs.existsSync(settingsPath)) return false;

    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    const token = settings?.env?.ANTHROPIC_AUTH_TOKEN || '';
    return token.length > 0 && !token.includes('YOUR_') && !token.includes('your-');
  } catch {
    return false;
  }
}

/**
 * List all API profiles
 *
 * Note: The 'default' profile (pointing to ~/.claude/settings.json) is excluded
 * as it represents the user's native Claude subscription, not an API profile.
 */
export function listApiProfiles(): ApiListResult {
  const profiles: ApiProfileInfo[] = [];

  if (isUnifiedMode()) {
    const unifiedConfig = loadOrCreateUnifiedConfig();
    for (const [name, profile] of Object.entries(unifiedConfig.profiles)) {
      // Skip 'default' profile - it's the user's native Claude settings
      if (name === 'default' && profile.settings?.includes('.claude/settings.json')) {
        continue;
      }
      profiles.push({
        name,
        settingsPath: profile.settings || 'config.yaml',
        isConfigured: isApiProfileConfigured(name),
        configSource: 'unified',
      });
    }
  } else {
    const config = loadConfigSafe();
    for (const [name, settingsPath] of Object.entries(config.profiles)) {
      // Skip 'default' profile - it's the user's native Claude settings
      if (name === 'default' && (settingsPath as string).includes('.claude/settings.json')) {
        continue;
      }
      profiles.push({
        name,
        settingsPath: settingsPath as string,
        isConfigured: isApiProfileConfigured(name),
        configSource: 'legacy',
      });
    }
  }

  return { profiles };
}

/**
 * Get list of available API profile names
 */
export function getApiProfileNames(): string[] {
  if (isUnifiedMode()) {
    const config = loadOrCreateUnifiedConfig();
    return Object.keys(config.profiles);
  }
  const config = loadConfigSafe();
  return Object.keys(config.profiles);
}

/**
 * Check if using unified config mode
 */
export function isUsingUnifiedConfig(): boolean {
  return isUnifiedMode();
}
