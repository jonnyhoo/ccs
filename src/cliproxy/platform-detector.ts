/**
 * Platform Detector for CLIProxyAPI Binary Downloads
 *
 * Detects OS and architecture to determine correct binary asset.
 * Supports 6 platforms: darwin/linux/windows x amd64/arm64
 */

import { PlatformInfo, SupportedOS, SupportedArch, ArchiveExtension } from './types';

/**
 * CLIProxyAPI fallback version (used when GitHub API unavailable)
 * Auto-update fetches latest from GitHub; this is only a safety net
 */
export const CLIPROXY_FALLBACK_VERSION = '6.5.31';

/** @deprecated Use CLIPROXY_FALLBACK_VERSION instead */
export const CLIPROXY_VERSION = CLIPROXY_FALLBACK_VERSION;

/**
 * Platform mapping from Node.js values to CLIProxyAPI naming
 */
const OS_MAP: Record<string, SupportedOS | undefined> = {
  darwin: 'darwin',
  linux: 'linux',
  win32: 'windows',
};

const ARCH_MAP: Record<string, SupportedArch | undefined> = {
  x64: 'amd64',
  arm64: 'arm64',
};

/**
 * Detect current platform and return binary info
 * @param version Optional version for binaryName (defaults to fallback)
 * @throws Error if platform is unsupported
 */
export function detectPlatform(version: string = CLIPROXY_FALLBACK_VERSION): PlatformInfo {
  const nodePlatform = process.platform;
  const nodeArch = process.arch;

  const os = OS_MAP[nodePlatform];
  const arch = ARCH_MAP[nodeArch];

  if (!os) {
    throw new Error(
      `Unsupported operating system: ${nodePlatform}\n` +
        `Supported: macOS (darwin), Linux, Windows`
    );
  }

  if (!arch) {
    throw new Error(
      `Unsupported CPU architecture: ${nodeArch}\n` + `Supported: x64 (amd64), arm64`
    );
  }

  const extension: ArchiveExtension = os === 'windows' ? 'zip' : 'tar.gz';
  const binaryName = `CLIProxyAPI_${version}_${os}_${arch}.${extension}`;

  return {
    os,
    arch,
    binaryName,
    extension,
  };
}

/**
 * Get executable name based on platform
 * @returns Binary executable name (with .exe on Windows)
 * Note: The actual binary inside the archive is named 'cli-proxy-api'
 */
export function getExecutableName(): string {
  const platform = detectPlatform();
  return platform.os === 'windows' ? 'cli-proxy-api.exe' : 'cli-proxy-api';
}

/**
 * Get the name of the binary inside the archive
 * @returns Binary name as it appears in the tar.gz/zip
 */
export function getArchiveBinaryName(): string {
  const platform = detectPlatform();
  return platform.os === 'windows' ? 'cli-proxy-api.exe' : 'cli-proxy-api';
}

/**
 * Get download URL for current platform
 * @param version Version to download (defaults to fallback version)
 * @returns Full GitHub release download URL
 */
export function getDownloadUrl(version: string = CLIPROXY_FALLBACK_VERSION): string {
  const platform = detectPlatform(version);
  const baseUrl = `https://github.com/router-for-me/CLIProxyAPI/releases/download/v${version}`;
  return `${baseUrl}/${platform.binaryName}`;
}

/**
 * Get checksums.txt URL for version
 * @param version Version to get checksums for (defaults to fallback version)
 * @returns Full URL to checksums.txt
 */
export function getChecksumsUrl(version: string = CLIPROXY_FALLBACK_VERSION): string {
  return `https://github.com/router-for-me/CLIProxyAPI/releases/download/v${version}/checksums.txt`;
}

/**
 * Check if platform is supported
 * @returns true if current platform is supported
 */
export function isPlatformSupported(): boolean {
  try {
    detectPlatform();
    return true;
  } catch {
    return false;
  }
}

/**
 * Get human-readable platform description
 * @returns Description string (e.g., "macOS arm64")
 */
export function getPlatformDescription(): string {
  try {
    const platform = detectPlatform();
    const osName =
      platform.os === 'darwin' ? 'macOS' : platform.os === 'linux' ? 'Linux' : 'Windows';
    return `${osName} ${platform.arch}`;
  } catch {
    return `${process.platform} ${process.arch} (unsupported)`;
  }
}
