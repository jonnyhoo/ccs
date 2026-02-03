import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Config, isConfig, Settings, isSettings, CLIProxyVariantsConfig } from '../types';
import { expandPath, error } from './helpers';
import { info } from './ui';
import { isUnifiedMode, loadOrCreateUnifiedConfig } from '../config/unified-config-loader';

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
 * Get config file path (legacy JSON path)
 * @deprecated Use getActiveConfigPath() for mode-aware config path
 */
export function getConfigPath(): string {
  return process.env.CCS_CONFIG || path.join(getCcsHome(), '.ccs', 'config.json');
}

/**
 * Get the active config file path based on current mode.
 * Returns config.yaml in unified mode, config.json in legacy mode.
 * @returns Path to the active config file
 */
export function getActiveConfigPath(): string {
  const ccsDir = getCcsDir();
  if (isUnifiedMode()) {
    return path.join(ccsDir, 'config.yaml');
  }
  return path.join(ccsDir, 'config.json');
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
 * Load config safely with unified mode support.
 * Returns Config with profiles from unified config.yaml or legacy config.json.
 * Throws on error (catchable) instead of process.exit.
 * Use this in web server routes where try/catch is needed.
 */
export function loadConfigSafe(): Config {
  // Unified mode: extract profiles from config.yaml
  if (isUnifiedMode()) {
    const unifiedConfig = loadOrCreateUnifiedConfig();

    // Convert unified profiles to legacy format for compatibility
    const profiles: Record<string, string> = {};
    for (const [name, profile] of Object.entries(unifiedConfig.profiles)) {
      if (profile.settings) {
        profiles[name] = profile.settings;
      }
    }

    // Convert unified cliproxy variants to legacy format
    let cliproxy: CLIProxyVariantsConfig | undefined;
    if (unifiedConfig.cliproxy?.variants) {
      cliproxy = {};
      for (const [name, variant] of Object.entries(unifiedConfig.cliproxy.variants)) {
        cliproxy[name] = {
          provider: variant.provider,
          settings: variant.settings,
          account: variant.account,
          port: variant.port,
        };
      }
    }

    return {
      profiles,
      cliproxy,
    };
  }

  // Legacy mode: read config.json
  const configPath = getConfigPath();

  if (!fs.existsSync(configPath)) {
    // Return empty config for graceful degradation (matches unified mode behavior)
    return { profiles: {} };
  }

  const raw = fs.readFileSync(configPath, 'utf8');

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(`Malformed JSON in config: ${configPath} - ${(e as Error).message}`);
  }

  if (!isConfig(parsed)) {
    throw new Error(`Invalid config format: ${configPath}`);
  }

  return parsed;
}

/**
 * Get settings path for profile.
 * In unified mode (config.yaml exists), reads from config.yaml first,
 * then falls back to config.json for backward compatibility.
 */
export function getSettingsPath(profile: string): string {
  let settingsPath: string | undefined;
  let availableProfiles: string[] = [];

  // Check unified config first (config.yaml)
  if (isUnifiedMode()) {
    const unifiedConfig = loadOrCreateUnifiedConfig();

    // Check if profile exists in unified config
    const profileConfig = unifiedConfig.profiles[profile];
    if (profileConfig?.settings) {
      settingsPath = profileConfig.settings;
    }

    // Collect available profiles from unified config
    availableProfiles = Object.keys(unifiedConfig.profiles);

    // If not found in unified config, try legacy config.json as fallback
    if (!settingsPath) {
      // Use inline safe logic - loadConfig() calls process.exit() which cannot be caught
      const configPath = getConfigPath();
      if (fs.existsSync(configPath)) {
        try {
          const raw = fs.readFileSync(configPath, 'utf8');
          const legacyConfig: unknown = JSON.parse(raw);
          if (isConfig(legacyConfig) && legacyConfig.profiles[profile]) {
            settingsPath = legacyConfig.profiles[profile];
            // Merge legacy profiles into available list (avoid duplicates)
            for (const p of Object.keys(legacyConfig.profiles)) {
              if (!availableProfiles.includes(p)) {
                availableProfiles.push(p);
              }
            }
          }
        } catch {
          // Legacy config is invalid JSON - that's OK in unified mode
        }
      }
    }
  } else {
    // Legacy mode - read from config.json only
    const config = readConfig();
    settingsPath = config.profiles[profile];
    availableProfiles = Object.keys(config.profiles);
  }

  if (!settingsPath) {
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

      console.log(info('Auto-created missing settings file'));
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

/**
 * Get display name for a profile by reading ANTHROPIC_MODEL from settings
 * @param profile - Profile name (glm, glmt, kimi, custom, etc.)
 * @returns Formatted display name (e.g., 'GLM-4.7', 'Kimi', 'Custom-Model')
 */
export function getModelDisplayName(profile: string): string {
  if (!profile) {
    return '';
  }

  const settingsPath = path.join(getCcsDir(), `${profile}.settings.json`);

  try {
    if (fs.existsSync(settingsPath)) {
      const content = fs.readFileSync(settingsPath, 'utf8');
      const settings = JSON.parse(content) as { env?: { ANTHROPIC_MODEL?: string } };
      const model = settings.env?.ANTHROPIC_MODEL;

      if (model) {
        // Format: 'glm-4.7' -> 'GLM-4.7' (uppercase letters, preserve numbers)
        return model
          .split('-')
          .map((part) => part.toUpperCase())
          .join('-');
      }
    }
  } catch {
    // Fall through to default
  }

  // Fallback: profile name uppercase
  return profile.toUpperCase();
}
