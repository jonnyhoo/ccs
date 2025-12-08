/**
 * Connection Indicator (Phase 04)
 *
 * Shows WebSocket connection status in the header.
 */

import { Wifi, WifiOff } from 'lucide-react';
import { useWebSocket } from '@/hooks/use-websocket';

export function ConnectionIndicator() {
  const { status } = useWebSocket();

  const statusConfig = {
    connected: { icon: Wifi, color: 'text-green-500', label: 'Connected' },
    connecting: { icon: Wifi, color: 'text-yellow-500', label: 'Connecting...' },
    disconnected: { icon: WifiOff, color: 'text-red-500', label: 'Disconnected' },
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div className={`flex items-center gap-1 text-sm ${config.color}`}>
      <Icon className="w-4 h-4" />
      <span className="hidden sm:inline">{config.label}</span>
    </div>
  );
}
