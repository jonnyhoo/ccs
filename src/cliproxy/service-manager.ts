/**
 * CLIProxy Service Manager
 *
 * Manages CLIProxyAPI as a background service for the CCS dashboard.
 * Ensures the proxy is running when needed for:
 * - Control Panel integration (management.html)
 * - Stats fetching
 * - OAuth flows
 *
 * Unlike cliproxy-executor.ts which runs proxy per-session,
 * this module manages a persistent background instance.
 */

import { spawn, ChildProcess } from 'child_process';
import * as net from 'net';
import { ensureCLIProxyBinary } from './binary-manager';
import {
  generateConfig,
  regenerateConfig,
  configNeedsRegeneration,
  CLIPROXY_DEFAULT_PORT,
  getCliproxyWritablePath,
} from './config-generator';
import { isCliproxyRunning } from './stats-fetcher';

/** Background proxy process reference */
let proxyProcess: ChildProcess | null = null;

/** Cleanup registered flag */
let cleanupRegistered = false;

/**
 * Wait for TCP port to become available
 */
async function waitForPort(
  port: number,
  timeout: number = 5000,
  pollInterval: number = 100
): Promise<boolean> {
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

        socket.setTimeout(500, () => {
          socket.destroy();
          reject(new Error('Connection timeout'));
        });
      });

      return true; // Connection successful
    } catch {
      await new Promise((r) => setTimeout(r, pollInterval));
    }
  }

  return false;
}

/**
 * Register cleanup handlers to stop proxy on process exit
 */
function registerCleanup(): void {
  if (cleanupRegistered) return;

  const cleanup = () => {
    if (proxyProcess && !proxyProcess.killed) {
      proxyProcess.kill('SIGTERM');
      proxyProcess = null;
    }
  };

  process.once('exit', cleanup);
  process.once('SIGTERM', cleanup);
  process.once('SIGINT', cleanup);

  cleanupRegistered = true;
}

export interface ServiceStartResult {
  started: boolean;
  alreadyRunning: boolean;
  port: number;
  configRegenerated?: boolean;
  error?: string;
}

/**
 * Ensure CLIProxy service is running
 *
 * If proxy is already running, returns immediately.
 * If not, spawns a new background instance.
 *
 * @param port CLIProxy port (default: 8317)
 * @param verbose Show debug output
 * @returns Result indicating success and whether it was already running
 */
export async function ensureCliproxyService(
  port: number = CLIPROXY_DEFAULT_PORT,
  verbose: boolean = false
): Promise<ServiceStartResult> {
  const log = (msg: string) => {
    if (verbose) {
      console.error(`[cliproxy-service] ${msg}`);
    }
  };

  // Check if already running (from another process or previous start)
  log(`Checking if CLIProxy is running on port ${port}...`);
  const running = await isCliproxyRunning(port);

  // Check if config needs update (even if running)
  let configRegenerated = false;
  if (configNeedsRegeneration()) {
    log('Config outdated, regenerating...');
    regenerateConfig(port);
    configRegenerated = true;
  }

  if (running) {
    log('CLIProxy already running');
    if (configRegenerated) {
      log('Config was updated - running instance will use new config on next restart');
    }
    return { started: true, alreadyRunning: true, port, configRegenerated };
  }

  // Need to start new instance
  log('CLIProxy not running, starting background instance...');

  // 1. Ensure binary exists
  let binaryPath: string;
  try {
    binaryPath = await ensureCLIProxyBinary(verbose);
    log(`Binary ready: ${binaryPath}`);
  } catch (error) {
    const err = error as Error;
    return {
      started: false,
      alreadyRunning: false,
      port,
      error: `Failed to prepare binary: ${err.message}`,
    };
  }

  // 2. Ensure/regenerate config if needed
  let configPath: string;
  if (configNeedsRegeneration()) {
    log('Config needs regeneration, updating...');
    configPath = regenerateConfig(port);
  } else {
    // generateConfig only creates if doesn't exist
    configPath = generateConfig('gemini', port); // Provider doesn't matter for unified config
  }
  log(`Config ready: ${configPath}`);

  // 3. Spawn background process
  const proxyArgs = ['--config', configPath];

  log(`Spawning: ${binaryPath} ${proxyArgs.join(' ')}`);

  proxyProcess = spawn(binaryPath, proxyArgs, {
    stdio: ['ignore', verbose ? 'pipe' : 'ignore', verbose ? 'pipe' : 'ignore'],
    detached: true, // Allow process to run independently
    env: {
      ...process.env,
      WRITABLE_PATH: getCliproxyWritablePath(), // Logs stored in ~/.ccs/cliproxy/logs/
    },
  });

  // Forward output in verbose mode
  if (verbose) {
    proxyProcess.stdout?.on('data', (data: Buffer) => {
      process.stderr.write(`[cliproxy] ${data.toString()}`);
    });
    proxyProcess.stderr?.on('data', (data: Buffer) => {
      process.stderr.write(`[cliproxy-err] ${data.toString()}`);
    });
  }

  // Don't let this process prevent parent from exiting
  proxyProcess.unref();

  // Handle spawn errors
  proxyProcess.on('error', (error) => {
    log(`Spawn error: ${error.message}`);
  });

  // Register cleanup handlers
  registerCleanup();

  // 4. Wait for proxy to be ready
  log(`Waiting for CLIProxy on port ${port}...`);
  const ready = await waitForPort(port, 5000);

  if (!ready) {
    // Kill failed process
    if (proxyProcess && !proxyProcess.killed) {
      proxyProcess.kill('SIGTERM');
      proxyProcess = null;
    }

    return {
      started: false,
      alreadyRunning: false,
      port,
      error: `CLIProxy failed to start within 5s on port ${port}`,
    };
  }

  log(`CLIProxy service started on port ${port}`);
  return { started: true, alreadyRunning: false, port };
}

/**
 * Stop the managed CLIProxy service
 */
export function stopCliproxyService(): boolean {
  if (proxyProcess && !proxyProcess.killed) {
    proxyProcess.kill('SIGTERM');
    proxyProcess = null;
    return true;
  }
  return false;
}

/**
 * Get service status
 */
export async function getServiceStatus(port: number = CLIPROXY_DEFAULT_PORT): Promise<{
  running: boolean;
  managedByUs: boolean;
  port: number;
}> {
  const running = await isCliproxyRunning(port);
  const managedByUs = proxyProcess !== null && !proxyProcess.killed;

  return { running, managedByUs, port };
}
