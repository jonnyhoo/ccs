/**
 * WebSocket Handler (Phase 04)
 *
 * Manages WebSocket connections, broadcasts file changes, and handles client messages.
 */

import { WebSocketServer, WebSocket } from 'ws';
import { createFileWatcher, FileChangeEvent } from './file-watcher';

export interface WSMessage {
  type: string;
  [key: string]: unknown;
}

export function setupWebSocket(wss: WebSocketServer): { cleanup: () => void } {
  // Track connected clients
  const clients = new Set<WebSocket>();

  // Broadcast message to all clients
  function broadcast(message: WSMessage): void {
    const data = JSON.stringify(message);
    clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  }

  // Handle new connections
  wss.on('connection', (ws) => {
    clients.add(ws);
    console.log(`[WS] Client connected (${clients.size} total)`);

    // Send welcome message
    ws.send(JSON.stringify({ type: 'connected', timestamp: Date.now() }));

    // Handle client messages
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        handleClientMessage(ws, message);
      } catch {
        console.log('[WS] Invalid message format');
      }
    });

    // Handle disconnect
    ws.on('close', () => {
      clients.delete(ws);
      console.log(`[WS] Client disconnected (${clients.size} remaining)`);
    });

    ws.on('error', (err) => {
      console.log(`[WS] Error: ${err.message}`);
      clients.delete(ws);
    });
  });

  // Handle incoming client messages
  function handleClientMessage(ws: WebSocket, message: WSMessage): void {
    switch (message.type) {
      case 'ping':
        ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        break;
      case 'subscribe':
        // Future: selective subscriptions
        break;
      default:
        console.log(`[WS] Unknown message type: ${message.type}`);
    }
  }

  // Setup file watcher
  const watcher = createFileWatcher((event: FileChangeEvent) => {
    console.log(`[FS] ${event.type}: ${event.path}`);
    broadcast({
      type: event.type,
      path: event.path,
      timestamp: event.timestamp,
    });
  });

  // Cleanup function
  const cleanup = (): void => {
    watcher.close();
    clients.forEach((client) => {
      client.close(1001, 'Server shutting down');
    });
    clients.clear();
  };

  return { cleanup };
}
