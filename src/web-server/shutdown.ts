/**
 * Graceful Shutdown Handler
 *
 * Handles SIGINT/SIGTERM signals to gracefully close WebSocket connections
 * and HTTP server before process exit.
 */

import { Server as HTTPServer } from 'http';
import { WebSocketServer } from 'ws';

const SHUTDOWN_TIMEOUT = 10_000; // 10 seconds

/**
 * Setup graceful shutdown handlers for SIGINT and SIGTERM
 */
export function setupGracefulShutdown(
  server: HTTPServer,
  _wss: WebSocketServer,
  cleanup?: () => void
): void {
  const shutdown = () => {
    console.log('\n[i] Shutting down gracefully...');

    // Run cleanup first (closes file watchers + WebSocket clients)
    if (cleanup) {
      cleanup();
    }

    // Close HTTP server
    server.close(() => {
      console.log('[OK] Server closed');
      process.exit(0);
    });

    // Force shutdown if graceful shutdown takes too long
    setTimeout(() => {
      console.log('[!] Force shutdown (timeout exceeded)');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
