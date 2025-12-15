/**
 * Auth Handler for CLIProxyAPI
 *
 * Manages OAuth authentication for CLIProxy providers (Gemini, Codex, Antigravity).
 * CLIProxyAPI handles OAuth internally - we just need to:
 * 1. Check if auth exists (token files in CCS auth directory)
 * 2. Trigger OAuth flow by spawning binary with auth flag
 * 3. Auto-detect headless environments (SSH, no DISPLAY)
 * 4. Use --no-browser flag for headless, display OAuth URL for manual auth
 *
 * Token storage: ~/.ccs/cliproxy/auth/<provider>/
 * Each provider has its own directory to avoid conflicts.
 */

import { execSync, spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { ok, fail, info, warn, color } from '../utils/ui';
import { ensureCLIProxyBinary } from './binary-manager';
import { generateConfig, getProviderAuthDir } from './config-generator';
import { CLIProxyProvider } from './types';
import {
  AccountInfo,
  discoverExistingAccounts,
  generateNickname,
  getDefaultAccount,
  getProviderAccounts,
  registerAccount,
  touchAccount,
} from './account-manager';
import {
  enhancedPreflightOAuthCheck,
  OAUTH_CALLBACK_PORTS as OAUTH_PORTS,
} from '../management/oauth-port-diagnostics';

/**
 * OAuth callback ports used by CLIProxyAPI (hardcoded in binary)
 * See: https://github.com/router-for-me/CLIProxyAPI/tree/main/internal/auth
 *
 * OAuth flow types per provider:
 * - Gemini: Authorization Code Flow with local callback server on port 8085
 * - Codex:  Authorization Code Flow with local callback server on port 1455
 * - Agy:    Authorization Code Flow with local callback server on port 51121
 * - Qwen:   Device Code Flow (polling-based, NO callback port needed)
 *
 * We auto-kill processes on callback ports before OAuth to avoid conflicts.
 */
const OAUTH_CALLBACK_PORTS: Partial<Record<CLIProxyProvider, number>> = {
  gemini: 8085,
  // codex uses 1455
  // agy uses 51121
  // qwen uses Device Code Flow - no callback port needed
};

/**
 * Kill any process using a specific port
 * Used to free OAuth callback port before authentication
 */
function killProcessOnPort(port: number, verbose: boolean): boolean {
  try {
    if (process.platform === 'win32') {
      // Windows: use netstat + taskkill
      const result = execSync(`netstat -ano | findstr :${port}`, {
        encoding: 'utf-8',
        stdio: 'pipe',
      });
      const lines = result.trim().split('\n');
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && /^\d+$/.test(pid)) {
          execSync(`taskkill /F /PID ${pid}`, { stdio: 'pipe' });
          if (verbose) console.error(`[auth] Killed process ${pid} on port ${port}`);
        }
      }
      return true;
    } else {
      // Unix: use lsof + kill
      const result = execSync(`lsof -ti:${port}`, { encoding: 'utf-8', stdio: 'pipe' });
      const pids = result
        .trim()
        .split('\n')
        .filter((p) => p);
      for (const pid of pids) {
        execSync(`kill -9 ${pid}`, { stdio: 'pipe' });
        if (verbose) console.error(`[auth] Killed process ${pid} on port ${port}`);
      }
      return pids.length > 0;
    }
  } catch {
    // No process on port or command failed - that's fine
    return false;
  }
}

/**
 * Detect if running in a headless environment (no browser available)
 *
 * IMPROVED: Avoids false positives on Windows desktop environments
 * where isTTY may be undefined due to terminal wrapper behavior.
 *
 * Case study: Vietnamese Windows users reported "command hangs" because
 * their terminal (PowerShell via npm) didn't set isTTY correctly.
 */
function isHeadlessEnvironment(): boolean {
  // SSH session - always headless
  if (process.env.SSH_TTY || process.env.SSH_CLIENT || process.env.SSH_CONNECTION) {
    return true;
  }

  // No display on Linux (X11/Wayland) - headless
  if (process.platform === 'linux' && !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY) {
    return true;
  }

  // Windows desktop - NEVER headless unless SSH (already checked above)
  // This fixes false positive where Windows npm wrappers don't set isTTY correctly
  // Windows desktop environments always have browser capability
  if (process.platform === 'win32') {
    return false;
  }

  // macOS - check for proper terminal
  if (process.platform === 'darwin') {
    // Non-interactive stdin on macOS means likely piped/scripted
    if (!process.stdin.isTTY) {
      return true;
    }
    return false;
  }

  // Linux with display - check TTY
  if (process.platform === 'linux') {
    if (!process.stdin.isTTY) {
      return true;
    }
    return false;
  }

  // Default fallback for unknown platforms
  return !process.stdin.isTTY;
}

/**
 * Auth status for a provider
 */
export interface AuthStatus {
  /** Provider name */
  provider: CLIProxyProvider;
  /** Whether authentication exists */
  authenticated: boolean;
  /** Path to token directory */
  tokenDir: string;
  /** Token file paths found */
  tokenFiles: string[];
  /** When last authenticated (if known) */
  lastAuth?: Date;
  /** Accounts registered for this provider (multi-account support) */
  accounts: AccountInfo[];
  /** Default account ID */
  defaultAccount?: string;
}

/**
 * OAuth config for each provider
 */
interface ProviderOAuthConfig {
  /** Provider identifier */
  provider: CLIProxyProvider;
  /** Display name */
  displayName: string;
  /** OAuth authorization URL (for manual flow) */
  authUrl: string;
  /** Scopes required */
  scopes: string[];
  /** CLI flag for auth */
  authFlag: string;
}

/**
 * OAuth configurations per provider
 * Note: CLIProxyAPI handles actual OAuth - these are for display/manual flow
 */
const OAUTH_CONFIGS: Record<CLIProxyProvider, ProviderOAuthConfig> = {
  gemini: {
    provider: 'gemini',
    displayName: 'Google Gemini',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    scopes: ['https://www.googleapis.com/auth/generative-language'],
    authFlag: '--login',
  },
  codex: {
    provider: 'codex',
    displayName: 'Codex',
    authUrl: 'https://auth.openai.com/authorize',
    scopes: ['openid', 'profile'],
    authFlag: '--codex-login',
  },
  agy: {
    provider: 'agy',
    displayName: 'Antigravity',
    authUrl: 'https://antigravity.ai/oauth/authorize',
    scopes: ['api'],
    authFlag: '--antigravity-login',
  },
  qwen: {
    provider: 'qwen',
    displayName: 'Qwen Code',
    authUrl: 'https://chat.qwen.ai/api/v1/oauth2/device/code',
    scopes: ['openid', 'profile', 'email', 'model.completion'],
    authFlag: '--qwen-login',
  },
  iflow: {
    provider: 'iflow',
    displayName: 'iFlow',
    authUrl: 'https://iflow.cn/oauth',
    scopes: ['phone', 'profile', 'email'],
    authFlag: '--iflow-login',
  },
};

/**
 * Get OAuth config for provider
 */
export function getOAuthConfig(provider: CLIProxyProvider): ProviderOAuthConfig {
  const config = OAUTH_CONFIGS[provider];
  if (!config) {
    throw new Error(`Unknown provider: ${provider}`);
  }
  return config;
}

/**
 * Get token directory for provider
 */
export function getProviderTokenDir(provider: CLIProxyProvider): string {
  return getProviderAuthDir(provider);
}

/**
 * Provider-specific auth file prefixes (fallback detection)
 * CLIProxyAPI names auth files with provider prefix (e.g., "antigravity-user@email.json")
 * Note: Gemini tokens may NOT have prefix - CLIProxyAPI uses {email}-{projectID}.json format
 */
const PROVIDER_AUTH_PREFIXES: Record<CLIProxyProvider, string[]> = {
  gemini: ['gemini-', 'google-'],
  codex: ['codex-', 'openai-'],
  agy: ['antigravity-', 'agy-'],
  qwen: ['qwen-'],
  iflow: ['iflow-'],
};

/**
 * Provider type values inside token JSON files
 * CLIProxyAPI sets "type" field in token JSON (e.g., {"type": "gemini"})
 */
const PROVIDER_TYPE_VALUES: Record<CLIProxyProvider, string[]> = {
  gemini: ['gemini'],
  codex: ['codex'],
  agy: ['antigravity'],
  qwen: ['qwen'],
  iflow: ['iflow'],
};

/**
 * Check if a JSON file contains a token for the given provider
 * Reads the file and checks the "type" field
 */
function isTokenFileForProvider(filePath: string, provider: CLIProxyProvider): boolean {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);
    const typeValue = (data.type || '').toLowerCase();
    const validTypes = PROVIDER_TYPE_VALUES[provider] || [];
    return validTypes.includes(typeValue);
  } catch {
    return false;
  }
}

/**
 * Check if provider has valid authentication
 * CLIProxyAPI stores OAuth tokens as JSON files in the auth directory.
 * Detection strategy:
 * 1. First check by filename prefix (fast path)
 * 2. If no match, check JSON content for "type" field (Gemini uses {email}-{projectID}.json without prefix)
 */
export function isAuthenticated(provider: CLIProxyProvider): boolean {
  const tokenDir = getProviderTokenDir(provider);

  if (!fs.existsSync(tokenDir)) {
    return false;
  }

  const validPrefixes = PROVIDER_AUTH_PREFIXES[provider] || [];

  try {
    const files = fs.readdirSync(tokenDir);
    const jsonFiles = files.filter(
      (f) => f.endsWith('.json') || f.endsWith('.token') || f === 'credentials'
    );

    // Strategy 1: Check by filename prefix (fast path for antigravity, codex)
    const prefixMatch = jsonFiles.some((f) => {
      const lowerFile = f.toLowerCase();
      return validPrefixes.some((prefix) => lowerFile.startsWith(prefix));
    });
    if (prefixMatch) return true;

    // Strategy 2: Check JSON content for "type" field (needed for Gemini)
    for (const f of jsonFiles) {
      const filePath = path.join(tokenDir, f);
      if (isTokenFileForProvider(filePath, provider)) {
        return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Get detailed auth status for provider
 * Uses same detection strategy as isAuthenticated: prefix first, then content
 */
export function getAuthStatus(provider: CLIProxyProvider): AuthStatus {
  const tokenDir = getProviderTokenDir(provider);
  let tokenFiles: string[] = [];
  let lastAuth: Date | undefined;

  const validPrefixes = PROVIDER_AUTH_PREFIXES[provider] || [];

  if (fs.existsSync(tokenDir)) {
    const files = fs.readdirSync(tokenDir);
    const jsonFiles = files.filter(
      (f) => f.endsWith('.json') || f.endsWith('.token') || f === 'credentials'
    );

    // Check each file: by prefix OR by content
    tokenFiles = jsonFiles.filter((f) => {
      const lowerFile = f.toLowerCase();
      // Strategy 1: prefix match
      if (validPrefixes.some((prefix) => lowerFile.startsWith(prefix))) {
        return true;
      }
      // Strategy 2: content match (for Gemini tokens without prefix)
      const filePath = path.join(tokenDir, f);
      return isTokenFileForProvider(filePath, provider);
    });

    // Get most recent modification time
    for (const file of tokenFiles) {
      const filePath = path.join(tokenDir, file);
      try {
        const stats = fs.statSync(filePath);
        if (!lastAuth || stats.mtime > lastAuth) {
          lastAuth = stats.mtime;
        }
      } catch {
        // Skip if can't stat file
      }
    }
  }

  // Get registered accounts for multi-account support
  const accounts = getProviderAccounts(provider);
  const defaultAccount = getDefaultAccount(provider);

  return {
    provider,
    authenticated: tokenFiles.length > 0,
    tokenDir,
    tokenFiles,
    lastAuth,
    accounts,
    defaultAccount: defaultAccount?.id,
  };
}

/**
 * Get auth status for all providers
 */
export function getAllAuthStatus(): AuthStatus[] {
  const providers: CLIProxyProvider[] = ['gemini', 'codex', 'agy', 'qwen', 'iflow'];
  return providers.map(getAuthStatus);
}

/**
 * Clear authentication for provider
 * Only removes files belonging to the specified provider (by prefix or content)
 * Does NOT remove the shared auth directory or other providers' files
 */
export function clearAuth(provider: CLIProxyProvider): boolean {
  const tokenDir = getProviderTokenDir(provider);

  if (!fs.existsSync(tokenDir)) {
    return false;
  }

  const validPrefixes = PROVIDER_AUTH_PREFIXES[provider] || [];
  const files = fs.readdirSync(tokenDir);
  let removedCount = 0;

  // Only remove files that belong to this provider
  for (const file of files) {
    const filePath = path.join(tokenDir, file);
    const lowerFile = file.toLowerCase();

    // Check by prefix first (fast path)
    const matchesByPrefix = validPrefixes.some((prefix) => lowerFile.startsWith(prefix));

    // If no prefix match, check by content (for Gemini tokens without prefix)
    const matchesByContent = !matchesByPrefix && isTokenFileForProvider(filePath, provider);

    if (matchesByPrefix || matchesByContent) {
      try {
        fs.unlinkSync(filePath);
        removedCount++;
      } catch {
        // Failed to remove - skip
      }
    }
  }

  // DO NOT remove the shared auth directory - other providers may still have tokens
  return removedCount > 0;
}

/**
 * Display a single step status line
 */
function showStep(
  step: number,
  total: number,
  status: 'ok' | 'fail' | 'progress',
  message: string
): void {
  const statusIcon = status === 'ok' ? '[OK]' : status === 'fail' ? '[X]' : '[..]';
  console.log(`${statusIcon} [${step}/${total}] ${message}`);
}

/**
 * Get platform-specific troubleshooting for OAuth timeout
 */
function getTimeoutTroubleshooting(provider: CLIProxyProvider, port: number | null): string[] {
  const lines: string[] = [];
  lines.push('');
  lines.push('TROUBLESHOOTING:');
  lines.push('  1. Check browser completed auth (should show success page)');

  if (port) {
    if (process.platform === 'win32') {
      lines.push(`  2. Verify port ${port} is reachable: curl http://localhost:${port}`);
      lines.push('  3. Windows Firewall may block - run as Administrator:');
      lines.push(
        `     netsh advfirewall firewall add rule name="CCS OAuth" dir=in action=allow protocol=TCP localport=${port}`
      );
      lines.push(`  4. Try: ccs ${provider} --auth --verbose`);
    } else if (process.platform === 'darwin') {
      lines.push(`  2. Check for port conflicts: lsof -ti:${port}`);
      lines.push(`  3. Try: ccs ${provider} --auth --verbose`);
    } else {
      lines.push(`  2. Check for port conflicts: lsof -ti:${port} or ss -tlnp | grep ${port}`);
      lines.push(`  3. Try: ccs ${provider} --auth --verbose`);
    }
  } else {
    lines.push(`  2. Try: ccs ${provider} --auth --verbose`);
  }

  return lines;
}

/**
 * Trigger OAuth flow for provider
 * Auto-detects headless environment and uses --no-browser flag accordingly
 * Shows real-time step-by-step progress for better user feedback
 * @param provider - The CLIProxy provider to authenticate
 * @param options - OAuth options
 * @param options.add - If true, skip confirm prompt when adding another account
 * @returns Account info if successful, null otherwise
 */
export async function triggerOAuth(
  provider: CLIProxyProvider,
  options: {
    verbose?: boolean;
    headless?: boolean;
    account?: string;
    add?: boolean;
    nickname?: string;
  } = {}
): Promise<AccountInfo | null> {
  const oauthConfig = getOAuthConfig(provider);
  const { verbose = false, add = false, nickname } = options;
  const callbackPort = OAUTH_PORTS[provider];

  // Auto-detect headless if not explicitly set
  const headless = options.headless ?? isHeadlessEnvironment();

  const log = (msg: string) => {
    if (verbose) {
      console.error(`[auth] ${msg}`);
    }
  };

  // Check for existing accounts and prompt if --add not specified
  const existingAccounts = getProviderAccounts(provider);
  if (existingAccounts.length > 0 && !add) {
    console.log('');
    console.log(
      info(
        `${existingAccounts.length} account(s) already authenticated for ${oauthConfig.displayName}`
      )
    );

    // Import readline for confirm prompt
    const readline = await import('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const confirmed = await new Promise<boolean>((resolve) => {
      rl.question('[?] Add another account? (y/N): ', (answer) => {
        rl.close();
        resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
      });
    });

    if (!confirmed) {
      console.log(info('Cancelled'));
      return null;
    }
  }

  // Enhanced pre-flight check with real-time display
  console.log('');
  console.log(info(`Pre-flight OAuth check for ${oauthConfig.displayName}...`));

  const preflight = await enhancedPreflightOAuthCheck(provider);

  // Display each check result
  for (const check of preflight.checks) {
    const icon = check.status === 'ok' ? '[OK]' : check.status === 'warn' ? '[!]' : '[X]';
    console.log(`  ${icon} ${check.name}: ${check.message}`);
    if (check.fixCommand && check.status !== 'ok') {
      console.log(`      Fix: ${check.fixCommand}`);
    }
  }

  // Show firewall warning prominently on Windows
  if (preflight.firewallWarning) {
    console.log('');
    console.log(warn('Windows Firewall may block OAuth callback'));
    console.log('    If auth hangs, run as Administrator:');
    console.log(`    ${color(preflight.firewallFixCommand || '', 'command')}`);
  }

  if (!preflight.ready) {
    console.log('');
    console.log(fail('Pre-flight check failed. Resolve issues above and retry.'));
    return null;
  }

  console.log('');

  // Step 1: Ensure binary exists
  showStep(1, 4, 'progress', 'Preparing CLIProxy binary...');
  let binaryPath: string;
  try {
    binaryPath = await ensureCLIProxyBinary(verbose);
    // Clear and rewrite with OK
    process.stdout.write('\x1b[1A\x1b[2K'); // Move up and clear line
    showStep(1, 4, 'ok', 'CLIProxy binary ready');
  } catch (error) {
    process.stdout.write('\x1b[1A\x1b[2K');
    showStep(1, 4, 'fail', 'Failed to prepare CLIProxy binary');
    console.error(fail((error as Error).message));
    throw error;
  }

  // Ensure auth directory exists
  const tokenDir = getProviderTokenDir(provider);
  fs.mkdirSync(tokenDir, { recursive: true, mode: 0o700 });

  // Generate config file (CLIProxyAPI requires it even for auth)
  const configPath = generateConfig(provider);
  log(`Config generated: ${configPath}`);

  // Free OAuth callback port if needed
  const localCallbackPort = OAUTH_CALLBACK_PORTS[provider];
  if (localCallbackPort) {
    const killed = killProcessOnPort(localCallbackPort, verbose);
    if (killed) {
      log(`Freed port ${localCallbackPort} for OAuth callback`);
    }
  }

  // Build args: config + auth flag + optional --no-browser for headless
  const args = ['--config', configPath, oauthConfig.authFlag];
  if (headless) {
    args.push('--no-browser');
  }

  // Step 2: Starting callback server
  showStep(2, 4, 'progress', `Starting callback server on port ${callbackPort || 'N/A'}...`);

  // Show headless instructions if needed
  if (headless) {
    console.log('');
    console.log(warn('PORT FORWARDING REQUIRED'));
    console.log(`    OAuth callback uses localhost:${callbackPort} which must be reachable.`);
    console.log('    Run this on your LOCAL machine:');
    console.log(
      `    ${color(`ssh -L ${callbackPort}:localhost:${callbackPort} <USER>@<HOST>`, 'command')}`
    );
    console.log('');
  }

  return new Promise<AccountInfo | null>((resolve) => {
    // Spawn CLIProxyAPI with auth flag
    const authProcess = spawn(binaryPath, args, {
      stdio: ['inherit', 'pipe', 'pipe'],
      env: {
        ...process.env,
        CLI_PROXY_AUTH_DIR: tokenDir,
      },
    });

    let stderrData = '';
    let urlDisplayed = false;
    let browserOpened = false;
    const startTime = Date.now();

    authProcess.stdout?.on('data', (data: Buffer) => {
      const output = data.toString();
      log(`stdout: ${output.trim()}`);

      // Detect when callback server starts or browser opens
      if (!browserOpened && (output.includes('listening') || output.includes('http'))) {
        process.stdout.write('\x1b[1A\x1b[2K');
        showStep(2, 4, 'ok', `Callback server listening on port ${callbackPort}`);
        showStep(3, 4, 'progress', 'Opening browser...');
        browserOpened = true;
      }

      // In headless mode, display OAuth URLs prominently
      if (headless) {
        const urlMatch = output.match(/https?:\/\/[^\s]+/);
        if (urlMatch && !urlDisplayed) {
          console.log('');
          console.log(info(`${oauthConfig.displayName} OAuth URL:`));
          console.log(`    ${urlMatch[0]}`);
          console.log('');
          urlDisplayed = true;
        }
      }
    });

    authProcess.stderr?.on('data', (data: Buffer) => {
      const output = data.toString();
      stderrData += output;
      log(`stderr: ${output.trim()}`);

      // Also check stderr for URLs
      if (headless && !urlDisplayed) {
        const urlMatch = output.match(/https?:\/\/[^\s]+/);
        if (urlMatch) {
          console.log('');
          console.log(info(`${oauthConfig.displayName} OAuth URL:`));
          console.log(`    ${urlMatch[0]}`);
          console.log('');
          urlDisplayed = true;
        }
      }
    });

    // After a short delay, assume browser opened and show waiting
    setTimeout(() => {
      if (!browserOpened) {
        process.stdout.write('\x1b[1A\x1b[2K');
        showStep(2, 4, 'ok', `Callback server ready (port ${callbackPort})`);
        showStep(3, 4, 'ok', 'Browser opened');
        browserOpened = true;
      }
      showStep(4, 4, 'progress', 'Waiting for OAuth callback...');
      console.log('');
      console.log(info('Complete the login in your browser. This page will update automatically.'));
      if (!verbose) {
        console.log(info('If stuck, try: ccs ' + provider + ' --auth --verbose'));
      }
    }, 2000);

    // Timeout after 5 minutes for headless, 2 minutes for normal
    const timeoutMs = headless ? 300000 : 120000;
    const timeout = setTimeout(() => {
      authProcess.kill();
      console.log('');
      console.log(fail(`OAuth timed out after ${headless ? 5 : 2} minutes`));

      // Show platform-specific troubleshooting
      const troubleshooting = getTimeoutTroubleshooting(provider, callbackPort);
      for (const line of troubleshooting) {
        console.log(line);
      }

      resolve(null);
    }, timeoutMs);

    authProcess.on('exit', (code) => {
      clearTimeout(timeout);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

      if (code === 0) {
        // Verify token was created BEFORE showing success
        if (isAuthenticated(provider)) {
          console.log('');
          console.log(ok(`Authentication successful (${elapsed}s)`));

          // Register the account in accounts registry
          const account = registerAccountFromToken(provider, tokenDir, nickname);
          resolve(account);
        } else {
          console.log('');
          console.log(fail('Token not found after authentication'));
          console.log('');
          console.log('The browser showed success but callback was not received.');

          // Show platform-specific guidance
          if (process.platform === 'win32') {
            console.log('');
            console.log('On Windows, this usually means:');
            console.log('  1. Windows Firewall blocked the callback');
            console.log('  2. Antivirus software blocked the connection');
            console.log('');
            console.log('Try running as Administrator:');
            console.log(
              `  netsh advfirewall firewall add rule name="CCS OAuth" dir=in action=allow protocol=TCP localport=${callbackPort}`
            );
          }

          console.log('');
          console.log(`Try: ccs ${provider} --auth --verbose`);
          resolve(null);
        }
      } else {
        console.log('');
        console.log(fail(`CLIProxyAPI auth exited with code ${code}`));
        if (stderrData && !urlDisplayed) {
          console.log(`    ${stderrData.trim().split('\n')[0]}`);
        }
        if (headless && !urlDisplayed) {
          console.log('');
          console.log(info('No OAuth URL was displayed. Try with --verbose for details.'));
        }
        resolve(null);
      }
    });

    authProcess.on('error', (error) => {
      clearTimeout(timeout);
      console.log('');
      console.log(fail(`Failed to start auth process: ${error.message}`));
      resolve(null);
    });
  });
}

/**
 * Register account from newly created token file
 * Scans auth directory for new token and extracts email
 * @param provider - The CLIProxy provider
 * @param tokenDir - Directory containing token files
 * @param nickname - Optional nickname (uses auto-generated from email if not provided)
 */
function registerAccountFromToken(
  provider: CLIProxyProvider,
  tokenDir: string,
  nickname?: string
): AccountInfo | null {
  try {
    const files = fs.readdirSync(tokenDir);
    const jsonFiles = files.filter((f) => f.endsWith('.json'));

    // Find newest token file for this provider
    let newestFile: string | null = null;
    let newestMtime = 0;

    for (const file of jsonFiles) {
      const filePath = path.join(tokenDir, file);
      if (!isTokenFileForProvider(filePath, provider)) continue;

      const stats = fs.statSync(filePath);
      if (stats.mtimeMs > newestMtime) {
        newestMtime = stats.mtimeMs;
        newestFile = file;
      }
    }

    if (!newestFile) {
      return null;
    }

    // Read token to extract email
    const tokenPath = path.join(tokenDir, newestFile);
    const content = fs.readFileSync(tokenPath, 'utf-8');
    const data = JSON.parse(content);
    const email = data.email || undefined;

    // Register the account (use provided nickname or auto-generate from email)
    return registerAccount(provider, newestFile, email, nickname || generateNickname(email));
  } catch {
    return null;
  }
}

/**
 * Ensure provider is authenticated
 * Triggers OAuth flow if not authenticated
 * @param provider - The CLIProxy provider
 * @param options - Auth options including optional account
 * @returns true if authenticated, false otherwise
 */
export async function ensureAuth(
  provider: CLIProxyProvider,
  options: { verbose?: boolean; headless?: boolean; account?: string } = {}
): Promise<boolean> {
  // Check if already authenticated
  if (isAuthenticated(provider)) {
    if (options.verbose) {
      console.error(`[auth] ${provider} already authenticated`);
    }
    // Touch the account to update last used time
    const defaultAccount = getDefaultAccount(provider);
    if (defaultAccount) {
      touchAccount(provider, options.account || defaultAccount.id);
    }
    return true;
  }

  // Not authenticated - trigger OAuth
  const oauthConfig = getOAuthConfig(provider);
  console.log(info(`${oauthConfig.displayName} authentication required`));

  const account = await triggerOAuth(provider, options);
  return account !== null;
}

/**
 * Initialize accounts registry from existing tokens
 * Should be called on startup to populate accounts from existing token files
 */
export function initializeAccounts(): void {
  discoverExistingAccounts();
}

/**
 * Display auth status for all providers
 */
export function displayAuthStatus(): void {
  console.log('CLIProxy Authentication Status:');
  console.log('');

  const statuses = getAllAuthStatus();

  for (const status of statuses) {
    const oauthConfig = getOAuthConfig(status.provider);
    const icon = status.authenticated ? '[OK]' : '[!]';
    const authStatus = status.authenticated ? 'Authenticated' : 'Not authenticated';
    const lastAuthStr = status.lastAuth ? ` (last: ${status.lastAuth.toLocaleDateString()})` : '';

    console.log(`${icon} ${oauthConfig.displayName}: ${authStatus}${lastAuthStr}`);
  }

  console.log('');
  console.log('To authenticate: ccs <provider> --auth');
  console.log('To logout:       ccs <provider> --logout');
}
