/**
 * CCS Configuration Types
 * Source: ~/.ccs/config.json
 */

/**
 * Profile configuration mapping
 * Maps profile names to settings.json paths
 */
export interface ProfilesConfig {
  [profileName: string]: string; // Path to settings.json
}

/**
 * CLIProxy variant configuration
 * Allows user-defined CLIProxy profile variants with custom settings
 * Example: "flash" → gemini provider with gemini-2.5-flash model
 */
export interface CLIProxyVariantConfig {
  /** CLIProxy provider to use (gemini, codex, agy, qwen) */
  provider: 'gemini' | 'codex' | 'agy' | 'qwen';
  /** Path to settings.json with custom model configuration */
  settings: string;
  /** Account identifier for multi-account support (optional, defaults to 'default') */
  account?: string;
  /** Unique port for variant isolation (8318-8417) */
  port?: number;
}

/**
 * CLIProxy variants section in config.json
 * Maps custom profile names to CLIProxy provider + settings
 */
export interface CLIProxyVariantsConfig {
  [profileName: string]: CLIProxyVariantConfig;
}

/**
 * Main CCS configuration
 * Located at: ~/.ccs/config.json
 */
export interface Config {
  /** Settings-based profiles (GLM, Kimi, etc.) */
  profiles: ProfilesConfig;
  /** User-defined CLIProxy profile variants (optional) */
  cliproxy?: CLIProxyVariantsConfig;
}

/**
 * Environment variables (string-only constraint)
 * CRITICAL: All values MUST be strings (no booleans/objects)
 * Reason: PowerShell crashes on non-string values
 */
export type EnvValue = string;
export type EnvVars = Record<string, EnvValue>;

/**
 * Model preset configuration
 * Stores named model mappings for quick switching
 */
export interface ModelPreset {
  name: string;
  default: string;
  opus: string;
  sonnet: string;
  haiku: string;
}

/**
 * Claude CLI settings.json structure
 * Located at: ~/.claude/settings.json or profile-specific
 */
export interface Settings {
  env?: EnvVars;
  /** Saved model presets for this provider */
  presets?: ModelPreset[];
  [key: string]: unknown; // Allow other settings
}

/**
 * Profile metadata (profiles.json)
 * Located at: ~/.ccs/profiles.json
 */
export interface ProfileMetadata {
  type?: string; // Profile type (e.g., 'account')
  created: string; // Creation time
  last_used?: string | null; // Last usage time
}

export interface ProfilesRegistry {
  profiles: Record<string, ProfileMetadata>;
}

/**
 * Type guards
 */
export function isConfig(obj: unknown): obj is Config {
  return (
    typeof obj === 'object' && obj !== null && 'profiles' in obj && typeof obj.profiles === 'object'
  );
}

export function isSettings(obj: unknown): obj is Settings {
  if (typeof obj !== 'object' || obj === null) return false;
  if (!('env' in obj)) return true; // env is optional
  if (typeof obj.env !== 'object' || obj.env === null) return false;
  // Validate all env values are strings
  return Object.values(obj.env).every((v) => typeof v === 'string');
}
