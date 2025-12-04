/**
 * CLIProxy Command Handler
 *
 * Manages CLIProxyAPI binary installation and version control.
 * Allows users to install specific versions or update to latest.
 *
 * Usage:
 *   ccs cliproxy                  Show current version
 *   ccs cliproxy --install <ver>  Install specific version
 *   ccs cliproxy --latest         Install latest version
 *   ccs cliproxy --help           Show help
 */

import {
  getInstalledCliproxyVersion,
  installCliproxyVersion,
  fetchLatestCliproxyVersion,
  isCLIProxyInstalled,
  getCLIProxyPath,
} from '../cliproxy';
import { CLIPROXY_FALLBACK_VERSION } from '../cliproxy/platform-detector';
import { color, dim, initUI } from '../utils/ui';

/**
 * Show cliproxy command help
 */
function showHelp(): void {
  console.log('');
  console.log('Usage: ccs cliproxy [options]');
  console.log('');
  console.log('Manage CLIProxyAPI binary installation.');
  console.log('');
  console.log('Options:');
  console.log('  --install <version>  Install a specific version (e.g., 6.5.40)');
  console.log('  --latest             Install the latest version from GitHub');
  console.log('  --verbose, -v        Enable verbose output');
  console.log('  --help, -h           Show this help message');
  console.log('');
  console.log('Examples:');
  console.log('  ccs cliproxy                  Show current installed version');
  console.log('  ccs cliproxy --install 6.5.38 Install version 6.5.38');
  console.log('  ccs cliproxy --latest         Update to latest version');
  console.log('');
  console.log('Notes:');
  console.log(`  Default fallback version: ${CLIPROXY_FALLBACK_VERSION}`);
  console.log('  Releases: https://github.com/router-for-me/CLIProxyAPI/releases');
  console.log('');
}

/**
 * Show current cliproxy status
 */
async function showStatus(verbose: boolean): Promise<void> {
  await initUI();

  const installed = isCLIProxyInstalled();
  const currentVersion = getInstalledCliproxyVersion();
  const binaryPath = getCLIProxyPath();

  console.log('');
  console.log(color('CLIProxyAPI Status', 'primary'));
  console.log('');

  if (installed) {
    console.log(`  Installed:  ${color('Yes', 'success')}`);
    console.log(`  Version:    ${color(`v${currentVersion}`, 'info')}`);
    console.log(`  Binary:     ${dim(binaryPath)}`);
  } else {
    console.log(`  Installed:  ${color('No', 'error')}`);
    console.log(`  Fallback:   ${color(`v${CLIPROXY_FALLBACK_VERSION}`, 'info')}`);
    console.log(`  ${dim('Run "ccs gemini" or any provider to auto-install')}`);
  }

  // Try to fetch latest version
  try {
    console.log('');
    console.log(`  ${dim('Checking for updates...')}`);
    const latestVersion = await fetchLatestCliproxyVersion();

    if (latestVersion !== currentVersion) {
      console.log(
        `  Latest:     ${color(`v${latestVersion}`, 'success')} ${dim('(update available)')}`
      );
      console.log('');
      console.log(`  ${dim(`Run "ccs cliproxy --latest" to update`)}`);
    } else {
      console.log(`  Latest:     ${color(`v${latestVersion}`, 'success')} ${dim('(up to date)')}`);
    }
  } catch (error) {
    if (verbose) {
      const err = error as Error;
      console.log(`  Latest:     ${dim(`Could not fetch (${err.message})`)}`);
    }
  }

  console.log('');
}

/**
 * Install a specific version
 */
async function installVersion(version: string, verbose: boolean): Promise<void> {
  // Validate version format (basic semver check)
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    console.error('[X] Invalid version format. Expected format: X.Y.Z (e.g., 6.5.40)');
    process.exit(1);
  }

  console.log(`[i] Installing CLIProxyAPI v${version}...`);
  console.log('');

  try {
    await installCliproxyVersion(version, verbose);
    console.log('');
    console.log(`[OK] CLIProxyAPI v${version} installed successfully`);
  } catch (error) {
    const err = error as Error;
    console.error('');
    console.error(`[X] Failed to install CLIProxyAPI v${version}`);
    console.error(`    ${err.message}`);
    console.error('');
    console.error('Possible causes:');
    console.error('  1. Version does not exist on GitHub');
    console.error('  2. Network connectivity issues');
    console.error('  3. GitHub API rate limiting');
    console.error('');
    console.error('Check available versions at:');
    console.error('  https://github.com/router-for-me/CLIProxyAPI/releases');
    process.exit(1);
  }
}

/**
 * Install latest version
 */
async function installLatest(verbose: boolean): Promise<void> {
  console.log('[i] Fetching latest CLIProxyAPI version...');

  try {
    const latestVersion = await fetchLatestCliproxyVersion();
    const currentVersion = getInstalledCliproxyVersion();

    if (isCLIProxyInstalled() && latestVersion === currentVersion) {
      console.log(`[OK] Already running latest version: v${latestVersion}`);
      return;
    }

    console.log(`[i] Latest version: v${latestVersion}`);
    if (isCLIProxyInstalled()) {
      console.log(`[i] Current version: v${currentVersion}`);
    }
    console.log('');

    await installCliproxyVersion(latestVersion, verbose);
    console.log('');
    console.log(`[OK] CLIProxyAPI updated to v${latestVersion}`);
  } catch (error) {
    const err = error as Error;
    console.error(`[X] Failed to install latest version: ${err.message}`);
    process.exit(1);
  }
}

/**
 * Main cliproxy command handler
 */
export async function handleCliproxyCommand(args: string[]): Promise<void> {
  const verbose = args.includes('--verbose') || args.includes('-v');

  // Handle --help
  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    return;
  }

  // Handle --install <version>
  const installIdx = args.indexOf('--install');
  if (installIdx !== -1) {
    const version = args[installIdx + 1];
    if (!version || version.startsWith('-')) {
      console.error('[X] Missing version argument for --install');
      console.error('    Usage: ccs cliproxy --install <version>');
      console.error('    Example: ccs cliproxy --install 6.5.40');
      process.exit(1);
    }
    await installVersion(version, verbose);
    return;
  }

  // Handle --latest
  if (args.includes('--latest')) {
    await installLatest(verbose);
    return;
  }

  // Default: show status
  await showStatus(verbose);
}
