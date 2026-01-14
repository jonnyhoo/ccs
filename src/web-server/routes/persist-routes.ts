/**
 * Persist Routes - Backup management for ~/.claude/settings.json
 */

import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const router = Router();

/** Rate limiter for restore endpoint - prevents abuse */
const restoreRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 restore attempts per minute
  message: { error: 'Too many restore attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

interface BackupFile {
  path: string;
  timestamp: string;
  date: Date;
}

/**
 * Async mutex for restore operations - prevents race conditions
 *
 * Design: Uses a Promise queue pattern for atomic lock acquisition.
 * When the mutex is locked, subsequent callers are added to a queue
 * and immediately receive `false` when released, signaling they should
 * return a 409 Conflict rather than wait. This prevents request pileup
 * while ensuring only one restore can execute at a time.
 */
class RestoreMutex {
  private locked = false;
  private queue: Array<() => void> = [];

  /**
   * Attempt to acquire the mutex
   * @returns true if acquired, false if already locked (queued request)
   */
  async acquire(): Promise<boolean> {
    if (this.locked) {
      // Already locked - add to queue and wait
      return new Promise((resolve) => {
        this.queue.push(() => resolve(false)); // Return false = was queued, reject
      });
    }
    this.locked = true;
    return true;
  }

  /** Release the mutex, signaling next queued request (if any) to fail */
  release(): void {
    const next = this.queue.shift();
    if (next) {
      next(); // Signal queued request to fail
    } else {
      this.locked = false;
    }
  }
}

const restoreMutex = new RestoreMutex();

/** Get Claude settings.json path */
function getClaudeSettingsPath(): string {
  return path.join(os.homedir(), '.claude', 'settings.json');
}

/** Check if path is a symlink (security check) */
function isSymlink(filePath: string): boolean {
  try {
    const stats = fs.lstatSync(filePath);
    return stats.isSymbolicLink();
  } catch {
    return false;
  }
}

/** Get all backup files sorted by date (newest first) */
function getBackupFiles(): BackupFile[] {
  const settingsPath = getClaudeSettingsPath();
  const dir = path.dirname(settingsPath);
  if (!fs.existsSync(dir)) {
    return [];
  }
  const backupPattern = /^settings\.json\.backup\.(\d{8}_\d{6})$/;
  const files = fs
    .readdirSync(dir)
    .filter((f) => backupPattern.test(f))
    .map((f) => {
      const match = f.match(backupPattern);
      if (!match) return null;
      const timestamp = match[1];
      const year = parseInt(timestamp.slice(0, 4));
      const month = parseInt(timestamp.slice(4, 6)) - 1;
      const day = parseInt(timestamp.slice(6, 8));
      const hour = parseInt(timestamp.slice(9, 11));
      const min = parseInt(timestamp.slice(11, 13));
      const sec = parseInt(timestamp.slice(13, 15));
      return {
        path: path.join(dir, f),
        timestamp,
        date: new Date(year, month, day, hour, min, sec),
      };
    })
    .filter((f): f is BackupFile => f !== null)
    .sort((a, b) => b.date.getTime() - a.date.getTime());
  return files;
}

/**
 * GET /api/persist/backups - List available backups
 */
router.get('/backups', (_req: Request, res: Response): void => {
  try {
    const backups = getBackupFiles();
    res.json({
      backups: backups.map((b, i) => ({
        timestamp: b.timestamp,
        date: b.date.toISOString(),
        isLatest: i === 0,
      })),
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /api/persist/restore - Restore from a backup
 * Body: { timestamp?: string } - If not provided, restores latest
 * Rate limited: 5 requests per minute
 */
router.post('/restore', restoreRateLimiter, async (req: Request, res: Response): Promise<void> => {
  // Atomic mutex acquisition - prevents race conditions
  const acquired = await restoreMutex.acquire();
  if (!acquired) {
    res.status(409).json({ error: 'Restore already in progress' });
    return;
  }

  try {
    const { timestamp } = req.body;
    const backups = getBackupFiles();

    if (backups.length === 0) {
      res.status(404).json({ error: 'No backups found' });
      return;
    }

    // Find backup
    let backup: BackupFile;
    if (!timestamp) {
      backup = backups[0]; // Latest
    } else {
      const found = backups.find((b) => b.timestamp === timestamp);
      if (!found) {
        res.status(404).json({ error: `Backup not found: ${timestamp}` });
        return;
      }
      backup = found;
    }

    // Security: reject symlinks to prevent path traversal attacks
    if (isSymlink(backup.path)) {
      res.status(400).json({ error: 'Backup file is a symlink - refusing for security' });
      return;
    }

    const settingsPath = getClaudeSettingsPath();
    if (isSymlink(settingsPath)) {
      res.status(400).json({ error: 'settings.json is a symlink - refusing for security' });
      return;
    }

    // Read backup content securely using file descriptor to prevent TOCTOU
    // Open with O_NOFOLLOW equivalent check then read atomically
    let backupContent: string;
    let fd: number | undefined;
    try {
      // Verify not symlink immediately before open
      const stats = fs.lstatSync(backup.path);
      if (stats.isSymbolicLink()) {
        res
          .status(400)
          .json({ error: 'Backup became symlink during read - refusing for security' });
        return;
      }
      // Open file descriptor for atomic read
      fd = fs.openSync(backup.path, 'r');
      const buffer = Buffer.alloc(stats.size);
      fs.readSync(fd, buffer, 0, stats.size, 0);
      backupContent = buffer.toString('utf8');

      const parsed = JSON.parse(backupContent);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        res.status(400).json({ error: 'Backup file is corrupted' });
        return;
      }
    } catch (err) {
      const error = err as NodeJS.ErrnoException;
      if (error.code === 'ENOENT') {
        res.status(404).json({ error: 'Backup was deleted during restore' });
        return;
      }
      res.status(400).json({ error: 'Backup file is corrupted or invalid JSON' });
      return;
    } finally {
      if (fd !== undefined) {
        try {
          fs.closeSync(fd);
        } catch {
          // Ignore close errors
        }
      }
    }

    // Atomic restore with rollback capability
    const settingsDir = path.dirname(settingsPath);
    const tempPath = path.join(settingsDir, 'settings.json.restore-tmp');
    const rollbackPath = path.join(settingsDir, 'settings.json.rollback-tmp');

    try {
      // Step 1: Backup current settings for rollback
      if (fs.existsSync(settingsPath)) {
        fs.copyFileSync(settingsPath, rollbackPath);
      }

      // Step 2: Write validated content to temp file
      fs.writeFileSync(tempPath, backupContent, 'utf8');

      // Step 3: Atomic rename (replaces existing file)
      fs.renameSync(tempPath, settingsPath);

      // Step 4: Cleanup rollback backup on success
      if (fs.existsSync(rollbackPath)) {
        fs.unlinkSync(rollbackPath);
      }

      res.json({
        success: true,
        timestamp: backup.timestamp,
        date: backup.date.toISOString(),
      });
    } catch (error) {
      // Rollback on failure
      try {
        if (fs.existsSync(rollbackPath)) {
          fs.renameSync(rollbackPath, settingsPath);
        }
        if (fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath);
        }
      } catch (rollbackErr) {
        console.error('[persist-routes] Rollback failed:', rollbackErr);
        res.status(500).json({
          error: 'Restore failed and rollback unsuccessful - manual recovery may be needed',
        });
        return;
      }
      throw error;
    }
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  } finally {
    restoreMutex.release();
  }
});

export default router;
