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
 * Main CCS configuration
 * Located at: ~/.ccs/config.json
 */
export interface Config {
  profiles: ProfilesConfig;
}

/**
 * Environment variables (string-only constraint)
 * CRITICAL: All values MUST be strings (no booleans/objects)
 * Reason: PowerShell crashes on non-string values
 */
export type EnvValue = string;
export type EnvVars = Record<string, EnvValue>;

/**
 * Claude CLI settings.json structure
 * Located at: ~/.claude/settings.json or profile-specific
 */
export interface Settings {
  env?: EnvVars;
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
    typeof obj === 'object' &&
    obj !== null &&
    'profiles' in obj &&
    typeof obj.profiles === 'object'
  );
}

export function isSettings(obj: unknown): obj is Settings {
  if (typeof obj !== 'object' || obj === null) return false;
  if (!('env' in obj)) return true; // env is optional
  if (typeof obj.env !== 'object' || obj.env === null) return false;
  // Validate all env values are strings
  return Object.values(obj.env).every(v => typeof v === 'string');
}