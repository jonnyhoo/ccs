/**
 * Unified Config Loader
 *
 * Loads and saves the unified YAML configuration.
 * Provides fallback to legacy JSON format for backward compatibility.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { getCcsDir } from '../utils/config-manager';
import {
  UnifiedConfig,
  isUnifiedConfig,
  createEmptyUnifiedConfig,
  UNIFIED_CONFIG_VERSION,
} from './unified-config-types';
import { isUnifiedConfigEnabled } from './feature-flags';

const CONFIG_YAML = 'config.yaml';
const CONFIG_JSON = 'config.json';

/**
 * Get path to unified config.yaml
 */
export function getConfigYamlPath(): string {
  return path.join(getCcsDir(), CONFIG_YAML);
}

/**
 * Get path to legacy config.json
 */
export function getConfigJsonPath(): string {
  return path.join(getCcsDir(), CONFIG_JSON);
}

/**
 * Check if unified config.yaml exists
 */
export function hasUnifiedConfig(): boolean {
  return fs.existsSync(getConfigYamlPath());
}

/**
 * Check if legacy config.json exists
 */
export function hasLegacyConfig(): boolean {
  return fs.existsSync(getConfigJsonPath());
}

/**
 * Determine which config format is active.
 * Returns 'yaml' if unified config exists or is enabled,
 * 'json' if only legacy config exists,
 * 'none' if no config exists.
 */
export function getConfigFormat(): 'yaml' | 'json' | 'none' {
  if (hasUnifiedConfig()) return 'yaml';
  if (isUnifiedConfigEnabled()) return 'yaml';
  if (hasLegacyConfig()) return 'json';
  return 'none';
}

/**
 * Load unified config from YAML file.
 * Returns null if file doesn't exist or format check fails.
 * Auto-upgrades config if version is outdated (regenerates comments).
 */
export function loadUnifiedConfig(): UnifiedConfig | null {
  const yamlPath = getConfigYamlPath();

  // If file doesn't exist, return null
  if (!fs.existsSync(yamlPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(yamlPath, 'utf8');
    const parsed = yaml.load(content);

    if (!isUnifiedConfig(parsed)) {
      console.error(`[!] Invalid config format in ${yamlPath}`);
      return null;
    }

    // Auto-upgrade if version is outdated (regenerates YAML with new comments)
    if ((parsed.version ?? 1) < UNIFIED_CONFIG_VERSION) {
      parsed.version = UNIFIED_CONFIG_VERSION;
      try {
        saveUnifiedConfig(parsed);
        if (process.env.CCS_DEBUG) {
          console.error(`[i] Config upgraded to v${UNIFIED_CONFIG_VERSION}`);
        }
      } catch {
        // Ignore save errors during upgrade - config still works
      }
    }

    return parsed;
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[X] Failed to load config: ${error}`);
    return null;
  }
}

/**
 * Merge partial config with defaults.
 * Preserves existing data while filling in missing sections.
 */
function mergeWithDefaults(partial: Partial<UnifiedConfig>): UnifiedConfig {
  const defaults = createEmptyUnifiedConfig();
  return {
    version: partial.version ?? defaults.version,
    default: partial.default ?? defaults.default,
    accounts: partial.accounts ?? defaults.accounts,
    profiles: partial.profiles ?? defaults.profiles,
    cliproxy: {
      oauth_accounts: partial.cliproxy?.oauth_accounts ?? defaults.cliproxy.oauth_accounts,
      providers: defaults.cliproxy.providers, // Always use defaults for providers
      variants: partial.cliproxy?.variants ?? defaults.cliproxy.variants,
      logging: {
        enabled: partial.cliproxy?.logging?.enabled ?? defaults.cliproxy.logging?.enabled ?? false,
        request_log:
          partial.cliproxy?.logging?.request_log ?? defaults.cliproxy.logging?.request_log ?? false,
      },
    },
    preferences: {
      ...defaults.preferences,
      ...partial.preferences,
    },
    websearch: {
      enabled: partial.websearch?.enabled ?? defaults.websearch?.enabled ?? true,
      providers: {
        gemini: {
          enabled:
            partial.websearch?.providers?.gemini?.enabled ??
            partial.websearch?.gemini?.enabled ?? // Legacy fallback
            true,
          timeout:
            partial.websearch?.providers?.gemini?.timeout ??
            partial.websearch?.gemini?.timeout ?? // Legacy fallback
            55,
        },
      },
      // Legacy fields (keep for backwards compatibility during read)
      gemini: partial.websearch?.gemini,
    },
  };
}

/**
 * Load config, preferring YAML if available, falling back to creating empty config.
 * Merges with defaults to ensure all sections exist.
 */
export function loadOrCreateUnifiedConfig(): UnifiedConfig {
  const existing = loadUnifiedConfig();
  if (existing) {
    // Merge with defaults to fill any missing sections
    return mergeWithDefaults(existing);
  }

  // Create empty config
  const config = createEmptyUnifiedConfig();
  return config;
}

/**
 * Generate YAML header with helpful comments.
 */
function generateYamlHeader(): string {
  return `# ============================================================================
# CCS Unified Configuration (config.yaml)
# ============================================================================
# Generated by: ccs migrate
# Documentation: https://github.com/kaitranntt/ccs
#
# This file references your settings - actual env vars are in *.settings.json
# files (matching Claude's ~/.claude/settings.json pattern).
#
# To customize a profile:
#   1. Edit the *.settings.json file directly (e.g., ~/.ccs/glm.settings.json)
#   2. The file format matches Claude's settings.json: { "env": { ... } }\n#
# Structure:
# ┌─────────────────────────────────────────────────────────────────────────────┐
# │ profiles      - References to *.settings.json files for API providers       │
# │ cliproxy      - References to *.settings.json files for OAuth providers     │
# │ accounts      - Isolated Claude instances (managed by 'ccs auth')           │
# │ preferences   - User preferences (theme, telemetry, auto-update)            │
# └─────────────────────────────────────────────────────────────────────────────┘
#
# Usage:
#   ccs <profile>              Switch to profile
#   ccs api add <name>         Add new API profile
#   ccs cliproxy create        Create CLIProxy variant
#   ccs migrate --rollback     Restore from backup
#
`;
}

/**
 * Generate YAML content with section comments for better readability.
 */
function generateYamlWithComments(config: UnifiedConfig): string {
  const lines: string[] = [];

  // Version
  lines.push(`version: ${config.version}`);
  lines.push('');

  // Default
  if (config.default) {
    lines.push(`# Default profile used when running 'ccs' without arguments`);
    lines.push(`default: "${config.default}"`);
    lines.push('');
  }

  // Accounts section
  lines.push('# ----------------------------------------------------------------------------');
  lines.push('# Accounts: Isolated Claude instances (each with separate auth/sessions)');
  lines.push('# Manage with: ccs auth add <name>, ccs auth list, ccs auth remove <name>');
  lines.push('# ----------------------------------------------------------------------------');
  lines.push(
    yaml.dump({ accounts: config.accounts }, { indent: 2, lineWidth: -1, quotingType: '"' }).trim()
  );
  lines.push('');

  // Profiles section
  lines.push('# ----------------------------------------------------------------------------');
  lines.push('# Profiles: API-based providers (GLM, GLMT, Kimi, custom endpoints)');
  lines.push('# Each profile points to a *.settings.json file containing env vars.');
  lines.push('# Edit the settings file directly to customize (ANTHROPIC_MAX_TOKENS, etc.)');
  lines.push('# ----------------------------------------------------------------------------');
  lines.push(
    yaml.dump({ profiles: config.profiles }, { indent: 2, lineWidth: -1, quotingType: '"' }).trim()
  );
  lines.push('');

  // CLIProxy section
  lines.push('# ----------------------------------------------------------------------------');
  lines.push('# CLIProxy: OAuth-based providers (gemini, codex, agy, qwen, iflow)');
  lines.push('# Each variant can reference a *.settings.json file for custom env vars.');
  lines.push('# Edit the settings file directly to customize model or other settings.');
  lines.push('# ----------------------------------------------------------------------------');
  lines.push(
    yaml.dump({ cliproxy: config.cliproxy }, { indent: 2, lineWidth: -1, quotingType: '"' }).trim()
  );
  lines.push('');

  // Preferences section
  lines.push('# ----------------------------------------------------------------------------');
  lines.push('# Preferences: User settings');
  lines.push('# ----------------------------------------------------------------------------');
  lines.push(
    yaml
      .dump({ preferences: config.preferences }, { indent: 2, lineWidth: -1, quotingType: '"' })
      .trim()
  );
  lines.push('');

  // WebSearch section
  if (config.websearch) {
    lines.push('# ----------------------------------------------------------------------------');
    lines.push('# WebSearch: CLI-based web search for third-party profiles');
    lines.push('# Dashboard (`ccs config`) is the source of truth for provider selection.');
    lines.push('#');
    lines.push('# Third-party providers (gemini, codex, agy, etc.) do not have access to');
    lines.push("# Anthropic's WebSearch tool. These CLI tools provide fallback web search.");
    lines.push('#');
    lines.push('# providers:');
    lines.push('#   gemini: Gemini CLI (FREE) - npm i -g @google/gemini-cli');
    lines.push('#   grok: Grok CLI (paid) - npm i -g @vibe-kit/grok-cli (needs GROK_API_KEY)');
    lines.push('#');
    lines.push('# enabled: Master switch - auto-disables when no providers enabled');
    lines.push('# ----------------------------------------------------------------------------');
    lines.push(
      yaml
        .dump({ websearch: config.websearch }, { indent: 2, lineWidth: -1, quotingType: '"' })
        .trim()
    );
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Save unified config to YAML file.
 * Uses atomic write (temp file + rename) to prevent corruption.
 */
export function saveUnifiedConfig(config: UnifiedConfig): void {
  const yamlPath = getConfigYamlPath();
  const dir = path.dirname(yamlPath);

  // Ensure directory exists
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }

  // Ensure version is set
  config.version = UNIFIED_CONFIG_VERSION;

  // Generate YAML with section comments
  const yamlContent = generateYamlWithComments(config);
  const content = generateYamlHeader() + yamlContent;

  // Atomic write: write to temp file, then rename
  const tempPath = `${yamlPath}.tmp.${process.pid}`;

  try {
    fs.writeFileSync(tempPath, content, { mode: 0o600 });
    fs.renameSync(tempPath, yamlPath);
  } catch (err) {
    // Clean up temp file on error
    if (fs.existsSync(tempPath)) {
      try {
        fs.unlinkSync(tempPath);
      } catch {
        // Ignore cleanup errors
      }
    }
    throw err;
  }
}

/**
 * Update unified config with partial data.
 * Loads existing config, merges changes, and saves.
 */
export function updateUnifiedConfig(updates: Partial<UnifiedConfig>): UnifiedConfig {
  const config = loadOrCreateUnifiedConfig();
  const updated = { ...config, ...updates };
  saveUnifiedConfig(updated);
  return updated;
}

/**
 * Get or set default profile name.
 */
export function getDefaultProfile(): string | undefined {
  const config = loadUnifiedConfig();
  return config?.default;
}

export function setDefaultProfile(name: string): void {
  updateUnifiedConfig({ default: name });
}

/**
 * Gemini CLI WebSearch configuration
 */
export interface GeminiWebSearchInfo {
  enabled: boolean;
  timeout: number;
}

/**
 * Get websearch configuration.
 * Returns defaults if not configured.
 * Simplified: Gemini CLI only (future CLI tools can be added).
 */
export function getWebSearchConfig(): {
  enabled: boolean;
  providers?: {
    gemini?: GeminiWebSearchInfo;
  };
  // Legacy fields (deprecated)
  gemini?: { enabled?: boolean; timeout?: number };
} {
  const config = loadOrCreateUnifiedConfig();

  // Build provider config from new format or legacy fallbacks
  const geminiConfig: GeminiWebSearchInfo = {
    enabled:
      config.websearch?.providers?.gemini?.enabled ?? config.websearch?.gemini?.enabled ?? true,
    timeout:
      config.websearch?.providers?.gemini?.timeout ?? config.websearch?.gemini?.timeout ?? 55,
  };

  // Auto-disable master switch if Gemini is not enabled
  const enabled = geminiConfig.enabled && (config.websearch?.enabled ?? true);

  return {
    enabled,
    providers: {
      gemini: geminiConfig,
    },
    // Legacy field for backwards compatibility
    gemini: config.websearch?.gemini,
  };
}
