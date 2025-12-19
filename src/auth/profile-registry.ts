import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ProfileMetadata } from '../types';
import {
  loadOrCreateUnifiedConfig,
  saveUnifiedConfig,
  isUnifiedMode,
} from '../config/unified-config-loader';

/**
 * Profile Registry (Simplified)
 *
 * Manages account profile metadata in ~/.ccs/profiles.json
 * Each profile represents an isolated Claude instance with login credentials.
 *
 * Profile Schema (v3.0 - Minimal):
 * {
 *   type: 'account',         // Profile type
 *   created: <ISO timestamp>, // Creation time
 *   last_used: <ISO timestamp or null> // Last usage time
 * }
 *
 * Removed fields from v2.x:
 * - vault: No encrypted vault (credentials in instance)
 * - subscription: No credential reading
 * - email: No credential reading
 */

interface ProfileData {
  version: string;
  profiles: Record<string, ProfileMetadata>;
  default: string | null;
}

interface CreateMetadata {
  type?: string;
  created?: string;
  last_used?: string | null;
}

export class ProfileRegistry {
  private profilesPath: string;

  constructor() {
    this.profilesPath = path.join(os.homedir(), '.ccs', 'profiles.json');
  }

  /**
   * Read profiles from disk
   */
  private _read(): ProfileData {
    if (!fs.existsSync(this.profilesPath)) {
      return {
        version: '2.0.0',
        profiles: {},
        default: null,
      };
    }

    try {
      const data = fs.readFileSync(this.profilesPath, 'utf8');
      return JSON.parse(data) as ProfileData;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to read profiles: ${message}`);
    }
  }

  /**
   * Write profiles to disk atomically
   */
  private _write(data: ProfileData): void {
    const dir = path.dirname(this.profilesPath);

    // Ensure directory exists
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    }

    // Atomic write: temp file + rename
    const tempPath = `${this.profilesPath}.tmp`;

    try {
      fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), { mode: 0o600 });
      fs.renameSync(tempPath, this.profilesPath);
    } catch (error) {
      // Cleanup temp file on error
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to write profiles: ${message}`);
    }
  }

  /**
   * Create a new profile
   */
  createProfile(name: string, metadata: CreateMetadata = {}): void {
    const data = this._read();

    if (data.profiles[name]) {
      throw new Error(`Profile already exists: ${name}`);
    }

    // v3.0 minimal schema: only essential fields
    data.profiles[name] = {
      type: metadata.type || 'account',
      created: metadata.created || new Date().toISOString(),
      last_used: metadata.last_used || null,
    };

    // Note: No longer auto-set as default
    // Users must explicitly run: ccs auth default <profile>
    // Default always stays on implicit 'default' profile (uses ~/.claude/)

    this._write(data);
  }

  /**
   * Get profile metadata
   */
  getProfile(name: string): ProfileMetadata {
    const data = this._read();

    if (!data.profiles[name]) {
      throw new Error(`Profile not found: ${name}`);
    }

    return data.profiles[name];
  }

  /**
   * Update profile metadata
   */
  updateProfile(name: string, updates: Partial<ProfileMetadata>): void {
    const data = this._read();

    if (!data.profiles[name]) {
      throw new Error(`Profile not found: ${name}`);
    }

    data.profiles[name] = {
      ...data.profiles[name],
      ...updates,
    };

    this._write(data);
  }

  /**
   * Delete a profile
   */
  deleteProfile(name: string): void {
    const data = this._read();

    if (!data.profiles[name]) {
      throw new Error(`Profile not found: ${name}`);
    }

    delete data.profiles[name];

    // Clear default if it was the deleted profile
    if (data.default === name) {
      // Set to first remaining profile or null
      const remaining = Object.keys(data.profiles);
      data.default = remaining.length > 0 ? remaining[0] : null;
    }

    this._write(data);
  }

  /**
   * List all profiles
   */
  listProfiles(): string[] {
    const data = this._read();
    return Object.keys(data.profiles);
  }

  /**
   * Get all profiles with metadata
   */
  getAllProfiles(): Record<string, ProfileMetadata> {
    const data = this._read();
    return data.profiles;
  }

  /**
   * Get default profile name
   */
  getDefaultProfile(): string | null {
    const data = this._read();
    return data.default;
  }

  /**
   * Set default profile
   */
  setDefaultProfile(name: string): void {
    const data = this._read();

    if (!data.profiles[name]) {
      throw new Error(`Profile not found: ${name}`);
    }

    data.default = name;
    this._write(data);
  }

  /**
   * Clear default profile (restore original CCS behavior)
   */
  clearDefaultProfile(): void {
    const data = this._read();
    data.default = null;
    this._write(data);
  }

  /**
   * Check if profile exists
   */
  hasProfile(name: string): boolean {
    const data = this._read();
    return !!data.profiles[name];
  }

  /**
   * Update last used timestamp
   */
  touchProfile(name: string): void {
    this.updateProfile(name, {
      last_used: new Date().toISOString(),
    });
  }

  // ==========================================
  // Unified Config Methods
  // ==========================================

  /**
   * Create account in unified config (config.yaml)
   */
  createAccountUnified(name: string): void {
    const config = loadOrCreateUnifiedConfig();
    if (config.accounts[name]) {
      throw new Error(`Account already exists: ${name}`);
    }
    config.accounts[name] = {
      created: new Date().toISOString(),
      last_used: null,
    };
    saveUnifiedConfig(config);
  }

  /**
   * Remove account from unified config
   */
  removeAccountUnified(name: string): void {
    const config = loadOrCreateUnifiedConfig();
    if (!config.accounts[name]) {
      throw new Error(`Account not found: ${name}`);
    }
    delete config.accounts[name];
    // Clear default if it was the deleted account
    if (config.default === name) {
      config.default = undefined;
    }
    saveUnifiedConfig(config);
  }

  /**
   * Set default profile in unified config
   */
  setDefaultUnified(name: string): void {
    const config = loadOrCreateUnifiedConfig();
    // Check if exists in accounts, profiles, or cliproxy variants
    const exists =
      config.accounts[name] || config.profiles[name] || config.cliproxy?.variants?.[name];
    if (!exists) {
      throw new Error(`Profile not found: ${name}`);
    }
    config.default = name;
    saveUnifiedConfig(config);
  }

  /**
   * Clear default profile in unified config (restore original CCS behavior)
   */
  clearDefaultUnified(): void {
    const config = loadOrCreateUnifiedConfig();
    config.default = undefined;
    saveUnifiedConfig(config);
  }

  /**
   * Check if account exists in unified config
   */
  hasAccountUnified(name: string): boolean {
    if (!isUnifiedMode()) return false;
    const config = loadOrCreateUnifiedConfig();
    return !!config.accounts[name];
  }

  /**
   * Get all accounts from unified config
   */
  getAllAccountsUnified(): Record<string, { created: string; last_used: string | null }> {
    if (!isUnifiedMode()) return {};
    const config = loadOrCreateUnifiedConfig();
    return config.accounts;
  }

  /**
   * Get default from unified config
   */
  getDefaultUnified(): string | undefined {
    if (!isUnifiedMode()) return undefined;
    const config = loadOrCreateUnifiedConfig();
    return config.default;
  }

  /**
   * Update account last_used in unified config
   */
  touchAccountUnified(name: string): void {
    const config = loadOrCreateUnifiedConfig();
    if (!config.accounts[name]) {
      throw new Error(`Account not found: ${name}`);
    }
    config.accounts[name].last_used = new Date().toISOString();
    saveUnifiedConfig(config);
  }
}

export default ProfileRegistry;
