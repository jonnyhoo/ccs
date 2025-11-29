import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Config, isConfig, Settings, isSettings } from '../types';
import { expandPath } from './helpers';
import { error } from './helpers';

// TODO: Replace with proper imports after converting these files
// const { ErrorManager } = require('./error-manager');
// const RecoveryManager = require('./recovery-manager');

/**
 * Get the CCS home directory (respects CCS_HOME env var for test isolation)
 * @returns Home directory path
 */
export function getCcsHome(): string {
  return process.env.CCS_HOME || os.homedir();
}

/**
 * Get the CCS directory path (~/.ccs)
 * @returns Path to .ccs directory
 */
export function getCcsDir(): string {
  return path.join(getCcsHome(), '.ccs');
}

/**
 * Get config file path
 */
export function getConfigPath(): string {
  return process.env.CCS_CONFIG || path.join(getCcsHome(), '.ccs', 'config.json');
}

/**
 * Load and validate config.json
 */
export function loadConfig(): Config {
  const configPath = getConfigPath();

  if (!fs.existsSync(configPath)) {
    // TODO: Add recovery manager logic
    // const recovery = new RecoveryManager();
    // recovery.ensureConfigJson();

    error(`Config not found: ${configPath}`);
  }

  const raw = fs.readFileSync(configPath, 'utf8');
  const parsed: unknown = JSON.parse(raw);

  if (!isConfig(parsed)) {
    error(`Invalid config format: ${configPath}`);
  }

  return parsed;
}

/**
 * Load and validate settings.json
 */
export function loadSettings(settingsPath: string): Settings {
  if (!fs.existsSync(settingsPath)) {
    error(`Settings not found: ${settingsPath}`);
  }

  const raw = fs.readFileSync(settingsPath, 'utf8');
  const parsed: unknown = JSON.parse(raw);

  if (!isSettings(parsed)) {
    error(`Invalid settings format: ${settingsPath}`);
  }

  return parsed;
}

/**
 * Read and parse config (legacy compatibility)
 */
export function readConfig(): Config {
  return loadConfig();
}

/**
 * Get settings path for profile
 */
export function getSettingsPath(profile: string): string {
  const config = readConfig();

  // Get settings path
  const settingsPath = config.profiles[profile];

  if (!settingsPath) {
    const availableProfiles = Object.keys(config.profiles);
    const profileList = availableProfiles.map((p) => `  - ${p}`);
    error(`Profile '${profile}' not found. Available profiles:\n${profileList.join('\n')}`);
  }

  // Expand path
  const expandedPath = expandPath(settingsPath);

  // Validate settings file exists
  if (!fs.existsSync(expandedPath)) {
    // Auto-create if it's ~/.claude/settings.json
    if (expandedPath.includes('.claude') && expandedPath.endsWith('settings.json')) {
      // TODO: Add recovery manager logic
      // const recovery = new RecoveryManager();
      // recovery.ensureClaudeSettings();

      console.log('[i] Auto-created missing settings file');
    } else {
      error(`Settings file not found: ${expandedPath}`);
    }
  }

  // Validate settings file is valid JSON
  try {
    const settingsContent = fs.readFileSync(expandedPath, 'utf8');
    JSON.parse(settingsContent);
  } catch (e) {
    if (e instanceof Error) {
      error(`Invalid JSON in settings file: ${expandedPath} - ${e.message}`);
    } else {
      error(`Invalid JSON in settings file: ${expandedPath}`);
    }
  }

  return expandedPath;
}
