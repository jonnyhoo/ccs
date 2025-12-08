/**
 * Config Command Handler
 *
 * Launches web-based configuration dashboard.
 * Usage: ccs config [--port PORT] [--dev]
 */

import getPort from 'get-port';
import open from 'open';
import { startServer } from '../web-server';
import { setupGracefulShutdown } from '../web-server/shutdown';
import { initUI, header, ok, info } from '../utils/ui';

interface ConfigOptions {
  port?: number;
  dev?: boolean;
}

/**
 * Parse command line arguments
 */
function parseArgs(args: string[]): ConfigOptions {
  const result: ConfigOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if ((arg === '--port' || arg === '-p') && args[i + 1]) {
      const port = parseInt(args[++i], 10);
      if (!isNaN(port) && port > 0 && port < 65536) {
        result.port = port;
      } else {
        console.error('[X] Invalid port number');
        process.exit(1);
      }
    } else if (arg === '--dev') {
      result.dev = true;
    } else if (arg === '--help' || arg === '-h') {
      showHelp();
      process.exit(0);
    }
  }

  return result;
}

/**
 * Show help message
 */
function showHelp(): void {
  console.log('');
  console.log('Usage: ccs config [options]');
  console.log('');
  console.log('Open web-based configuration dashboard');
  console.log('');
  console.log('Options:');
  console.log('  --port, -p PORT    Specify server port (default: auto-detect)');
  console.log('  --dev              Development mode with Vite HMR');
  console.log('  --help, -h         Show this help message');
  console.log('');
  console.log('Examples:');
  console.log('  ccs config              Auto-detect available port');
  console.log('  ccs config --port 3000  Use specific port');
  console.log('  ccs config --dev        Development mode with hot reload');
  console.log('');
}

/**
 * Handle config command
 */
export async function handleConfigCommand(args: string[]): Promise<void> {
  await initUI();

  const options = parseArgs(args);

  console.log(header('CCS Config Dashboard'));
  console.log('');
  console.log(info('Starting server...'));

  // Find available port
  const port =
    options.port ??
    (await getPort({
      port: [3000, 3001, 3002, 8000, 8080],
    }));

  try {
    // Start server
    const { server, wss } = await startServer({ port, dev: options.dev });

    // Setup graceful shutdown
    setupGracefulShutdown(server, wss);

    const url = `http://localhost:${port}`;

    if (options.dev) {
      console.log(ok(`Dev Server: ${url}`));
      console.log('');
      console.log(info('HMR enabled - UI changes will hot-reload'));
    } else {
      console.log(ok(`Dashboard: ${url}`));
    }
    console.log('');

    // Open browser
    try {
      await open(url, { wait: false });
      console.log(info('Browser opened automatically'));
    } catch {
      console.log(info(`Open manually: ${url}`));
    }

    console.log('');
    console.log(info('Press Ctrl+C to stop'));
  } catch (error) {
    console.error('[X] Failed to start server:', (error as Error).message);
    process.exit(1);
  }
}
