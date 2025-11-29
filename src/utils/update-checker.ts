/**
 * Update Checker - Check for new CCS versions from npm registry or GitHub
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as https from 'https';
import { colored } from './helpers';

const UPDATE_CHECK_FILE = path.join(os.homedir(), '.ccs', 'update-check.json');
const CHECK_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
const GITHUB_API_URL = 'https://api.github.com/repos/kaitranntt/ccs/releases/latest';
const NPM_REGISTRY_URL = 'https://registry.npmjs.org/@kaitranntt/ccs/latest';
const REQUEST_TIMEOUT = 5000; // 5 seconds

interface UpdateCache {
  last_check: number;
  latest_version: string | null;
  dismissed_version: string | null;
}

interface UpdateResult {
  status: 'update_available' | 'no_update' | 'check_failed';
  reason?: string;
  latest?: string;
  current?: string;
  message?: string;
}

/**
 * Compare semantic versions
 * @returns 1 if v1 > v2, -1 if v1 < v2, 0 if equal
 */
export function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.replace(/^v/, '').split('.').map(Number);
  const parts2 = v2.replace(/^v/, '').split('.').map(Number);

  for (let i = 0; i < 3; i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }
  return 0;
}

/**
 * Fetch latest version from GitHub releases
 */
function fetchLatestVersionFromGitHub(): Promise<string | null> {
  return new Promise((resolve) => {
    const req = https.get(
      GITHUB_API_URL,
      {
        headers: { 'User-Agent': 'CCS-Update-Checker' },
        timeout: REQUEST_TIMEOUT,
      },
      (res) => {
        let data = '';

        res.on('data', (chunk: Buffer) => {
          data += chunk.toString();
        });

        res.on('end', () => {
          try {
            if (res.statusCode !== 200) {
              resolve(null);
              return;
            }

            const release = JSON.parse(data) as { tag_name?: string };
            const version = release.tag_name?.replace(/^v/, '') || null;
            resolve(version);
          } catch {
            resolve(null);
          }
        });
      }
    );

    req.on('error', () => resolve(null));
    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });
  });
}

/**
 * Fetch latest version from npm registry
 */
function fetchLatestVersionFromNpm(): Promise<string | null> {
  return new Promise((resolve) => {
    const req = https.get(
      NPM_REGISTRY_URL,
      {
        headers: { 'User-Agent': 'CCS-Update-Checker' },
        timeout: REQUEST_TIMEOUT,
      },
      (res) => {
        let data = '';

        res.on('data', (chunk: Buffer) => {
          data += chunk.toString();
        });

        res.on('end', () => {
          try {
            if (res.statusCode !== 200) {
              resolve(null);
              return;
            }

            const packageData = JSON.parse(data) as { version?: string };
            const version = packageData.version || null;
            resolve(version);
          } catch {
            resolve(null);
          }
        });
      }
    );

    req.on('error', () => resolve(null));
    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });
  });
}

/**
 * Read update check cache
 */
export function readCache(): UpdateCache {
  try {
    if (!fs.existsSync(UPDATE_CHECK_FILE)) {
      return { last_check: 0, latest_version: null, dismissed_version: null };
    }

    const data = fs.readFileSync(UPDATE_CHECK_FILE, 'utf8');
    return JSON.parse(data) as UpdateCache;
  } catch {
    return { last_check: 0, latest_version: null, dismissed_version: null };
  }
}

/**
 * Write update check cache
 */
export function writeCache(cache: UpdateCache): void {
  try {
    const ccsDir = path.join(os.homedir(), '.ccs');
    if (!fs.existsSync(ccsDir)) {
      fs.mkdirSync(ccsDir, { recursive: true, mode: 0o700 });
    }

    fs.writeFileSync(UPDATE_CHECK_FILE, JSON.stringify(cache, null, 2), 'utf8');
  } catch {
    // Silently fail - not critical
  }
}

/**
 * Check for updates (async, non-blocking)
 * @param currentVersion - Current CCS version
 * @param force - Force check even if within interval
 * @param installMethod - Installation method ('npm' or 'direct')
 */
export async function checkForUpdates(
  currentVersion: string,
  force = false,
  installMethod: 'npm' | 'direct' = 'direct'
): Promise<UpdateResult> {
  const cache = readCache();
  const now = Date.now();

  // Check if we should check for updates
  if (!force && now - cache.last_check < CHECK_INTERVAL) {
    // Use cached result if available
    if (cache.latest_version && compareVersions(cache.latest_version, currentVersion) > 0) {
      // Don't show if user dismissed this version
      if (cache.dismissed_version === cache.latest_version) {
        return { status: 'no_update', reason: 'dismissed' };
      }
      return { status: 'update_available', latest: cache.latest_version, current: currentVersion };
    }
    return { status: 'no_update', reason: 'cached' };
  }

  // Fetch latest version from appropriate source
  let latestVersion: string | null;
  let fetchError: string | null = null;

  if (installMethod === 'npm') {
    latestVersion = await fetchLatestVersionFromNpm();
    if (!latestVersion) fetchError = 'npm_registry_error';
  } else {
    latestVersion = await fetchLatestVersionFromGitHub();
    if (!latestVersion) fetchError = 'github_api_error';
  }

  // Update cache
  cache.last_check = now;
  if (latestVersion) {
    cache.latest_version = latestVersion;
  }
  writeCache(cache);

  // Handle fetch errors
  if (fetchError) {
    return {
      status: 'check_failed',
      reason: fetchError,
      message: `Failed to check for updates: ${fetchError.replace(/_/g, ' ')}`,
    };
  }

  // Check if update available
  if (latestVersion && compareVersions(latestVersion, currentVersion) > 0) {
    // Don't show if user dismissed this version
    if (cache.dismissed_version === latestVersion) {
      return { status: 'no_update', reason: 'dismissed' };
    }
    return { status: 'update_available', latest: latestVersion, current: currentVersion };
  }

  return { status: 'no_update', reason: 'latest' };
}

/**
 * Show update notification
 */
export function showUpdateNotification(updateInfo: { current: string; latest: string }): void {
  console.log('');
  console.log(colored('═══════════════════════════════════════════════════════', 'cyan'));
  console.log(
    colored(`  Update available: ${updateInfo.current} → ${updateInfo.latest}`, 'yellow')
  );
  console.log(colored('═══════════════════════════════════════════════════════', 'cyan'));
  console.log('');
  console.log(`  Run ${colored('ccs update', 'yellow')} to update`);
  console.log('');
}

/**
 * Dismiss update notification for a specific version
 */
export function dismissUpdate(version: string): void {
  const cache = readCache();
  cache.dismissed_version = version;
  writeCache(cache);
}
