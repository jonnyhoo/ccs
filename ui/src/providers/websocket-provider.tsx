/**
 * WebSocket Provider (Phase 04)
 *
 * React context provider for WebSocket connection.
 */

import type { ReactNode } from 'react';
import { useWebSocket } from '@/hooks/use-websocket';
import { WSContext } from '@/contexts/ws-context';

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const ws = useWebSocket();

  return <WSContext.Provider value={ws}>{children}</WSContext.Provider>;
}
