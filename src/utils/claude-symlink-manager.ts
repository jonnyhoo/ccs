/**
 * ClaudeSymlinkManager - Manages selective symlinks from ~/.ccs/.claude/ to ~/.claude/
 * v4.1.0: Selective symlinking for CCS items
 *
 * Purpose: Ship CCS items (.claude/) with package and symlink them to user's ~/.claude/
 * Architecture:
 *   - ~/.ccs/.claude/* (source, ships with CCS)
 *   - ~/.claude/* (target, gets selective symlinks)
 *   - ~/.ccs/shared/ (UNTOUCHED, existing profile mechanism)
 *
 * Symlink Chain:
 *   profile -> ~/.ccs/shared/ -> ~/.claude/ (which has symlinks to ~/.ccs/.claude/)
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { colored } from './helpers';

// Ora fallback type for when ora is not available
interface OraSpinner {
  text: string;
  succeed: (msg?: string) => void;
  fail: (msg?: string) => void;
  warn: (msg?: string) => void;
  info: (msg?: string) => void;
}

interface OraInstance {
  start: () => OraSpinner;
}

// Make ora optional (might not be available during npm install postinstall)
let ora: ((text: string) => OraInstance) | null = null;
try {
  const oraModule = require('ora');
  ora = oraModule.default || oraModule;
} catch {
  // ora not available, create fallback spinner that uses console.log
  ora = function (text: string): OraInstance {
    return {
      start: () => ({
        succeed: (msg?: string) => console.log(msg || `[OK] ${text}`),
        fail: (msg?: string) => console.log(msg || `[X] ${text}`),
        warn: (msg?: string) => console.log(msg || `[!] ${text}`),
        info: (msg?: string) => console.log(msg || `[i] ${text}`),
        text: '',
      }),
    };
  };
}

interface CcsItem {
  source: string;
  target: string;
  type: 'file' | 'directory';
}

interface HealthCheckResult {
  healthy: boolean;
  issues: string[];
}

/**
 * ClaudeSymlinkManager - Manages selective symlinks from ~/.ccs/.claude/ to ~/.claude/
 */
export class ClaudeSymlinkManager {
  private homeDir: string;
  private ccsClaudeDir: string;
  private userClaudeDir: string;
  private ccsItems: CcsItem[];

  constructor() {
    this.homeDir = os.homedir();
    this.ccsClaudeDir = path.join(this.homeDir, '.ccs', '.claude');
    this.userClaudeDir = path.join(this.homeDir, '.claude');

    // CCS items to symlink (selective, item-level)
    this.ccsItems = [
      { source: 'commands/ccs.md', target: 'commands/ccs.md', type: 'file' },
      { source: 'commands/ccs', target: 'commands/ccs', type: 'directory' },
      { source: 'skills/ccs-delegation', target: 'skills/ccs-delegation', type: 'directory' },
    ];
  }

  /**
   * Install CCS items to user's ~/.claude/ via selective symlinks
   * Safe: backs up existing files before creating symlinks
   */
  install(silent = false): void {
    const spinner = silent || !ora ? null : ora('Installing CCS items to ~/.claude/').start();

    // Ensure ~/.ccs/.claude/ exists (should be shipped with package)
    if (!fs.existsSync(this.ccsClaudeDir)) {
      const msg = 'CCS .claude/ directory not found, skipping symlink installation';
      if (spinner) {
        spinner.warn(`[!] ${msg}`);
      } else {
        console.log(`[!] ${msg}`);
      }
      return;
    }

    // Create ~/.claude/ if missing
    if (!fs.existsSync(this.userClaudeDir)) {
      if (!silent) {
        if (spinner) spinner.text = 'Creating ~/.claude/ directory';
      }
      fs.mkdirSync(this.userClaudeDir, { recursive: true, mode: 0o700 });
    }

    // Install each CCS item
    let installed = 0;
    for (const item of this.ccsItems) {
      if (!silent && spinner) {
        spinner.text = `Installing ${item.target}...`;
      }
      const result = this.installItem(item, silent);
      if (result) installed++;
    }

    const msg = `${installed}/${this.ccsItems.length} items installed to ~/.claude/`;
    if (spinner) {
      spinner.succeed(colored('[OK]', 'green') + ` ${msg}`);
    } else {
      console.log(`[OK] ${msg}`);
    }
  }

  /**
   * Install a single CCS item with conflict handling
   */
  private installItem(item: CcsItem, silent = false): boolean {
    const sourcePath = path.join(this.ccsClaudeDir, item.source);
    const targetPath = path.join(this.userClaudeDir, item.target);
    const targetDir = path.dirname(targetPath);

    // Ensure source exists
    if (!fs.existsSync(sourcePath)) {
      if (!silent) console.log(`[!] Source not found: ${item.source}, skipping`);
      return false;
    }

    // Create target parent directory if needed
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true, mode: 0o700 });
    }

    // Check if target already exists
    if (fs.existsSync(targetPath)) {
      // Check if it's already the correct symlink
      if (this.isOurSymlink(targetPath, sourcePath)) {
        return true; // Already correct, counts as success
      }

      // Backup existing file/directory
      this.backupItem(targetPath, silent);
    }

    // Create symlink
    try {
      const symlinkType = item.type === 'directory' ? 'dir' : 'file';
      fs.symlinkSync(sourcePath, targetPath, symlinkType);
      if (!silent) console.log(`[OK] Symlinked ${item.target}`);
      return true;
    } catch (err) {
      // Windows fallback: stub for now, full implementation in v4.2
      if (process.platform === 'win32') {
        if (!silent) {
          console.log(`[!] Symlink failed for ${item.target} (Windows fallback deferred to v4.2)`);
          console.log(`[i] Enable Developer Mode or wait for next update`);
        }
      } else {
        const error = err as Error;
        if (!silent) console.log(`[!] Failed to symlink ${item.target}: ${error.message}`);
      }
      return false;
    }
  }

  /**
   * Check if target is already the correct symlink pointing to source
   */
  private isOurSymlink(targetPath: string, expectedSource: string): boolean {
    try {
      const stats = fs.lstatSync(targetPath);

      if (!stats.isSymbolicLink()) {
        return false;
      }

      const actualTarget = fs.readlinkSync(targetPath);
      const resolvedTarget = path.resolve(path.dirname(targetPath), actualTarget);

      return resolvedTarget === expectedSource;
    } catch {
      return false;
    }
  }

  /**
   * Backup existing item before replacing with symlink
   */
  private backupItem(itemPath: string, silent = false): void {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const backupPath = `${itemPath}.backup-${timestamp}`;

    try {
      // If backup already exists, use counter
      let finalBackupPath = backupPath;
      let counter = 1;
      while (fs.existsSync(finalBackupPath)) {
        finalBackupPath = `${backupPath}-${counter}`;
        counter++;
      }

      fs.renameSync(itemPath, finalBackupPath);
      if (!silent) console.log(`[i] Backed up existing item to ${path.basename(finalBackupPath)}`);
    } catch (err) {
      const error = err as Error;
      if (!silent) console.log(`[!] Failed to backup ${itemPath}: ${error.message}`);
      throw err; // Don't proceed if backup fails
    }
  }

  /**
   * Uninstall CCS items from ~/.claude/ (remove symlinks only)
   * Safe: only removes items that are CCS symlinks
   */
  uninstall(): void {
    let removed = 0;

    for (const item of this.ccsItems) {
      const targetPath = path.join(this.userClaudeDir, item.target);
      const sourcePath = path.join(this.ccsClaudeDir, item.source);

      // Only remove if it's our symlink
      if (fs.existsSync(targetPath) && this.isOurSymlink(targetPath, sourcePath)) {
        try {
          fs.unlinkSync(targetPath);
          console.log(`[OK] Removed ${item.target}`);
          removed++;
        } catch (err) {
          const error = err as Error;
          console.log(`[!] Failed to remove ${item.target}: ${error.message}`);
        }
      }
    }

    if (removed > 0) {
      console.log(`[OK] Removed ${removed} delegation commands and skills from ~/.claude/`);
    } else {
      console.log('[i] No delegation commands or skills to remove');
    }
  }

  /**
   * Check symlink health and report issues
   * Used by 'ccs doctor' command
   */
  checkHealth(): HealthCheckResult {
    const issues: string[] = [];
    let healthy = true;

    // Check if ~/.ccs/.claude/ exists
    if (!fs.existsSync(this.ccsClaudeDir)) {
      issues.push('CCS .claude/ directory missing (reinstall CCS)');
      healthy = false;
      return { healthy, issues };
    }

    // Check each item
    for (const item of this.ccsItems) {
      const sourcePath = path.join(this.ccsClaudeDir, item.source);
      const targetPath = path.join(this.userClaudeDir, item.target);

      // Check source exists
      if (!fs.existsSync(sourcePath)) {
        issues.push(`Source missing: ${item.source}`);
        healthy = false;
        continue;
      }

      // Check target
      if (!fs.existsSync(targetPath)) {
        issues.push(`Not installed: ${item.target} (run 'ccs sync' to install)`);
        healthy = false;
      } else if (!this.isOurSymlink(targetPath, sourcePath)) {
        issues.push(`Not a CCS symlink: ${item.target} (run 'ccs sync' to fix)`);
        healthy = false;
      }
    }

    return { healthy, issues };
  }

  /**
   * Sync delegation commands and skills to ~/.claude/ (used by 'ccs sync' command)
   * Same as install() but with explicit sync message
   */
  sync(): void {
    console.log('');
    console.log(colored('Syncing CCS Components...', 'cyan'));
    console.log('');
    this.install(false);
  }
}

export default ClaudeSymlinkManager;
