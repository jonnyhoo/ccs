/**
 * Persistent Disk Cache for Usage Data
 *
 * Caches aggregated usage data to disk to avoid re-parsing 6000+ JSONL files
 * on every dashboard startup. Uses TTL-based invalidation with stale-while-revalidate.
 *
 * Cache location: ~/.ccs/cache/usage.json
 * Default TTL: 5 minutes (configurable)
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { DailyUsage, MonthlyUsage, SessionUsage } from './usage-types';

// Cache configuration
const CCS_DIR = path.join(os.homedir(), '.ccs');
const CACHE_DIR = path.join(CCS_DIR, 'cache');
const CACHE_FILE = path.join(CACHE_DIR, 'usage.json');
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const STALE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days (max age for stale data)

/** Structure of the disk cache file */
export interface UsageDiskCache {
  version: number;
  timestamp: number;
  daily: DailyUsage[];
  monthly: MonthlyUsage[];
  session: SessionUsage[];
}

// Current cache version - increment to invalidate old caches
// v2: Updated model pricing (Opus 4.5: $5/$25, Gemini 3, GLM, Kimi, etc.)
const CACHE_VERSION = 2;

/**
 * Ensure ~/.ccs/cache directory exists
 */
function ensureCacheDir(): void {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

/**
 * Read usage data from disk cache
 * Returns null if cache is missing, corrupted, or has incompatible version
 * NOTE: Does NOT reject based on age - caller handles staleness via SWR pattern
 */
export function readDiskCache(): UsageDiskCache | null {
  try {
    if (!fs.existsSync(CACHE_FILE)) {
      return null;
    }

    const data = fs.readFileSync(CACHE_FILE, 'utf-8');
    const cache: UsageDiskCache = JSON.parse(data);

    // Version check - invalidate if schema changed
    if (cache.version !== CACHE_VERSION) {
      console.log('[i] Cache version mismatch, will refresh');
      return null;
    }

    // Always return cache regardless of age - SWR pattern handles staleness
    return cache;
  } catch (err) {
    // Cache corrupted or unreadable - treat as miss
    console.log('[i] Cache read failed, will refresh:', (err as Error).message);
    return null;
  }
}

/**
 * Check if disk cache is fresh (within TTL)
 */
export function isDiskCacheFresh(cache: UsageDiskCache | null): boolean {
  if (!cache) return false;
  const age = Date.now() - cache.timestamp;
  return age < CACHE_TTL_MS;
}

/**
 * Check if disk cache is stale but usable (between TTL and STALE_TTL)
 */
export function isDiskCacheStale(cache: UsageDiskCache | null): boolean {
  if (!cache) return false;
  const age = Date.now() - cache.timestamp;
  return age >= CACHE_TTL_MS && age < STALE_TTL_MS;
}

/**
 * Write usage data to disk cache
 */
export function writeDiskCache(
  daily: DailyUsage[],
  monthly: MonthlyUsage[],
  session: SessionUsage[]
): void {
  try {
    ensureCacheDir();

    const cache: UsageDiskCache = {
      version: CACHE_VERSION,
      timestamp: Date.now(),
      daily,
      monthly,
      session,
    };

    // Write atomically using temp file + rename
    const tempFile = CACHE_FILE + '.tmp';
    fs.writeFileSync(tempFile, JSON.stringify(cache), 'utf-8');
    fs.renameSync(tempFile, CACHE_FILE);

    console.log('[OK] Disk cache updated');
  } catch (err) {
    // Non-fatal - we can still serve from memory
    console.log('[!] Failed to write disk cache:', (err as Error).message);
  }
}

/**
 * Get cache age in human-readable format
 */
export function getCacheAge(cache: UsageDiskCache | null): string {
  if (!cache) return 'never';

  const age = Date.now() - cache.timestamp;
  const seconds = Math.floor(age / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) return `${hours}h ${minutes % 60}m ago`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s ago`;
  return `${seconds}s ago`;
}

/**
 * Delete disk cache (for manual refresh)
 */
export function clearDiskCache(): void {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      fs.unlinkSync(CACHE_FILE);
      console.log('[OK] Disk cache cleared');
    }
  } catch (err) {
    console.log('[!] Failed to clear disk cache:', (err as Error).message);
  }
}
