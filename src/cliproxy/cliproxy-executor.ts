/**
 * CLIProxy Executor - Spawn/Kill Pattern for CLIProxyAPI
 *
 * Mirrors GLMT architecture:
 * 1. Ensure binary exists (Phase 1)
 * 2. Generate config for provider
 * 3. Spawn CLIProxyAPI binary
 * 4. Poll port for readiness (no stdout signal)
 * 5. Execute Claude CLI with proxied environment
 * 6. Kill proxy on Claude exit
 *
 * Key difference from GLMT: Uses TCP port polling instead of PROXY_READY signal
 */

import { spawn, ChildProcess } from 'child_process';
import * as net from 'net';
import { ProgressIndicator } from '../utils/progress-indicator';
import { ok, fail, info, warn } from '../utils/ui';
import { escapeShellArg } from '../utils/shell-executor';
import { ensureCLIProxyBinary } from './binary-manager';
import {
  generateConfig,
  getEffectiveEnvVars,
  getProviderConfig,
  ensureProviderSettings,
  CLIPROXY_DEFAULT_PORT,
  getCliproxyWritablePath,
} from './config-generator';
import { isAuthenticated } from './auth-handler';
import { CLIProxyProvider, ExecutorConfig } from './types';
import { configureProviderModel, getCurrentModel } from './model-config';
import { getWebSearchHookEnv } from '../utils/websearch-manager';
import { supportsModelConfig, isModelBroken, getModelIssueUrl, findModel } from './model-catalog';
import {
  findAccountByQuery,
  getProviderAccounts,
  setDefaultAccount,
  touchAccount,
  renameAccount,
  getDefaultAccount,
} from './account-manager';
import { getPortCheckCommand, getCatCommand, killProcessOnPort } from '../utils/platform-commands';
import { getPortProcess, isCLIProxyProcess } from '../utils/port-utils';
import {
  ensureMcpWebSearch,
  installWebSearchHook,
  displayWebSearchStatus,
} from '../utils/websearch-manager';
import {
  getExistingProxy,
  registerSession,
  unregisterSession,
  hasActiveSessions,
  cleanupOrphanedSessions,
} from './session-tracker';

/** Default executor configuration */
const DEFAULT_CONFIG: ExecutorConfig = {
  port: CLIPROXY_DEFAULT_PORT,
  timeout: 5000,
  verbose: false,
  pollInterval: 100,
};

/**
 * Wait for TCP port to become available
 * Uses polling since CLIProxyAPI doesn't emit PROXY_READY signal
 */
async function waitForProxyReady(
  port: number,
  timeout: number = 5000,
  pollInterval: number = 100
): Promise<void> {
  const start = Date.now();

  while (Date.now() - start < timeout) {
    try {
      await new Promise<void>((resolve, reject) => {
        const socket = net.createConnection({ port, host: '127.0.0.1' }, () => {
          socket.destroy();
          resolve();
        });

        socket.on('error', (err) => {
          socket.destroy();
          reject(err);
        });

        // Individual connection timeout
        socket.setTimeout(1000, () => {
          socket.destroy();
          reject(new Error('Connection timeout'));
        });
      });

      return; // Connection successful - proxy is ready
    } catch {
      // Connection failed, wait and retry
      await new Promise((r) => setTimeout(r, pollInterval));
    }
  }

  throw new Error(`CLIProxy not ready after ${timeout}ms on port ${port}`);
}

/**
 * Execute Claude CLI with CLIProxy (main entry point)
 *
 * @param claudeCli Path to Claude CLI executable
 * @param provider CLIProxy provider (gemini, codex, agy, qwen)
 * @param args Arguments to pass to Claude CLI
 * @param config Optional executor configuration
 */
export async function execClaudeWithCLIProxy(
  claudeCli: string,
  provider: CLIProxyProvider,
  args: string[],
  config: Partial<ExecutorConfig> = {}
): Promise<void> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const verbose = cfg.verbose || args.includes('--verbose') || args.includes('-v');

  const log = (msg: string) => {
    if (verbose) {
      console.error(`[cliproxy] ${msg}`);
    }
  };

  // Ensure MCP web-search is configured for third-party profiles
  // WebSearch is a server-side tool executed by Anthropic's API
  // Third-party providers don't have access, so we use MCP fallback
  ensureMcpWebSearch();

  // Install WebSearch hook for Gemini CLI + MCP fallback
  // Hook intercepts WebSearch, tries Gemini CLI first, falls back to MCP
  installWebSearchHook();

  // Display WebSearch status (single line, equilibrium UX)
  displayWebSearchStatus();

  // Validate provider
  const providerConfig = getProviderConfig(provider);
  log(`Provider: ${providerConfig.displayName}`);

  // 1. Ensure binary exists (downloads if needed)
  const spinner = new ProgressIndicator('Preparing CLIProxy');
  spinner.start();

  let binaryPath: string;
  try {
    binaryPath = await ensureCLIProxyBinary(verbose);
    spinner.succeed('CLIProxy binary ready');
  } catch (error) {
    spinner.fail('Failed to prepare CLIProxy');
    throw error;
  }

  // 2. Handle special flags
  const forceAuth = args.includes('--auth');
  const forceHeadless = args.includes('--headless');
  const forceLogout = args.includes('--logout');
  const forceConfig = args.includes('--config');
  const addAccount = args.includes('--add');
  const showAccounts = args.includes('--accounts');

  // Parse --use <account> flag
  let useAccount: string | undefined;
  const useIdx = args.indexOf('--use');
  if (useIdx !== -1 && args[useIdx + 1] && !args[useIdx + 1].startsWith('-')) {
    useAccount = args[useIdx + 1];
  }

  // Parse --nickname <name> flag
  let setNickname: string | undefined;
  const nicknameIdx = args.indexOf('--nickname');
  if (nicknameIdx !== -1 && args[nicknameIdx + 1] && !args[nicknameIdx + 1].startsWith('-')) {
    setNickname = args[nicknameIdx + 1];
  }

  // Handle --accounts: list accounts and exit
  if (showAccounts) {
    const accounts = getProviderAccounts(provider);
    if (accounts.length === 0) {
      console.log(info(`No accounts registered for ${providerConfig.displayName}`));
      console.log(`    Run "ccs ${provider} --auth" to add an account`);
    } else {
      console.log(`\n${providerConfig.displayName} Accounts:\n`);
      for (const acct of accounts) {
        const defaultMark = acct.isDefault ? ' (default)' : '';
        const nickname = acct.nickname ? `[${acct.nickname}]` : '';
        console.log(`  ${nickname.padEnd(12)} ${acct.email || acct.id}${defaultMark}`);
      }
      console.log(`\n  Use "ccs ${provider} --use <nickname>" to switch accounts`);
    }
    process.exit(0);
  }

  // Handle --use: switch to specified account
  if (useAccount) {
    const account = findAccountByQuery(provider, useAccount);
    if (!account) {
      console.error(fail(`Account not found: "${useAccount}"`));
      const accounts = getProviderAccounts(provider);
      if (accounts.length > 0) {
        console.error(`    Available accounts:`);
        for (const acct of accounts) {
          console.error(`      - ${acct.nickname || acct.id} (${acct.email || 'no email'})`);
        }
      }
      process.exit(1);
    }
    // Set as default for this and future sessions
    setDefaultAccount(provider, account.id);
    touchAccount(provider, account.id);
    console.log(ok(`Switched to account: ${account.nickname || account.email || account.id}`));
  }

  // Handle --nickname: rename account and exit (unless used with --auth --add)
  if (setNickname && !addAccount) {
    const defaultAccount = getDefaultAccount(provider);
    if (!defaultAccount) {
      console.error(fail(`No account found for ${providerConfig.displayName}`));
      console.error(`    Run "ccs ${provider} --auth" to add an account first`);
      process.exit(1);
    }
    try {
      const success = renameAccount(provider, defaultAccount.id, setNickname);
      if (success) {
        console.log(ok(`Renamed account to: ${setNickname}`));
      } else {
        console.error(fail('Failed to rename account'));
        process.exit(1);
      }
    } catch (err) {
      console.error(fail(err instanceof Error ? err.message : 'Failed to rename account'));
      process.exit(1);
    }
    process.exit(0);
  }

  // Handle --config: configure model selection and exit
  // Pass customSettingsPath for CLIProxy variants to save to correct file
  if (forceConfig && supportsModelConfig(provider)) {
    await configureProviderModel(provider, true, cfg.customSettingsPath);
    process.exit(0);
  }

  // Handle --logout: clear auth and exit
  if (forceLogout) {
    const { clearAuth } = await import('./auth-handler');
    if (clearAuth(provider)) {
      console.log(ok(`Logged out from ${providerConfig.displayName}`));
    } else {
      console.log(info(`No authentication found for ${providerConfig.displayName}`));
    }
    process.exit(0);
  }

  // 3. Ensure OAuth completed (if provider requires it)
  if (providerConfig.requiresOAuth) {
    log(`Checking authentication for ${provider}`);

    if (forceAuth || !isAuthenticated(provider)) {
      // Pass headless only if explicitly set; otherwise let auth-handler auto-detect
      const { triggerOAuth } = await import('./auth-handler');
      const authSuccess = await triggerOAuth(provider, {
        verbose,
        add: addAccount,
        ...(forceHeadless ? { headless: true } : {}),
        ...(setNickname ? { nickname: setNickname } : {}),
      });
      if (!authSuccess) {
        throw new Error(`Authentication required for ${providerConfig.displayName}`);
      }
      // If --auth was explicitly passed, exit after auth (don't start Claude)
      if (forceAuth) {
        process.exit(0);
      }
    } else {
      log(`${provider} already authenticated`);
    }
  }

  // 4. First-run model configuration (interactive)
  // For supported providers, prompt user to select model on first run
  // Pass customSettingsPath for CLIProxy variants
  if (supportsModelConfig(provider)) {
    await configureProviderModel(provider, false, cfg.customSettingsPath); // false = only if not configured
  }

  // 5. Check for known broken models and warn user
  const currentModel = getCurrentModel(provider, cfg.customSettingsPath);
  if (currentModel && isModelBroken(provider, currentModel)) {
    const modelEntry = findModel(provider, currentModel);
    const issueUrl = getModelIssueUrl(provider, currentModel);
    console.error('');
    console.error(warn(`${modelEntry?.name || currentModel} has known issues with Claude Code`));
    console.error('    Tool calls will fail. Use "gemini-3-pro-preview" instead.');
    if (issueUrl) {
      console.error(`    Tracking: ${issueUrl}`);
    }
    console.error(`    Run "ccs ${provider} --config" to change model.`);
    console.error('');
  }

  // 6. Ensure user settings file exists (creates from defaults if not)
  ensureProviderSettings(provider);

  // 6. Generate config file
  log(`Generating config for ${provider}`);
  const configPath = generateConfig(provider, cfg.port);
  log(`Config written: ${configPath}`);

  // 6a. Pre-flight check: handle existing proxy or port conflicts
  // Clean up orphaned sessions first (from crashed proxies)
  cleanupOrphanedSessions(cfg.port);

  // Check if there's an existing healthy proxy we can reuse
  const existingProxy = getExistingProxy(cfg.port);
  let proxy: ChildProcess | null = null;
  let sessionId: string;

  if (existingProxy) {
    // Reuse existing proxy - another CCS session started it
    log(`Reusing existing CLIProxy on port ${cfg.port} (PID ${existingProxy.pid})`);
    sessionId = registerSession(cfg.port, existingProxy.pid);
    console.log(
      info(`Joined existing CLIProxy (${existingProxy.sessions.length + 1} sessions active)`)
    );
  } else {
    // No existing proxy - check if port is free
    const portProcess = await getPortProcess(cfg.port);
    if (portProcess) {
      if (isCLIProxyProcess(portProcess)) {
        // CLIProxy on port but no session lock - likely orphaned/zombie
        // Only kill if no active sessions registered
        if (!hasActiveSessions()) {
          log(`Found zombie CLIProxy on port ${cfg.port} (PID ${portProcess.pid}), killing...`);
          const killed = killProcessOnPort(cfg.port, verbose);
          if (killed) {
            console.log(info(`Cleaned up zombie CLIProxy process`));
            // Wait a bit for port to be released
            await new Promise((r) => setTimeout(r, 500));
          }
        } else {
          // Active sessions exist but getExistingProxy returned null - something's wrong
          // Try to connect anyway
          log(`CLIProxy on port ${cfg.port} has active sessions, attempting to join...`);
        }
      } else {
        // Non-CLIProxy process blocking the port - warn user
        console.error('');
        console.error(
          warn(`Port ${cfg.port} is blocked by ${portProcess.processName} (PID ${portProcess.pid})`)
        );
        console.error('');
        console.error('To fix this, close the blocking application or run:');
        console.error(`  ${getPortCheckCommand(cfg.port)}`);
        console.error('');
        throw new Error(`Port ${cfg.port} is in use by another application`);
      }
    }

    // 6b. Spawn CLIProxyAPI binary (only if not reusing existing proxy)
    // Use detached mode so proxy persists after terminal closes
    const proxyArgs = ['--config', configPath];

    log(`Spawning: ${binaryPath} ${proxyArgs.join(' ')}`);

    proxy = spawn(binaryPath, proxyArgs, {
      stdio: ['ignore', 'ignore', 'ignore'],
      detached: true, // Persist after parent terminal closes
      env: {
        ...process.env,
        WRITABLE_PATH: getCliproxyWritablePath(), // Logs stored in ~/.ccs/cliproxy/logs/
      },
    });

    // Unref so parent process can exit independently
    proxy.unref();

    // Handle proxy errors (only fires if spawn itself fails)
    proxy.on('error', (error) => {
      console.error(fail(`CLIProxy spawn error: ${error.message}`));
    });

    // 7. Wait for proxy readiness via TCP polling
    const readySpinner = new ProgressIndicator(`Waiting for CLIProxy on port ${cfg.port}`);
    readySpinner.start();

    try {
      await waitForProxyReady(cfg.port, cfg.timeout, cfg.pollInterval);
      readySpinner.succeed(`CLIProxy ready on port ${cfg.port}`);
    } catch (error) {
      readySpinner.fail('CLIProxy startup failed');
      proxy.kill('SIGTERM');

      const err = error as Error;
      console.error('');
      console.error(fail('CLIProxy failed to start'));
      console.error('');
      console.error('Possible causes:');
      console.error(`  1. Port ${cfg.port} already in use`);
      console.error('  2. Binary crashed on startup');
      console.error('  3. Invalid configuration');
      console.error('');
      console.error('Troubleshooting:');
      console.error(`  - Check port: ${getPortCheckCommand(cfg.port)}`);
      console.error('  - Run with --verbose for detailed logs');
      console.error(`  - View config: ${getCatCommand(configPath)}`);
      console.error('  - Try: ccs doctor --fix');
      console.error('');

      throw new Error(`CLIProxy startup failed: ${err.message}`);
    }

    // Register this session with the new proxy
    sessionId = registerSession(cfg.port, proxy.pid as number);
    log(`Registered session ${sessionId} with new proxy (PID ${proxy.pid})`);
  }

  // 7. Execute Claude CLI with proxied environment
  // Uses custom settings path (for variants), user settings, or bundled defaults
  const envVars = getEffectiveEnvVars(provider, cfg.port, cfg.customSettingsPath);
  const webSearchEnv = getWebSearchHookEnv();
  const env = {
    ...process.env,
    ...envVars,
    ...webSearchEnv,
    CCS_PROFILE_TYPE: 'cliproxy', // Signal to WebSearch hook this is a third-party provider
  };

  log(`Claude env: ANTHROPIC_BASE_URL=${envVars.ANTHROPIC_BASE_URL}`);
  log(`Claude env: ANTHROPIC_MODEL=${envVars.ANTHROPIC_MODEL}`);
  if (Object.keys(webSearchEnv).length > 0) {
    log(`Claude env: WebSearch config=${JSON.stringify(webSearchEnv)}`);
  }

  // Filter out CCS-specific flags before passing to Claude CLI
  const ccsFlags = [
    '--auth',
    '--headless',
    '--logout',
    '--config',
    '--add',
    '--accounts',
    '--use',
    '--nickname',
  ];
  const claudeArgs = args.filter((arg, idx) => {
    // Filter out CCS flags
    if (ccsFlags.includes(arg)) return false;
    // Filter out value after --use or --nickname
    if (args[idx - 1] === '--use' || args[idx - 1] === '--nickname') return false;
    return true;
  });

  const isWindows = process.platform === 'win32';
  const needsShell = isWindows && /\.(cmd|bat|ps1)$/i.test(claudeCli);

  let claude: ChildProcess;
  if (needsShell) {
    const cmdString = [claudeCli, ...claudeArgs].map(escapeShellArg).join(' ');
    claude = spawn(cmdString, {
      stdio: 'inherit',
      windowsHide: true,
      shell: true,
      env,
    });
  } else {
    claude = spawn(claudeCli, claudeArgs, {
      stdio: 'inherit',
      windowsHide: true,
      env,
    });
  }

  // 8. Cleanup: unregister session when Claude exits
  // Proxy persists by default - use 'ccs cliproxy stop' to kill manually
  claude.on('exit', (code, signal) => {
    log(`Claude exited: code=${code}, signal=${signal}`);

    // Unregister this session (proxy keeps running for persistence)
    unregisterSession(sessionId);
    log(`Session ${sessionId} unregistered, proxy persists for other sessions or future use`);

    if (signal) {
      process.kill(process.pid, signal as NodeJS.Signals);
    } else {
      process.exit(code || 0);
    }
  });

  claude.on('error', (error) => {
    console.error(fail(`Claude CLI error: ${error}`));

    // Unregister session, proxy keeps running
    unregisterSession(sessionId);
    process.exit(1);
  });

  // Handle parent process termination (SIGTERM, SIGINT)
  const cleanup = () => {
    log('Parent signal received, cleaning up');

    // Unregister session, proxy keeps running
    unregisterSession(sessionId);
    claude.kill('SIGTERM');
  };

  process.once('SIGTERM', cleanup);
  process.once('SIGINT', cleanup);
}

/**
 * Check if a port is available
 */
export async function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once('error', () => {
      resolve(false);
    });

    server.once('listening', () => {
      server.close();
      resolve(true);
    });

    server.listen(port, '127.0.0.1');
  });
}

/**
 * Find an available port in range
 */
export async function findAvailablePort(
  startPort: number = CLIPROXY_DEFAULT_PORT,
  range: number = 10
): Promise<number> {
  for (let port = startPort; port < startPort + range; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found in range ${startPort}-${startPort + range - 1}`);
}

export default execClaudeWithCLIProxy;
