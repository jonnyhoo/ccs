/**
 * SharedManager - Manages symlinked shared directories for CCS
 * v3.2.0: Symlink-based architecture
 *
 * Purpose: Eliminates duplication by symlinking:
 * ~/.claude/ ← ~/.ccs/shared/ ← instance/
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

interface SharedItem {
  name: string;
  type: 'directory' | 'file';
}

/**
 * SharedManager Class
 */
class SharedManager {
  private readonly homeDir: string;
  private readonly sharedDir: string;
  private readonly claudeDir: string;
  private readonly instancesDir: string;
  private readonly sharedItems: SharedItem[];

  constructor() {
    this.homeDir = os.homedir();
    this.sharedDir = path.join(this.homeDir, '.ccs', 'shared');
    this.claudeDir = path.join(this.homeDir, '.claude');
    this.instancesDir = path.join(this.homeDir, '.ccs', 'instances');
    this.sharedItems = [
      { name: 'commands', type: 'directory' },
      { name: 'skills', type: 'directory' },
      { name: 'agents', type: 'directory' },
      { name: 'plugins', type: 'directory' },
      { name: 'settings.json', type: 'file' },
    ];
  }

  /**
   * Detect circular symlink before creation
   */
  private detectCircularSymlink(target: string, linkPath: string): boolean {
    // Check if target exists and is symlink
    if (!fs.existsSync(target)) {
      return false;
    }

    try {
      const stats = fs.lstatSync(target);
      if (!stats.isSymbolicLink()) {
        return false;
      }

      // Resolve target's link
      const targetLink = fs.readlinkSync(target);
      const resolvedTarget = path.resolve(path.dirname(target), targetLink);

      // Check if target points back to our shared dir or link path
      const sharedDir = path.join(this.homeDir, '.ccs', 'shared');
      if (resolvedTarget.startsWith(sharedDir) || resolvedTarget === linkPath) {
        console.log(`[!] Circular symlink detected: ${target} → ${resolvedTarget}`);
        return true;
      }
    } catch (_err) {
      // If can't read, assume not circular
      return false;
    }

    return false;
  }

  /**
   * Ensure shared directories exist as symlinks to ~/.claude/
   * Creates ~/.claude/ structure if missing
   */
  ensureSharedDirectories(): void {
    // Create ~/.claude/ if missing
    if (!fs.existsSync(this.claudeDir)) {
      console.log('[i] Creating ~/.claude/ directory structure');
      fs.mkdirSync(this.claudeDir, { recursive: true, mode: 0o700 });
    }

    // Create shared directory
    if (!fs.existsSync(this.sharedDir)) {
      fs.mkdirSync(this.sharedDir, { recursive: true, mode: 0o700 });
    }

    // Create symlinks ~/.ccs/shared/* → ~/.claude/*
    for (const item of this.sharedItems) {
      const claudePath = path.join(this.claudeDir, item.name);
      const sharedPath = path.join(this.sharedDir, item.name);

      // Create in ~/.claude/ if missing
      if (!fs.existsSync(claudePath)) {
        if (item.type === 'directory') {
          fs.mkdirSync(claudePath, { recursive: true, mode: 0o700 });
        } else if (item.type === 'file') {
          // Create empty settings.json if missing
          fs.writeFileSync(claudePath, JSON.stringify({}, null, 2), 'utf8');
        }
      }

      // Check for circular symlink
      if (this.detectCircularSymlink(claudePath, sharedPath)) {
        console.log(`[!] Skipping ${item.name}: circular symlink detected`);
        continue;
      }

      // If already a symlink pointing to correct target, skip
      if (fs.existsSync(sharedPath)) {
        try {
          const stats = fs.lstatSync(sharedPath);
          if (stats.isSymbolicLink()) {
            const currentTarget = fs.readlinkSync(sharedPath);
            const resolvedTarget = path.resolve(path.dirname(sharedPath), currentTarget);
            if (resolvedTarget === claudePath) {
              continue; // Already correct
            }
          }
        } catch (_err) {
          // Continue to recreate
        }

        // Remove existing file/directory/link
        if (item.type === 'directory') {
          fs.rmSync(sharedPath, { recursive: true, force: true });
        } else {
          fs.unlinkSync(sharedPath);
        }
      }

      // Create symlink
      try {
        const symlinkType = item.type === 'directory' ? 'dir' : 'file';
        fs.symlinkSync(claudePath, sharedPath, symlinkType);
      } catch (_err) {
        // Windows fallback: copy
        if (process.platform === 'win32') {
          if (item.type === 'directory') {
            this.copyDirectoryFallback(claudePath, sharedPath);
          } else if (item.type === 'file') {
            fs.copyFileSync(claudePath, sharedPath);
          }
          console.log(
            `[!] Symlink failed for ${item.name}, copied instead (enable Developer Mode)`
          );
        } else {
          throw _err;
        }
      }
    }
  }

  /**
   * Link shared directories to instance
   */
  linkSharedDirectories(instancePath: string): void {
    this.ensureSharedDirectories();

    for (const item of this.sharedItems) {
      const linkPath = path.join(instancePath, item.name);
      const targetPath = path.join(this.sharedDir, item.name);

      // Remove existing file/directory/link
      if (fs.existsSync(linkPath)) {
        if (item.type === 'directory') {
          fs.rmSync(linkPath, { recursive: true, force: true });
        } else {
          fs.unlinkSync(linkPath);
        }
      }

      // Create symlink
      try {
        const symlinkType = item.type === 'directory' ? 'dir' : 'file';
        fs.symlinkSync(targetPath, linkPath, symlinkType);
      } catch (_err) {
        // Windows fallback
        if (process.platform === 'win32') {
          if (item.type === 'directory') {
            this.copyDirectoryFallback(targetPath, linkPath);
          } else if (item.type === 'file') {
            fs.copyFileSync(targetPath, linkPath);
          }
          console.log(
            `[!] Symlink failed for ${item.name}, copied instead (enable Developer Mode)`
          );
        } else {
          throw _err;
        }
      }
    }
  }

  /**
   * Migrate from v3.1.1 (copied data in ~/.ccs/shared/) to v3.2.0 (symlinks to ~/.claude/)
   * Runs once on upgrade
   */
  migrateFromV311(): void {
    // Check if migration already done (shared dirs are symlinks)
    const commandsPath = path.join(this.sharedDir, 'commands');
    if (fs.existsSync(commandsPath)) {
      try {
        if (fs.lstatSync(commandsPath).isSymbolicLink()) {
          return; // Already migrated
        }
      } catch (_err) {
        // Continue with migration
      }
    }

    console.log('[i] Migrating from v3.1.1 to v3.2.0...');

    // Ensure ~/.claude/ exists
    if (!fs.existsSync(this.claudeDir)) {
      fs.mkdirSync(this.claudeDir, { recursive: true, mode: 0o700 });
    }

    // Copy user modifications from ~/.ccs/shared/ to ~/.claude/
    for (const item of this.sharedItems) {
      const sharedPath = path.join(this.sharedDir, item.name);
      const claudePath = path.join(this.claudeDir, item.name);

      if (!fs.existsSync(sharedPath)) continue;

      try {
        const stats = fs.lstatSync(sharedPath);

        // Handle directories
        if (item.type === 'directory' && stats.isDirectory()) {
          // Create claude dir if missing
          if (!fs.existsSync(claudePath)) {
            fs.mkdirSync(claudePath, { recursive: true, mode: 0o700 });
          }

          // Copy files from shared to claude (preserve user modifications)
          const entries = fs.readdirSync(sharedPath, { withFileTypes: true });
          let copied = 0;

          for (const entry of entries) {
            const src = path.join(sharedPath, entry.name);
            const dest = path.join(claudePath, entry.name);

            // Skip if already exists in claude
            if (fs.existsSync(dest)) continue;

            if (entry.isDirectory()) {
              fs.cpSync(src, dest, { recursive: true });
            } else {
              fs.copyFileSync(src, dest);
            }
            copied++;
          }

          if (copied > 0) {
            console.log(`[OK] Migrated ${copied} ${item.name} to ~/.claude/${item.name}`);
          }
        }

        // Handle files (settings.json)
        else if (item.type === 'file' && stats.isFile()) {
          // Only copy if ~/.claude/ version doesn't exist
          if (!fs.existsSync(claudePath)) {
            fs.copyFileSync(sharedPath, claudePath);
            console.log(`[OK] Migrated ${item.name} to ~/.claude/${item.name}`);
          }
        }
      } catch (_err) {
        console.log(`[!] Failed to migrate ${item.name}: ${(_err as Error).message}`);
      }
    }

    // Now run ensureSharedDirectories to create symlinks
    this.ensureSharedDirectories();

    // Update all instances to use new symlinks
    if (fs.existsSync(this.instancesDir)) {
      try {
        const instances = fs.readdirSync(this.instancesDir);

        for (const instance of instances) {
          const instancePath = path.join(this.instancesDir, instance);
          try {
            if (fs.statSync(instancePath).isDirectory()) {
              this.linkSharedDirectories(instancePath);
            }
          } catch (_err) {
            console.log(`[!] Failed to update instance ${instance}: ${(_err as Error).message}`);
          }
        }
      } catch (_err) {
        // No instances to update
      }
    }

    console.log('[OK] Migration to v3.2.0 complete');
  }

  /**
   * Migrate existing instances from isolated to shared settings.json (v4.4+)
   * Runs once on upgrade
   */
  migrateToSharedSettings(): void {
    console.log('[i] Migrating instances to shared settings.json...');

    // Ensure ~/.claude/settings.json exists (authoritative source)
    const claudeSettings = path.join(this.claudeDir, 'settings.json');
    if (!fs.existsSync(claudeSettings)) {
      // Create empty settings if missing
      fs.writeFileSync(claudeSettings, JSON.stringify({}, null, 2), 'utf8');
      console.log('[i] Created ~/.claude/settings.json');
    }

    // Ensure shared settings.json symlink exists
    this.ensureSharedDirectories();

    // Migrate each instance
    if (!fs.existsSync(this.instancesDir)) {
      console.log('[i] No instances to migrate');
      return;
    }

    const instances = fs.readdirSync(this.instancesDir).filter((name) => {
      const instancePath = path.join(this.instancesDir, name);
      return fs.statSync(instancePath).isDirectory();
    });

    let migrated = 0;
    let skipped = 0;

    for (const instance of instances) {
      const instancePath = path.join(this.instancesDir, instance);
      const instanceSettings = path.join(instancePath, 'settings.json');

      try {
        // Check if already symlink
        if (fs.existsSync(instanceSettings)) {
          const stats = fs.lstatSync(instanceSettings);
          if (stats.isSymbolicLink()) {
            skipped++;
            continue; // Already migrated
          }

          // Backup existing settings
          const backup = instanceSettings + '.pre-shared-migration';
          if (!fs.existsSync(backup)) {
            fs.copyFileSync(instanceSettings, backup);
            console.log(`[i] Backed up ${instance}/settings.json`);
          }

          // Remove old settings.json
          fs.unlinkSync(instanceSettings);
        }

        // Create symlink via SharedManager
        const sharedSettings = path.join(this.sharedDir, 'settings.json');

        try {
          fs.symlinkSync(sharedSettings, instanceSettings, 'file');
          migrated++;
        } catch (_err) {
          // Windows fallback
          if (process.platform === 'win32') {
            fs.copyFileSync(sharedSettings, instanceSettings);
            console.log(`[!] Symlink failed for ${instance}, copied instead`);
            migrated++;
          } else {
            throw _err;
          }
        }
      } catch (_err) {
        console.log(`[!] Failed to migrate ${instance}: ${(_err as Error).message}`);
      }
    }

    console.log(`[OK] Migrated ${migrated} instance(s), skipped ${skipped}`);
  }

  /**
   * Copy directory as fallback (Windows without Developer Mode)
   */
  private copyDirectoryFallback(src: string, dest: string): void {
    if (!fs.existsSync(src)) {
      fs.mkdirSync(src, { recursive: true, mode: 0o700 });
      return;
    }

    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true, mode: 0o700 });
    }

    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        this.copyDirectoryFallback(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }
}

export default SharedManager;
