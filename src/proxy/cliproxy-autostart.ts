/**
 * CLIProxy Auto-Start
 *
 * Lightweight module to detect and auto-start CLIProxy instances.
 * When a profile's ANTHROPIC_BASE_URL points to 127.0.0.1:<port>,
 * ensures the CLIProxy binary is running on that port.
 */

import { spawn } from 'child_process';
import * as http from 'http';
import * as net from 'net';
import * as path from 'path';
import * as fs from 'fs';
import { getCcsDir } from '../utils/config-manager';
import { info, fail } from '../utils/ui';

const CLIPROXY_DEFAULT_PORT = 8317;
const STARTUP_TIMEOUT = 8000;
const POLL_INTERVAL = 150;

/**
 * Extract localhost port from a URL like http://127.0.0.1:8317/...
 * Returns null if not a localhost URL.
 */
export function extractLocalhostPort(url: string): number | null {
  const match = url.match(/^https?:\/\/127\.0\.0\.1:(\d+)/);
  if (!match) return null;
  return parseInt(match[1], 10);
}

/**
 * Check if a port is accepting connections.
 */
async function isPortListening(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host: '127.0.0.1' }, () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('error', () => {
      socket.destroy();
      resolve(false);
    });
    socket.setTimeout(1000, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

/**
 * Wait for a port to become ready via TCP polling.
 */
async function waitForPortReady(port: number, timeout: number = STARTUP_TIMEOUT): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await isPortListening(port)) return;
    await new Promise((r) => setTimeout(r, POLL_INTERVAL));
  }
  throw new Error(`CLIProxy on port ${port} did not become ready within ${timeout}ms`);
}

/**
 * Resolve the cliproxy binary path.
 */
function getCliproxyBinary(): string | null {
  const ccsDir = getCcsDir();
  const plusPath = path.join(ccsDir, 'cliproxy', 'bin', 'plus', 'cli-proxy-api-plus.exe');
  if (fs.existsSync(plusPath)) return plusPath;

  // Fallback: non-plus binary
  const defaultPath = path.join(ccsDir, 'cliproxy', 'bin', 'cli-proxy-api.exe');
  if (fs.existsSync(defaultPath)) return defaultPath;

  // Unix variants
  const plusUnix = path.join(ccsDir, 'cliproxy', 'bin', 'plus', 'cli-proxy-api-plus');
  if (fs.existsSync(plusUnix)) return plusUnix;

  const defaultUnix = path.join(ccsDir, 'cliproxy', 'bin', 'cli-proxy-api');
  if (fs.existsSync(defaultUnix)) return defaultUnix;

  return null;
}

/**
 * Resolve the cliproxy config file for a given port.
 */
function getConfigForPort(port: number): string | null {
  const ccsDir = getCcsDir();

  // Default port uses config.yaml
  if (port === CLIPROXY_DEFAULT_PORT) {
    const configPath = path.join(ccsDir, 'cliproxy', 'config.yaml');
    return fs.existsSync(configPath) ? configPath : null;
  }

  // Variant ports use config-{port}.yaml
  const variantPath = path.join(ccsDir, 'cliproxy', `config-${port}.yaml`);
  return fs.existsSync(variantPath) ? variantPath : null;
}

/**
 * Spawn the CLIProxy binary with the given config.
 * The process is detached and unref'd so it survives ccs exit.
 */
function spawnCliproxy(binaryPath: string, configPath: string): void {
  const proxy = spawn(binaryPath, ['--config', configPath], {
    stdio: ['ignore', 'ignore', 'ignore'],
    detached: true,
    env: {
      ...process.env,
      WRITABLE_PATH: path.join(getCcsDir(), 'cliproxy'),
    },
  });
  proxy.unref();
}

/**
 * 验证端口上运行的是否为可信的 CLIProxy 实例（通过 /health 端点）
 */
async function isCliproxyTrusted(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}/health`, { timeout: 2000 }, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const body = JSON.parse(data);
          resolve(res.statusCode === 200 && body?.service === 'cliproxy');
        } catch {
          resolve(false);
        }
      });
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

/**
 * Ensure CLIProxy is running on the given port.
 * If already running and trusted, returns immediately.
 * If not, spawns the binary and waits for readiness.
 *
 * @param port The port to ensure CLIProxy is running on
 * @param verbose Enable verbose logging
 */
export async function ensureCliproxy(port: number, verbose: boolean = false): Promise<void> {
  // 端口有监听时，验证是否为可信的 CLIProxy
  if (await isPortListening(port)) {
    if (await isCliproxyTrusted(port)) {
      if (verbose) console.error(info(`CLIProxy already running on port ${port}`));
      return;
    }
    // 端口被占用但不是 CLIProxy，警告并继续尝试启动
    console.error(fail(`Port ${port} is in use by an untrusted process, cannot start CLIProxy`));
    throw new Error(`Port ${port} occupied by untrusted process`);
  }

  // Find binary
  const binaryPath = getCliproxyBinary();
  if (!binaryPath) {
    console.error(fail('CLIProxy binary not found. Please reinstall CCS.'));
    throw new Error('CLIProxy binary not found');
  }

  // Find config
  const configPath = getConfigForPort(port);
  if (!configPath) {
    console.error(fail(`No CLIProxy config found for port ${port}`));
    throw new Error(`No CLIProxy config for port ${port}`);
  }

  if (verbose) {
    console.error(info(`Starting CLIProxy on port ${port}...`));
    console.error(info(`Binary: ${binaryPath}`));
    console.error(info(`Config: ${configPath}`));
  }

  // Spawn
  spawnCliproxy(binaryPath, configPath);

  // Wait for readiness
  const { ProgressIndicator } = await import('../utils/progress-indicator');
  const spinner = new ProgressIndicator(`Starting CLIProxy on port ${port}`);
  spinner.start();

  try {
    await waitForPortReady(port);
    spinner.succeed(`CLIProxy ready on port ${port}`);
  } catch (error) {
    spinner.fail(`CLIProxy failed to start on port ${port}`);
    throw error;
  }
}

/**
 * If the given env vars contain a localhost ANTHROPIC_BASE_URL,
 * ensure CLIProxy is running on that port.
 * No-op if the URL is not localhost.
 */
export async function ensureCliproxyIfNeeded(
  env: Record<string, string>,
  verbose: boolean = false
): Promise<void> {
  const baseUrl = env['ANTHROPIC_BASE_URL'];
  if (!baseUrl) return;

  const port = extractLocalhostPort(baseUrl);
  if (!port) return;

  await ensureCliproxy(port, verbose);
}
