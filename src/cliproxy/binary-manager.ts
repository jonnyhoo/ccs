/**
 * Binary Manager for CLIProxyAPI
 *
 * Download-on-demand binary manager:
 * - Downloads platform-specific binary from GitHub releases
 * - Verifies SHA256 checksum
 * - Extracts and caches binary locally
 * - Supports retry logic with exponential backoff
 * - Auto-checks for updates on startup (fetches latest from GitHub API)
 *
 * Pattern: Mirrors npm install behavior (fast check, download only when needed)
 */

import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';
import * as crypto from 'crypto';
import * as zlib from 'zlib';
import { ProgressIndicator } from '../utils/progress-indicator';
import { ok, info } from '../utils/ui';
import { getBinDir, getCliproxyDir, CLIPROXY_DEFAULT_PORT } from './config-generator';
import { isCliproxyRunning } from './stats-fetcher';
import {
  BinaryInfo,
  BinaryManagerConfig,
  ChecksumResult,
  DownloadResult,
  ProgressCallback,
} from './types';
import {
  detectPlatform,
  getDownloadUrl,
  getChecksumsUrl,
  getExecutableName,
  getArchiveBinaryName,
  CLIPROXY_FALLBACK_VERSION,
} from './platform-detector';

/** Cache duration for version check (1 hour in milliseconds) */
const VERSION_CACHE_DURATION_MS = 60 * 60 * 1000;

/** Version pin file name - stores user's explicit version choice */
const VERSION_PIN_FILE = '.version-pin';

/** GitHub API URL for latest release */
const GITHUB_API_LATEST_RELEASE =
  'https://api.github.com/repos/router-for-me/CLIProxyAPI/releases/latest';

/** Version cache file structure */
interface VersionCache {
  latestVersion: string;
  checkedAt: number;
}

/** Update check result */
interface UpdateCheckResult {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  fromCache: boolean;
  checkedAt: number; // Unix timestamp of last check
}

/** Default configuration */
const DEFAULT_CONFIG: BinaryManagerConfig = {
  version: CLIPROXY_FALLBACK_VERSION,
  releaseUrl: 'https://github.com/router-for-me/CLIProxyAPI/releases/download',
  binPath: getBinDir(),
  maxRetries: 3,
  verbose: false,
  forceVersion: false,
};

/**
 * Binary Manager class for CLIProxyAPI binary lifecycle
 */
export class BinaryManager {
  private config: BinaryManagerConfig;
  private verbose: boolean;

  constructor(config: Partial<BinaryManagerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.verbose = this.config.verbose;
  }

  /**
   * Ensure binary is available (download if missing, update if outdated)
   * @returns Path to executable binary
   */
  async ensureBinary(): Promise<string> {
    const binaryPath = this.getBinaryPath();

    // Check if binary already exists
    if (fs.existsSync(binaryPath)) {
      this.log(`Binary exists: ${binaryPath}`);

      // Skip auto-update if forceVersion is set (user requested specific version)
      if (this.config.forceVersion) {
        this.log(`Force version mode: skipping auto-update`);
        return this.getBinaryPath();
      }

      // Check for updates in background (non-blocking for UX)
      try {
        const updateResult = await this.checkForUpdates();
        if (updateResult.hasUpdate) {
          // Check if CLIProxyAPI is currently running - can't update while running
          const proxyRunning = await isCliproxyRunning(CLIPROXY_DEFAULT_PORT);
          if (proxyRunning) {
            // Proxy is running - can't update, just notify user
            console.log(
              info(
                `CLIProxyAPI update available: v${updateResult.currentVersion} -> v${updateResult.latestVersion}`
              )
            );
            console.log(info('Run "ccs cliproxy stop" then restart to apply update'));
            this.log('Skipping update: CLIProxyAPI is currently running');
          } else {
            // Proxy not running - safe to update
            console.log(
              info(
                `CLIProxyAPI update available: v${updateResult.currentVersion} -> v${updateResult.latestVersion}`
              )
            );
            console.log(info('Updating CLIProxyAPI...'));

            // Delete old binary and download new version
            this.deleteBinary();
            this.config.version = updateResult.latestVersion;
            await this.downloadAndInstall();
          }
        }
      } catch (error) {
        // Silent fail - don't block startup if update check fails
        const err = error as Error;
        this.log(`Update check failed (non-blocking): ${err.message}`);
      }

      return this.getBinaryPath();
    }

    // Download, verify, extract
    this.log('Binary not found, downloading...');

    // Skip auto-upgrade to latest if forceVersion is set
    if (!this.config.forceVersion) {
      // Check latest version before first download
      try {
        const latestVersion = await this.fetchLatestVersion();
        if (latestVersion && this.isNewerVersion(latestVersion, this.config.version)) {
          this.log(`Using latest version: ${latestVersion} (instead of ${this.config.version})`);
          this.config.version = latestVersion;
        }
      } catch {
        // Use pinned version if API fails
        this.log(`Using pinned version: ${this.config.version}`);
      }
    } else {
      this.log(`Force version mode: using specified version ${this.config.version}`);
    }

    await this.downloadAndInstall();

    return binaryPath;
  }

  /**
   * Check for updates by comparing installed version with latest release
   * Uses cache to avoid hitting GitHub API on every run
   */
  async checkForUpdates(): Promise<UpdateCheckResult> {
    const currentVersion = this.getInstalledVersion();

    // Try cache first
    const cache = this.getVersionCache();
    if (cache) {
      this.log(`Using cached version: ${cache.latestVersion}`);
      return {
        hasUpdate: this.isNewerVersion(cache.latestVersion, currentVersion),
        currentVersion,
        latestVersion: cache.latestVersion,
        fromCache: true,
        checkedAt: cache.checkedAt,
      };
    }

    // Fetch from GitHub API
    const latestVersion = await this.fetchLatestVersion();
    const now = Date.now();
    this.cacheLatestVersion(latestVersion);

    return {
      hasUpdate: this.isNewerVersion(latestVersion, currentVersion),
      currentVersion,
      latestVersion,
      fromCache: false,
      checkedAt: now,
    };
  }

  /**
   * Fetch latest version from GitHub API
   */
  private async fetchLatestVersion(): Promise<string> {
    const response = await this.fetchJson(GITHUB_API_LATEST_RELEASE);

    // Extract version from tag_name (format: "v6.5.27" or "6.5.27")
    const tagName = response.tag_name as string;
    if (!tagName) {
      throw new Error('No tag_name in GitHub API response');
    }

    return tagName.replace(/^v/, '');
  }

  /**
   * Fetch JSON from URL (for GitHub API)
   */
  private fetchJson(url: string): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      const options = {
        headers: {
          'User-Agent': 'CCS-CLIProxyAPI-Updater/1.0',
          Accept: 'application/vnd.github.v3+json',
        },
      };

      const handleResponse = (res: http.IncomingMessage) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          const redirectUrl = res.headers.location;
          if (!redirectUrl) {
            reject(new Error('Redirect without location header'));
            return;
          }
          this.fetchJson(redirectUrl).then(resolve).catch(reject);
          return;
        }

        if (res.statusCode !== 200) {
          reject(new Error(`GitHub API error: HTTP ${res.statusCode}`));
          return;
        }

        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            reject(new Error('Invalid JSON from GitHub API'));
          }
        });
        res.on('error', reject);
      };

      const req = https.get(url, options, handleResponse);
      req.on('error', reject);
      req.setTimeout(10000, () => {
        req.destroy();
        reject(new Error('GitHub API timeout (10s)'));
      });
    });
  }

  /**
   * Get installed version from version file or fallback to pinned
   */
  private getInstalledVersion(): string {
    const versionFile = path.join(this.config.binPath, '.version');
    if (fs.existsSync(versionFile)) {
      try {
        return fs.readFileSync(versionFile, 'utf8').trim();
      } catch {
        return this.config.version;
      }
    }
    return this.config.version;
  }

  /**
   * Save installed version to file
   */
  private saveInstalledVersion(version: string): void {
    const versionFile = path.join(this.config.binPath, '.version');
    try {
      fs.writeFileSync(versionFile, version, 'utf8');
    } catch {
      // Silent fail - not critical
    }
  }

  /**
   * Get version cache data if still valid
   */
  private getVersionCache(): VersionCache | null {
    const cachePath = this.getVersionCachePath();
    if (!fs.existsSync(cachePath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(cachePath, 'utf8');
      const cache: VersionCache = JSON.parse(content);

      // Check if cache is still valid
      if (Date.now() - cache.checkedAt < VERSION_CACHE_DURATION_MS) {
        return cache;
      }

      // Cache expired
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Cache latest version for future checks
   */
  private cacheLatestVersion(version: string): void {
    const cachePath = this.getVersionCachePath();
    const cache: VersionCache = {
      latestVersion: version,
      checkedAt: Date.now(),
    };

    try {
      fs.mkdirSync(path.dirname(cachePath), { recursive: true });
      fs.writeFileSync(cachePath, JSON.stringify(cache), 'utf8');
    } catch {
      // Silent fail - caching is optional
    }
  }

  /**
   * Get path to version cache file
   */
  private getVersionCachePath(): string {
    return path.join(getCliproxyDir(), '.version-cache.json');
  }

  /**
   * Compare semver versions (true if latest > current)
   */
  private isNewerVersion(latest: string, current: string): boolean {
    const latestParts = latest.split('.').map((p) => parseInt(p, 10) || 0);
    const currentParts = current.split('.').map((p) => parseInt(p, 10) || 0);

    // Pad arrays to same length
    while (latestParts.length < 3) latestParts.push(0);
    while (currentParts.length < 3) currentParts.push(0);

    for (let i = 0; i < 3; i++) {
      if (latestParts[i] > currentParts[i]) return true;
      if (latestParts[i] < currentParts[i]) return false;
    }

    return false; // Equal versions
  }

  /**
   * Get full path to binary executable
   */
  getBinaryPath(): string {
    const execName = getExecutableName();
    return path.join(this.config.binPath, execName);
  }

  /**
   * Check if binary exists
   */
  isBinaryInstalled(): boolean {
    return fs.existsSync(this.getBinaryPath());
  }

  /**
   * Get binary info if installed
   */
  async getBinaryInfo(): Promise<BinaryInfo | null> {
    const binaryPath = this.getBinaryPath();
    if (!fs.existsSync(binaryPath)) {
      return null;
    }

    const platform = detectPlatform();
    const checksum = await this.computeChecksum(binaryPath);

    return {
      path: binaryPath,
      version: this.config.version,
      platform,
      checksum,
    };
  }

  /**
   * Download and install binary
   */
  private async downloadAndInstall(): Promise<void> {
    const platform = detectPlatform(this.config.version);
    const downloadUrl = getDownloadUrl(this.config.version);
    const checksumsUrl = getChecksumsUrl(this.config.version);

    // Ensure bin directory exists
    fs.mkdirSync(this.config.binPath, { recursive: true });

    // Download archive
    const archivePath = path.join(this.config.binPath, `cliproxy-archive.${platform.extension}`);

    // Use single spinner and update text as we progress (avoids UI jumping)
    const spinner = new ProgressIndicator(`Downloading CLIProxyAPI v${this.config.version}`);
    spinner.start();

    try {
      // Download with retry
      const result = await this.downloadWithRetry(downloadUrl, archivePath);
      if (!result.success) {
        spinner.fail('Download failed');
        throw new Error(result.error || 'Download failed after retries');
      }

      // Verify checksum (update spinner text instead of creating new one)
      spinner.update('Verifying checksum');

      const checksumResult = await this.verifyChecksum(
        archivePath,
        platform.binaryName,
        checksumsUrl
      );

      if (!checksumResult.valid) {
        spinner.fail('Checksum mismatch');
        fs.unlinkSync(archivePath);
        throw new Error(
          `Checksum mismatch for ${platform.binaryName}\n` +
            `Expected: ${checksumResult.expected}\n` +
            `Actual:   ${checksumResult.actual}\n\n` +
            `Manual download: ${downloadUrl}`
        );
      }

      // Extract archive (update spinner text)
      spinner.update('Extracting binary');

      await this.extractArchive(archivePath, platform.extension);

      spinner.succeed('CLIProxyAPI ready');

      // Cleanup archive
      fs.unlinkSync(archivePath);

      // Make executable (Unix only)
      const binaryPath = this.getBinaryPath();
      if (platform.os !== 'windows' && fs.existsSync(binaryPath)) {
        fs.chmodSync(binaryPath, 0o755);
        this.log(`Set executable permissions: ${binaryPath}`);
      }

      // Save installed version for future update checks
      this.saveInstalledVersion(this.config.version);

      console.log(ok(`CLIProxyAPI v${this.config.version} installed successfully`));
    } catch (error) {
      spinner.fail('Installation failed');
      throw error;
    }
  }

  /**
   * Download file with retry logic and exponential backoff
   */
  private async downloadWithRetry(url: string, destPath: string): Promise<DownloadResult> {
    let lastError = '';
    let retries = 0;

    while (retries < this.config.maxRetries) {
      try {
        await this.downloadFile(url, destPath);
        return { success: true, filePath: destPath, retries };
      } catch (error) {
        const err = error as Error;
        lastError = err.message;
        retries++;

        if (retries < this.config.maxRetries) {
          // Exponential backoff: 1s, 2s, 4s
          const delay = Math.pow(2, retries - 1) * 1000;
          this.log(`Retry ${retries}/${this.config.maxRetries} after ${delay}ms: ${lastError}`);
          await this.sleep(delay);
        }
      }
    }

    return {
      success: false,
      error: `Download failed after ${retries} attempts: ${lastError}`,
      retries,
    };
  }

  /**
   * Download file from URL with progress tracking
   */
  private downloadFile(
    url: string,
    destPath: string,
    onProgress?: ProgressCallback
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const handleResponse = (res: http.IncomingMessage) => {
        // Handle redirects (GitHub releases use 302)
        if (res.statusCode === 301 || res.statusCode === 302) {
          const redirectUrl = res.headers.location;
          if (!redirectUrl) {
            reject(new Error('Redirect without location header'));
            return;
          }
          this.log(`Following redirect: ${redirectUrl}`);
          this.downloadFile(redirectUrl, destPath, onProgress).then(resolve).catch(reject);
          return;
        }

        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
          return;
        }

        const totalBytes = parseInt(res.headers['content-length'] || '0', 10);
        let downloadedBytes = 0;

        const fileStream = fs.createWriteStream(destPath);

        res.on('data', (chunk: Buffer) => {
          downloadedBytes += chunk.length;
          if (onProgress && totalBytes > 0) {
            onProgress({
              total: totalBytes,
              downloaded: downloadedBytes,
              percentage: Math.round((downloadedBytes / totalBytes) * 100),
            });
          }
        });

        res.pipe(fileStream);

        fileStream.on('finish', () => {
          fileStream.close();
          resolve();
        });

        fileStream.on('error', (err) => {
          fs.unlink(destPath, () => {}); // Cleanup partial file
          reject(err);
        });

        res.on('error', (err) => {
          fs.unlink(destPath, () => {});
          reject(err);
        });
      };

      const protocol = url.startsWith('https') ? https : http;
      const req = protocol.get(url, handleResponse);

      req.on('error', reject);
      req.setTimeout(60000, () => {
        req.destroy();
        reject(new Error('Download timeout (60s)'));
      });
    });
  }

  /**
   * Verify file checksum against checksums.txt
   */
  private async verifyChecksum(
    filePath: string,
    binaryName: string,
    checksumsUrl: string
  ): Promise<ChecksumResult> {
    // Download checksums.txt
    const checksumsContent = await this.fetchText(checksumsUrl);

    // Parse expected checksum
    const expectedHash = this.parseChecksum(checksumsContent, binaryName);
    if (!expectedHash) {
      throw new Error(`Checksum not found for ${binaryName} in checksums.txt`);
    }

    // Compute actual checksum
    const actualHash = await this.computeChecksum(filePath);

    return {
      valid: actualHash === expectedHash,
      expected: expectedHash,
      actual: actualHash,
    };
  }

  /**
   * Parse checksum from checksums.txt content
   */
  private parseChecksum(content: string, binaryName: string): string | null {
    const lines = content.split('\n');
    for (const line of lines) {
      // Format: "hash  filename" or "hash filename"
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 2 && parts[1] === binaryName) {
        return parts[0].toLowerCase();
      }
    }
    return null;
  }

  /**
   * Compute SHA256 checksum of file
   */
  private computeChecksum(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);

      stream.on('data', (data) => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  /**
   * Fetch text content from URL
   */
  private fetchText(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const handleResponse = (res: http.IncomingMessage) => {
        // Handle redirects
        if (res.statusCode === 301 || res.statusCode === 302) {
          const redirectUrl = res.headers.location;
          if (!redirectUrl) {
            reject(new Error('Redirect without location header'));
            return;
          }
          this.fetchText(redirectUrl).then(resolve).catch(reject);
          return;
        }

        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
          return;
        }

        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => resolve(data));
        res.on('error', reject);
      };

      const protocol = url.startsWith('https') ? https : http;
      const req = protocol.get(url, handleResponse);
      req.on('error', reject);
      req.setTimeout(30000, () => {
        req.destroy();
        reject(new Error('Request timeout (30s)'));
      });
    });
  }

  /**
   * Extract archive (tar.gz or zip)
   */
  private async extractArchive(archivePath: string, extension: 'tar.gz' | 'zip'): Promise<void> {
    if (extension === 'tar.gz') {
      await this.extractTarGz(archivePath);
    } else {
      await this.extractZip(archivePath);
    }
  }

  /**
   * Extract tar.gz archive using Node.js built-in modules
   */
  private extractTarGz(archivePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const destDir = this.config.binPath;
      const execName = getExecutableName();
      const archiveBinaryName = getArchiveBinaryName();

      // Read and decompress
      const gunzip = zlib.createGunzip();
      const input = fs.createReadStream(archivePath);

      let headerBuffer = Buffer.alloc(0);
      let currentFile: { name: string; size: number } | null = null;
      let bytesRead = 0;
      let fileBuffer = Buffer.alloc(0);

      const processData = (data: Buffer) => {
        headerBuffer = Buffer.concat([headerBuffer, data]);

        while (headerBuffer.length >= 512) {
          if (!currentFile) {
            // Parse tar header
            const header = headerBuffer.subarray(0, 512);
            headerBuffer = headerBuffer.subarray(512);

            // Check for empty header (end of archive)
            if (header.every((b) => b === 0)) {
              return;
            }

            // Extract filename (bytes 0-99)
            let name = '';
            for (let i = 0; i < 100 && header[i] !== 0; i++) {
              name += String.fromCharCode(header[i]);
            }

            // Extract size (bytes 124-135, octal)
            let sizeStr = '';
            for (let i = 124; i < 136 && header[i] !== 0; i++) {
              sizeStr += String.fromCharCode(header[i]);
            }
            const size = parseInt(sizeStr.trim(), 8) || 0;

            if (name && size > 0) {
              // Extract just the filename (handle directories)
              const baseName = path.basename(name);
              if (
                baseName === execName ||
                baseName === archiveBinaryName ||
                baseName === 'cli-proxy-api'
              ) {
                currentFile = { name: baseName, size };
                fileBuffer = Buffer.alloc(0);
                bytesRead = 0;
              } else {
                // Skip this file's data
                const paddedSize = Math.ceil(size / 512) * 512;
                if (headerBuffer.length >= paddedSize) {
                  headerBuffer = headerBuffer.subarray(paddedSize);
                } else {
                  // Need to skip data in chunks
                  currentFile = { name: '', size: paddedSize };
                  bytesRead = 0;
                }
              }
            }
          } else {
            // Read file data
            const remaining = currentFile.size - bytesRead;
            const chunk = headerBuffer.subarray(0, Math.min(remaining, headerBuffer.length));
            headerBuffer = headerBuffer.subarray(chunk.length);

            if (currentFile.name) {
              fileBuffer = Buffer.concat([fileBuffer, chunk]);
            }
            bytesRead += chunk.length;

            if (bytesRead >= currentFile.size) {
              // File complete
              if (currentFile.name) {
                const destPath = path.join(destDir, execName);
                fs.writeFileSync(destPath, fileBuffer);
                this.log(`Extracted: ${currentFile.name} -> ${destPath}`);
              }

              // Skip padding to 512-byte boundary
              const paddedSize = Math.ceil(currentFile.size / 512) * 512;
              const padding = paddedSize - currentFile.size;
              if (headerBuffer.length >= padding) {
                headerBuffer = headerBuffer.subarray(padding);
              }

              currentFile = null;
              fileBuffer = Buffer.alloc(0);
            }
          }
        }
      };

      input.pipe(gunzip);
      gunzip.on('data', processData);
      gunzip.on('end', resolve);
      gunzip.on('error', reject);
      input.on('error', reject);
    });
  }

  /**
   * Extract zip archive using Node.js (simple implementation)
   */
  private extractZip(archivePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const destDir = this.config.binPath;
      const execName = getExecutableName();
      const archiveBinaryName = getArchiveBinaryName();
      const buffer = fs.readFileSync(archivePath);

      // Find End of Central Directory record (EOCD)
      let eocdOffset = buffer.length - 22;
      while (eocdOffset >= 0) {
        if (buffer.readUInt32LE(eocdOffset) === 0x06054b50) {
          break;
        }
        eocdOffset--;
      }

      if (eocdOffset < 0) {
        reject(new Error('Invalid ZIP file: EOCD not found'));
        return;
      }

      const centralDirOffset = buffer.readUInt32LE(eocdOffset + 16);
      let offset = centralDirOffset;

      // Parse central directory
      while (offset < eocdOffset) {
        const sig = buffer.readUInt32LE(offset);
        if (sig !== 0x02014b50) break;

        const compressionMethod = buffer.readUInt16LE(offset + 10);
        const compressedSize = buffer.readUInt32LE(offset + 20);
        const uncompressedSize = buffer.readUInt32LE(offset + 24);
        const fileNameLength = buffer.readUInt16LE(offset + 28);
        const extraFieldLength = buffer.readUInt16LE(offset + 30);
        const commentLength = buffer.readUInt16LE(offset + 32);
        const localHeaderOffset = buffer.readUInt32LE(offset + 42);

        const fileName = buffer.toString('utf8', offset + 46, offset + 46 + fileNameLength);
        const baseName = path.basename(fileName);

        // Check if this is the executable we want
        if (
          baseName === execName ||
          baseName === archiveBinaryName ||
          baseName === 'cli-proxy-api.exe'
        ) {
          // Read from local file header
          const localOffset = localHeaderOffset;
          const localSig = buffer.readUInt32LE(localOffset);

          if (localSig !== 0x04034b50) {
            reject(new Error('Invalid local file header'));
            return;
          }

          const localFileNameLength = buffer.readUInt16LE(localOffset + 26);
          const localExtraLength = buffer.readUInt16LE(localOffset + 28);
          const dataOffset = localOffset + 30 + localFileNameLength + localExtraLength;

          let fileData: Buffer;
          if (compressionMethod === 0) {
            // Stored (no compression)
            fileData = buffer.subarray(dataOffset, dataOffset + compressedSize);
          } else if (compressionMethod === 8) {
            // Deflate
            const compressed = buffer.subarray(dataOffset, dataOffset + compressedSize);
            fileData = zlib.inflateRawSync(compressed);
          } else {
            reject(new Error(`Unsupported compression method: ${compressionMethod}`));
            return;
          }

          if (fileData.length !== uncompressedSize) {
            reject(new Error('Decompression size mismatch'));
            return;
          }

          const destPath = path.join(destDir, execName);
          fs.writeFileSync(destPath, fileData);
          this.log(`Extracted: ${fileName} -> ${destPath}`);
          resolve();
          return;
        }

        offset += 46 + fileNameLength + extraFieldLength + commentLength;
      }

      reject(new Error(`Executable not found in archive: ${execName}`));
    });
  }

  /**
   * Delete binary (for cleanup or reinstall)
   */
  deleteBinary(): void {
    const binaryPath = this.getBinaryPath();
    if (fs.existsSync(binaryPath)) {
      fs.unlinkSync(binaryPath);
      this.log(`Deleted: ${binaryPath}`);
    }
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Log message if verbose
   */
  private log(message: string): void {
    if (this.verbose) {
      console.error(`[cliproxy] ${message}`);
    }
  }
}

/**
 * Convenience function to ensure binary is available
 * Respects version pin if set by user via 'ccs cliproxy --install <version>'
 * @returns Path to CLIProxyAPI executable
 */
export async function ensureCLIProxyBinary(verbose = false): Promise<string> {
  const pinnedVersion = getPinnedVersion();

  if (pinnedVersion) {
    // Version is pinned - use forceVersion to prevent auto-update
    if (verbose) {
      console.error(`[cliproxy] Using pinned version: ${pinnedVersion}`);
    }
    const manager = new BinaryManager({
      version: pinnedVersion,
      verbose,
      forceVersion: true,
    });
    return manager.ensureBinary();
  }

  // No pin - allow auto-update to latest
  const manager = new BinaryManager({ verbose });
  return manager.ensureBinary();
}

/**
 * Check if CLIProxyAPI binary is installed
 */
export function isCLIProxyInstalled(): boolean {
  const manager = new BinaryManager();
  return manager.isBinaryInstalled();
}

/**
 * Get CLIProxyAPI binary path (may not exist)
 */
export function getCLIProxyPath(): string {
  const manager = new BinaryManager();
  return manager.getBinaryPath();
}

/**
 * Get installed CLIProxyAPI version from .version file
 * Returns the fallback version if not installed or version file missing
 */
export function getInstalledCliproxyVersion(): string {
  const versionFile = path.join(getBinDir(), '.version');
  if (fs.existsSync(versionFile)) {
    try {
      return fs.readFileSync(versionFile, 'utf8').trim();
    } catch {
      return CLIPROXY_FALLBACK_VERSION;
    }
  }
  return CLIPROXY_FALLBACK_VERSION;
}

/**
 * Install a specific version of CLIProxyAPI
 * Deletes existing binary and downloads the specified version
 *
 * @param version Version to install (e.g., "6.5.53")
 * @param verbose Enable verbose logging
 */
export async function installCliproxyVersion(version: string, verbose = false): Promise<void> {
  // Use forceVersion to prevent auto-upgrade to latest
  const manager = new BinaryManager({ version, verbose, forceVersion: true });

  // Delete existing binary if present
  if (manager.isBinaryInstalled()) {
    const currentVersion = getInstalledCliproxyVersion();
    if (verbose) {
      console.log(info(`Removing existing CLIProxyAPI v${currentVersion}`));
    }
    manager.deleteBinary();
  }

  // Install specified version (forceVersion prevents auto-upgrade)
  await manager.ensureBinary();
}

/**
 * Fetch the latest CLIProxyAPI version from GitHub API
 * @returns Latest version string (e.g., "6.5.53")
 */
export async function fetchLatestCliproxyVersion(): Promise<string> {
  const manager = new BinaryManager();
  const result = await manager.checkForUpdates();
  return result.latestVersion;
}

/** Update check result for API response */
export interface CliproxyUpdateCheckResult {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  fromCache: boolean;
  checkedAt: number; // Unix timestamp of last check
}

/**
 * Check for CLIProxyAPI binary updates
 * @returns Update check result with version info
 */
export async function checkCliproxyUpdate(): Promise<CliproxyUpdateCheckResult> {
  const manager = new BinaryManager();
  return manager.checkForUpdates();
}

/**
 * Get path to version pin file
 * @returns Absolute path to .version-pin file
 */
export function getVersionPinPath(): string {
  return path.join(getBinDir(), VERSION_PIN_FILE);
}

/**
 * Get pinned version if one exists
 * @returns Pinned version string, or null if not pinned
 */
export function getPinnedVersion(): string | null {
  const pinPath = getVersionPinPath();
  if (!fs.existsSync(pinPath)) {
    return null;
  }
  try {
    return fs.readFileSync(pinPath, 'utf8').trim();
  } catch {
    return null;
  }
}

/**
 * Save pinned version to persist user's explicit choice
 * @param version Version to pin (e.g., "6.5.50")
 */
export function savePinnedVersion(version: string): void {
  const pinPath = getVersionPinPath();
  try {
    fs.mkdirSync(path.dirname(pinPath), { recursive: true });
    fs.writeFileSync(pinPath, version, 'utf8');
  } catch {
    // Silent fail - not critical but log if verbose
  }
}

/**
 * Clear pinned version (unpin)
 */
export function clearPinnedVersion(): void {
  const pinPath = getVersionPinPath();
  if (fs.existsSync(pinPath)) {
    try {
      fs.unlinkSync(pinPath);
    } catch {
      // Silent fail
    }
  }
}

/**
 * Check if a version is currently pinned
 * @returns true if a version is pinned
 */
export function isVersionPinned(): boolean {
  return getPinnedVersion() !== null;
}

export default BinaryManager;
