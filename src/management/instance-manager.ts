/**
 * Instance Manager (Simplified)
 *
 * Manages isolated Claude CLI instances per profile for concurrent sessions.
 * Each instance is an isolated CLAUDE_CONFIG_DIR where users login directly.
 * No credential copying/encryption - Claude manages credentials per instance.
 */

import * as fs from 'fs';
import * as path from 'path';
import SharedManager from './shared-manager';
import { getCcsDir } from '../utils/config-manager';

/**
 * Instance Manager Class
 */
class InstanceManager {
  private readonly instancesDir: string;
  private readonly sharedManager: SharedManager;

  constructor() {
    this.instancesDir = path.join(getCcsDir(), 'instances');
    this.sharedManager = new SharedManager();
  }

  /**
   * Ensure instance exists for profile (lazy init only)
   */
  ensureInstance(profileName: string): string {
    const instancePath = this.getInstancePath(profileName);

    // Lazy initialization
    if (!fs.existsSync(instancePath)) {
      this.initializeInstance(profileName, instancePath);
    }

    // Validate structure (auto-fix missing dirs)
    this.validateInstance(instancePath);

    return instancePath;
  }

  /**
   * Get instance path for profile
   */
  getInstancePath(profileName: string): string {
    const safeName = this.sanitizeName(profileName);
    return path.join(this.instancesDir, safeName);
  }

  /**
   * Initialize new instance directory
   */
  private initializeInstance(profileName: string, instancePath: string): void {
    try {
      // Create base directory
      fs.mkdirSync(instancePath, { recursive: true, mode: 0o700 });

      // Create Claude-expected subdirectories (profile-specific only)
      const subdirs = [
        'session-env',
        'todos',
        'logs',
        'file-history',
        'shell-snapshots',
        'debug',
        '.anthropic',
      ];

      subdirs.forEach((dir) => {
        const dirPath = path.join(instancePath, dir);
        if (!fs.existsSync(dirPath)) {
          fs.mkdirSync(dirPath, { recursive: true, mode: 0o700 });
        }
      });

      // Symlink shared directories (Phase 1: commands, skills)
      this.sharedManager.linkSharedDirectories(instancePath);

      // Copy global configs if exist (settings.json only)
      this.copyGlobalConfigs(instancePath);
    } catch (error) {
      throw new Error(
        `Failed to initialize instance for ${profileName}: ${(error as Error).message}`
      );
    }
  }

  /**
   * Validate instance directory structure (auto-fix missing directories)
   */
  private validateInstance(instancePath: string): void {
    // Check required directories (auto-create if missing for migration)
    const requiredDirs = [
      'session-env',
      'todos',
      'logs',
      'file-history',
      'shell-snapshots',
      'debug',
      '.anthropic',
    ];

    for (const dir of requiredDirs) {
      const dirPath = path.join(instancePath, dir);
      if (!fs.existsSync(dirPath)) {
        // Auto-create missing directory (migration from older versions)
        fs.mkdirSync(dirPath, { recursive: true, mode: 0o700 });
      }
    }

    // Note: Credentials managed by Claude CLI in instance (no validation needed)
  }

  /**
   * Delete instance for profile
   */
  deleteInstance(profileName: string): void {
    const instancePath = this.getInstancePath(profileName);

    if (!fs.existsSync(instancePath)) {
      return;
    }

    // Recursive delete
    fs.rmSync(instancePath, { recursive: true, force: true });
  }

  /**
   * List all instance names
   */
  listInstances(): string[] {
    if (!fs.existsSync(this.instancesDir)) {
      return [];
    }

    return fs.readdirSync(this.instancesDir).filter((name) => {
      const instancePath = path.join(this.instancesDir, name);
      return fs.statSync(instancePath).isDirectory();
    });
  }

  /**
   * Check if instance exists for profile
   */
  hasInstance(profileName: string): boolean {
    const instancePath = this.getInstancePath(profileName);
    return fs.existsSync(instancePath);
  }

  /**
   * Copy global configs to instance (optional)
   */
  private copyGlobalConfigs(_instancePath: string): void {
    // No longer needed - settings.json now symlinked via SharedManager
    // Keeping method for backward compatibility (empty implementation)
    // Can be removed in future major version
  }

  /**
   * Copy directory recursively - Currently unused
   */
  /*
  private copyDirectory(src: string, dest: string): void {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true, mode: 0o700 });
    }

    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        this.copyDirectory(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }
  */

  /**
   * Sanitize profile name for filesystem
   */
  private sanitizeName(name: string): string {
    // Replace unsafe characters with dash
    return name.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase();
  }
}

export { InstanceManager };
export default InstanceManager;
