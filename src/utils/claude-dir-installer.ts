/**
 * ClaudeDirInstaller - Manages copying .claude/ directory from package to ~/.ccs/.claude/
 * v4.1.1: Fix for npm install not copying .claude/ directory
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

interface ItemCount {
  files: number;
  dirs: number;
}

interface CleanupResult {
  success: boolean;
  cleanedFiles: string[];
  error?: string;
}

/**
 * ClaudeDirInstaller - Manages copying .claude/ directory from package to ~/.ccs/.claude/
 */
export class ClaudeDirInstaller {
  private homeDir: string;
  private ccsClaudeDir: string;

  constructor() {
    this.homeDir = os.homedir();
    this.ccsClaudeDir = path.join(this.homeDir, '.ccs', '.claude');
  }

  /**
   * Copy .claude/ directory from package to ~/.ccs/.claude/
   * @param packageDir - Package installation directory (default: auto-detect)
   * @param silent - Suppress spinner output
   */
  install(packageDir?: string, silent = false): boolean {
    const spinner =
      silent || !ora ? null : ora('Copying .claude/ items to ~/.ccs/.claude/').start();

    try {
      // Auto-detect package directory if not provided
      if (!packageDir) {
        // Try to find package root by going up from this file
        packageDir = path.join(__dirname, '..', '..');
      }

      const packageClaudeDir = path.join(packageDir, '.claude');

      if (!fs.existsSync(packageClaudeDir)) {
        const msg = 'Package .claude/ directory not found';
        if (spinner) {
          spinner.warn(`[!] ${msg}`);
          console.log(`    Searched in: ${packageClaudeDir}`);
          console.log('    This may be a development installation');
        } else {
          console.log(`[!] ${msg}`);
          console.log(`    Searched in: ${packageClaudeDir}`);
          console.log('    This may be a development installation');
        }
        return false;
      }

      // Remove old version before copying new one
      if (fs.existsSync(this.ccsClaudeDir)) {
        if (spinner) spinner.text = 'Removing old .claude/ items...';
        fs.rmSync(this.ccsClaudeDir, { recursive: true, force: true });
      }

      // Use fs.cpSync for recursive copy (Node.js 16.7.0+)
      if (spinner) spinner.text = 'Copying .claude/ items...';

      if (fs.cpSync) {
        fs.cpSync(packageClaudeDir, this.ccsClaudeDir, { recursive: true });
      } else {
        // Fallback for Node.js < 16.7.0
        this.copyDirRecursive(packageClaudeDir, this.ccsClaudeDir);
      }

      // Count files and directories
      const itemCount = this.countItems(this.ccsClaudeDir);
      const msg = `Copied .claude/ items (${itemCount.files} files, ${itemCount.dirs} directories)`;

      if (spinner) {
        spinner.succeed(colored('[OK]', 'green') + ` ${msg}`);
      } else {
        console.log(`[OK] ${msg}`);
      }
      return true;
    } catch (err) {
      const error = err as Error;
      const msg = `Failed to copy .claude/ directory: ${error.message}`;
      if (spinner) {
        spinner.fail(colored('[!]', 'yellow') + ` ${msg}`);
        console.warn('    CCS items may not be available');
      } else {
        console.warn(`[!] ${msg}`);
        console.warn('    CCS items may not be available');
      }
      return false;
    }
  }

  /**
   * Recursively copy directory (fallback for Node.js < 16.7.0)
   */
  private copyDirRecursive(src: string, dest: string): void {
    // Create destination directory
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }

    // Read source directory
    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        // Recursively copy subdirectory
        this.copyDirRecursive(srcPath, destPath);
      } else {
        // Copy file
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  /**
   * Count files and directories in a path
   */
  private countItems(dirPath: string): ItemCount {
    let files = 0;
    let dirs = 0;

    const countRecursive = (p: string): void => {
      const entries = fs.readdirSync(p, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          dirs++;
          countRecursive(path.join(p, entry.name));
        } else {
          files++;
        }
      }
    };

    try {
      countRecursive(dirPath);
    } catch {
      // Ignore errors
    }

    return { files, dirs };
  }

  /**
   * Clean up deprecated files from previous installations
   * Removes ccs-delegator.md that was deprecated in v4.3.2
   */
  cleanupDeprecated(silent = false): CleanupResult {
    const deprecatedFile = path.join(this.ccsClaudeDir, 'agents', 'ccs-delegator.md');
    const userSymlinkFile = path.join(this.homeDir, '.claude', 'agents', 'ccs-delegator.md');
    const migrationMarker = path.join(
      this.homeDir,
      '.ccs',
      '.migrations',
      'v435-delegator-cleanup'
    );

    const cleanedFiles: string[] = [];

    try {
      // Check if cleanup already done
      if (fs.existsSync(migrationMarker)) {
        return { success: true, cleanedFiles: [] }; // Already cleaned
      }

      // Clean up user symlink in ~/.claude/agents/ccs-delegator.md FIRST
      try {
        const userStats = fs.lstatSync(userSymlinkFile);
        if (userStats.isSymbolicLink()) {
          fs.unlinkSync(userSymlinkFile);
          cleanedFiles.push('user symlink');
        } else {
          // It's not a symlink (user created their own file), backup it
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
          const backupPath = `${userSymlinkFile}.backup-${timestamp}`;
          fs.renameSync(userSymlinkFile, backupPath);
          if (!silent) console.log(`[i] Backed up user file to ${path.basename(backupPath)}`);
          cleanedFiles.push('user file (backed up)');
        }
      } catch (err) {
        const error = err as NodeJS.ErrnoException;
        // File doesn't exist or other error - that's okay
        if (error.code !== 'ENOENT' && !silent) {
          console.log(`[!] Failed to remove user symlink: ${error.message}`);
        }
      }

      // Clean up package copy in ~/.ccs/.claude/agents/ccs-delegator.md
      if (fs.existsSync(deprecatedFile)) {
        try {
          // Check if file was modified by user (compare with expected content)
          const shouldBackup = this.shouldBackupDeprecatedFile(deprecatedFile);

          if (shouldBackup) {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
            const backupPath = `${deprecatedFile}.backup-${timestamp}`;
            fs.renameSync(deprecatedFile, backupPath);
            if (!silent)
              console.log(`[i] Backed up modified deprecated file to ${path.basename(backupPath)}`);
          } else {
            fs.rmSync(deprecatedFile, { force: true });
          }
          cleanedFiles.push('package copy');
        } catch (err) {
          const error = err as Error;
          if (!silent) console.log(`[!] Failed to remove package copy: ${error.message}`);
        }
      }

      // Create migration marker
      if (cleanedFiles.length > 0) {
        const migrationsDir = path.dirname(migrationMarker);
        if (!fs.existsSync(migrationsDir)) {
          fs.mkdirSync(migrationsDir, { recursive: true, mode: 0o700 });
        }
        fs.writeFileSync(migrationMarker, new Date().toISOString());

        if (!silent) {
          console.log(`[OK] Cleaned up deprecated agent files: ${cleanedFiles.join(', ')}`);
        }
      }

      return { success: true, cleanedFiles };
    } catch (err) {
      const error = err as Error;
      if (!silent) console.log(`[!] Cleanup failed: ${error.message}`);
      return { success: false, error: error.message, cleanedFiles };
    }
  }

  /**
   * Check if deprecated file should be backed up (user modified)
   */
  private shouldBackupDeprecatedFile(filePath: string): boolean {
    try {
      // Simple heuristic: if file size differs significantly from expected, assume user modified
      // Expected size for ccs-delegator.md was around 2-3KB
      const stats = fs.statSync(filePath);
      const expectedMinSize = 1000; // 1KB minimum
      const expectedMaxSize = 10000; // 10KB maximum

      // If size is outside expected range, likely user modified
      return stats.size < expectedMinSize || stats.size > expectedMaxSize;
    } catch {
      // If we can't determine, err on side of caution and backup
      return true;
    }
  }

  /**
   * Check if ~/.ccs/.claude/ exists and is valid
   */
  isInstalled(): boolean {
    return fs.existsSync(this.ccsClaudeDir);
  }
}

export default ClaudeDirInstaller;
