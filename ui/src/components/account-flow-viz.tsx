/**
 * Account Flow Visualization
 * Custom SVG bezier curve visualization showing request flow from accounts to providers
 * Inspired by modern dark theme design with glass panels and glow effects
 */

import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { ProviderIcon } from '@/components/provider-icon';
import { PROVIDER_COLORS } from '@/lib/provider-config';
import { STATUS_COLORS } from '@/lib/utils';
import { usePrivacy, PRIVACY_BLUR_CLASS } from '@/contexts/privacy-context';
import {
  ChevronRight,
  X,
  CheckCircle2,
  XCircle,
  Clock,
  Activity,
  GripVertical,
} from 'lucide-react';

/** Position offset for draggable cards */
interface DragOffset {
  x: number;
  y: number;
}

interface AccountData {
  id: string;
  email: string;
  provider: string;
  successCount: number;
  failureCount: number;
  lastUsedAt?: string;
  color: string;
}

interface ProviderData {
  provider: string;
  displayName: string;
  totalRequests: number;
  accounts: AccountData[];
}

interface AccountFlowVizProps {
  providerData: ProviderData;
  onBack?: () => void;
}

interface ConnectionEvent {
  id: string;
  timestamp: Date;
  accountEmail: string;
  status: 'success' | 'failed' | 'pending';
  latencyMs?: number;
}

/** Generate connection events from real account data */
function generateConnectionEvents(accounts: AccountData[]): ConnectionEvent[] {
  const events: ConnectionEvent[] = [];

  accounts.forEach((account) => {
    // Only show events for accounts that have actual request data
    const hasActivity = account.successCount > 0 || account.failureCount > 0;
    if (!hasActivity) return;

    // Create a single consolidated event per account showing its current status
    const lastUsed = account.lastUsedAt ? new Date(account.lastUsedAt) : new Date();
    const hasFailures = account.failureCount > 0;

    events.push({
      id: `${account.id}-status`,
      timestamp: lastUsed,
      accountEmail: account.email,
      status: hasFailures && account.failureCount > account.successCount ? 'failed' : 'success',
    });
  });

  // Sort by timestamp descending (most recent first)
  return events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}

/** Format timestamp for timeline display */
function formatTimelineTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'now';
  if (diffMins < 60) return `${diffMins}m`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h`;
  return `${Math.floor(diffHours / 24)}d`;
}

/** Connection Timeline Component - right sidebar panel */
function ConnectionTimeline({
  events,
  privacyMode,
}: {
  events: ConnectionEvent[];
  privacyMode: boolean;
}) {
  if (events.length === 0) {
    return (
      <div className="h-full flex items-center justify-center rounded-xl bg-muted/20 dark:bg-zinc-900/40 border border-border/30 dark:border-white/[0.05]">
        <div className="text-xs text-muted-foreground font-mono">No recent connections</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3 px-2">
        <Activity className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
          Connection Timeline
        </span>
      </div>

      {/* Timeline container */}
      <div
        className={cn(
          'flex-1 rounded-xl p-4 overflow-y-auto',
          'bg-muted/20 dark:bg-zinc-900/40 backdrop-blur-sm',
          'border border-border/30 dark:border-white/[0.05]'
        )}
      >
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border/50 dark:bg-white/[0.08]" />

          {/* Events */}
          <div className="space-y-3">
            {events.slice(0, 8).map((event) => {
              const statusColor =
                event.status === 'success'
                  ? STATUS_COLORS.success
                  : event.status === 'failed'
                    ? STATUS_COLORS.failed
                    : STATUS_COLORS.degraded;

              return (
                <div key={event.id} className="relative flex items-start gap-3 pl-1">
                  {/* Timeline dot */}
                  <div
                    className={cn(
                      'relative z-10 w-3.5 h-3.5 rounded-full flex-shrink-0 mt-0.5',
                      'ring-2 ring-background dark:ring-zinc-950'
                    )}
                    style={{ backgroundColor: statusColor }}
                  />

                  {/* Event content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={cn(
                          'text-[10px] font-mono text-foreground truncate',
                          privacyMode && PRIVACY_BLUR_CLASS
                        )}
                      >
                        {cleanEmail(event.accountEmail)}
                      </span>
                      <span className="text-[9px] text-muted-foreground font-mono flex-shrink-0">
                        {formatTimelineTime(event.timestamp)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span
                        className="text-[9px] font-medium uppercase"
                        style={{ color: statusColor }}
                      >
                        {event.status}
                      </span>
                      {event.latencyMs && (
                        <span className="text-[9px] text-muted-foreground font-mono">
                          {event.latencyMs}ms
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Show more indicator */}
          {events.length > 8 && (
            <div className="mt-3 pt-2 border-t border-border/30 dark:border-white/[0.05]">
              <span className="text-[9px] text-muted-foreground font-mono">
                +{events.length - 8} more events
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Strip common email domains for cleaner display */
function cleanEmail(email: string): string {
  return email.replace(/@(gmail|yahoo|hotmail|outlook|icloud)\.com$/i, '');
}

function getTimeAgo(dateStr?: string): string {
  if (!dateStr) return 'never';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return 'unknown';
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  if (diffMs < 0) return 'just now';
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export function AccountFlowViz({ providerData, onBack }: AccountFlowVizProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredAccount, setHoveredAccount] = useState<number | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<AccountData | null>(null);
  const [paths, setPaths] = useState<string[]>([]);

  // Privacy mode for demo purposes
  const { privacyMode } = usePrivacy();

  // Drag state for all cards (account IDs + 'provider')
  const [dragOffsets, setDragOffsets] = useState<Record<string, DragOffset>>({});
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragStartRef = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(
    null
  );

  // Pulse state: account IDs that are currently pulsing
  const [pulsingAccounts, setPulsingAccounts] = useState<Set<string>>(new Set());
  // Store previous counts to detect changes
  const [prevCounts, setPrevCounts] = useState<Record<string, number>>({});

  const { accounts } = providerData;
  const maxRequests = Math.max(...accounts.map((a) => a.successCount + a.failureCount), 1);
  const totalRequests = accounts.reduce((acc, a) => acc + a.successCount + a.failureCount, 0);

  // Detect new activity and trigger pulse (runs when accounts data changes)
  useEffect(() => {
    const newPulsing = new Set<string>();
    const newCounts: Record<string, number> = {};

    accounts.forEach((account) => {
      const currentCount = account.successCount + account.failureCount;
      newCounts[account.id] = currentCount;
      const prev = prevCounts[account.id] ?? 0;

      if (currentCount > prev && prev > 0) {
        newPulsing.add(account.id);
      }
    });

    setPrevCounts(newCounts);

    if (newPulsing.size > 0) {
      setPulsingAccounts(newPulsing);
      // Clear pulse after animation completes (match CSS animation duration)
      const timer = setTimeout(() => setPulsingAccounts(new Set()), 2000);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts]);

  // Generate connection events for timeline
  const connectionEvents = useMemo(() => generateConnectionEvents(accounts), [accounts]);

  // Calculate SVG paths for bezier curves
  const calculatePaths = useCallback(() => {
    if (!containerRef.current || !svgRef.current) return;

    const container = containerRef.current;
    const svg = svgRef.current;
    const svgRect = svg.getBoundingClientRect();

    const destEl = container.querySelector('[data-provider-node]');
    if (!destEl) return;
    const destRect = destEl.getBoundingClientRect();

    const newPaths: string[] = [];

    accounts.forEach((_, i) => {
      const sourceEl = container.querySelector(`[data-account-index="${i}"]`);
      if (!sourceEl) return;
      const sourceRect = sourceEl.getBoundingClientRect();

      // Determine if this account is on the right side
      const isRightSide = sourceEl.hasAttribute('data-right-side');

      let startX: number, startY: number, destX: number, destY: number;

      if (isRightSide) {
        // Right side account: connect from left edge to right edge of provider
        startX = sourceRect.left - svgRect.left;
        startY = sourceRect.top + sourceRect.height / 2 - svgRect.top;
        destX = destRect.right - svgRect.left;
        destY = destRect.top + destRect.height / 2 - svgRect.top;
      } else {
        // Left side account: connect from right edge to left edge of provider
        startX = sourceRect.right - svgRect.left;
        startY = sourceRect.top + sourceRect.height / 2 - svgRect.top;
        destX = destRect.left - svgRect.left;
        destY = destRect.top + destRect.height / 2 - svgRect.top;
      }

      // Bezier control points
      const cp1X = startX + (destX - startX) * 0.5;
      const cp1Y = startY;
      const cp2X = destX - (destX - startX) * 0.5;
      const cp2Y = destY;

      newPaths.push(`M ${startX} ${startY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${destX} ${destY}`);
    });

    setPaths(newPaths);
  }, [accounts]);

  useEffect(() => {
    // Initial calculation after render
    const timer = setTimeout(calculatePaths, 50);
    window.addEventListener('resize', calculatePaths);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', calculatePaths);
    };
  }, [calculatePaths]);

  const providerColor = PROVIDER_COLORS[providerData.provider.toLowerCase()] || '#6b7280';

  // Split accounts into left and right groups (when > 1 account, balance both sides)
  const { leftAccounts, rightAccounts } = useMemo(() => {
    if (accounts.length <= 1) {
      return { leftAccounts: accounts, rightAccounts: [] };
    }
    const mid = Math.ceil(accounts.length / 2);
    return {
      leftAccounts: accounts.slice(0, mid),
      rightAccounts: accounts.slice(mid),
    };
  }, [accounts]);

  const hasRightAccounts = rightAccounts.length > 0;

  // Drag handlers
  const handlePointerDown = useCallback(
    (id: string, e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      const offset = dragOffsets[id] || { x: 0, y: 0 };
      dragStartRef.current = { x: e.clientX, y: e.clientY, offsetX: offset.x, offsetY: offset.y };
      setDraggingId(id);
    },
    [dragOffsets]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!draggingId || !dragStartRef.current) return;
      const start = dragStartRef.current;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      setDragOffsets((prev) => ({
        ...prev,
        [draggingId]: {
          x: start.offsetX + dx,
          y: start.offsetY + dy,
        },
      }));
      // Recalculate paths during drag
      requestAnimationFrame(calculatePaths);
    },
    [draggingId, calculatePaths]
  );

  const handlePointerUp = useCallback(() => {
    setDraggingId(null);
    dragStartRef.current = null;
  }, []);

  // Get offset for a card
  const getOffset = (id: string): DragOffset => dragOffsets[id] || { x: 0, y: 0 };

  return (
    <div className="flex flex-col" ref={containerRef}>
      {/* Back button */}
      {onBack && (
        <button
          onClick={onBack}
          className="self-start flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronRight className="w-3 h-3 rotate-180" />
          <span>Back to providers</span>
        </button>
      )}

      {/* Main visualization area - 3 column layout: Left Accounts | Provider | Right Accounts + Timeline */}
      <div className="min-h-[320px] flex gap-4 px-4 py-6">
        {/* Flow visualization section */}
        <div className="relative flex-1 flex items-center justify-between px-4">
          {/* SVG Canvas (Background) */}
          <svg
            ref={svgRef}
            className="absolute inset-0 w-full h-full pointer-events-none z-0 overflow-visible"
          >
            <defs>
              <filter id="flow-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>
            {paths.map((d, i) => {
              const account = accounts[i];
              const total = account.successCount + account.failureCount;
              const strokeWidth = Math.max(2, (total / maxRequests) * 10);
              const isHovered = hoveredAccount === i;
              const isDimmed = hoveredAccount !== null && hoveredAccount !== i;
              const isPulsing = pulsingAccounts.has(account.id);

              return (
                <g key={i}>
                  {/* Base path - static connection line */}
                  <path
                    d={d}
                    fill="none"
                    stroke={account.color}
                    strokeWidth={strokeWidth}
                    strokeOpacity={isHovered ? 0.9 : isDimmed ? 0.05 : 0.2}
                    strokeLinecap="round"
                    filter={isHovered ? 'url(#flow-glow)' : undefined}
                    className="transition-all duration-300"
                  />
                  {/* Pulse layer - only shows when new activity detected */}
                  {isPulsing && (
                    <>
                      {/* Glowing path pulse */}
                      <path
                        d={d}
                        fill="none"
                        stroke={account.color}
                        strokeWidth={strokeWidth * 2}
                        strokeLinecap="round"
                        filter="url(#flow-glow)"
                        className="animate-request-pulse"
                      />
                      {/* Traveling dot along path */}
                      <circle
                        r={6}
                        fill={account.color}
                        filter="url(#flow-glow)"
                        style={{
                          offsetPath: `path('${d}')`,
                          offsetDistance: '0%',
                          animation: 'travel-dot 1.5s cubic-bezier(0.4, 0, 0.2, 1) forwards',
                        }}
                      />
                    </>
                  )}
                </g>
              );
            })}
          </svg>

          {/* Left Accounts */}
          <div className="flex flex-col gap-3 z-10 w-48 justify-center flex-shrink-0">
            {leftAccounts.map((account) => {
              const originalIndex = accounts.findIndex((a) => a.id === account.id);
              const total = account.successCount + account.failureCount;
              const isHovered = hoveredAccount === originalIndex;
              const isDragging = draggingId === account.id;
              const offset = getOffset(account.id);

              return (
                <div
                  key={account.id}
                  data-account-index={originalIndex}
                  onClick={() => !isDragging && setSelectedAccount(account)}
                  onMouseEnter={() => setHoveredAccount(originalIndex)}
                  onMouseLeave={() => setHoveredAccount(null)}
                  onPointerDown={(e) => handlePointerDown(account.id, e)}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerUp}
                  className={cn(
                    'group/card relative rounded-lg p-3 pr-6 cursor-grab transition-shadow duration-200',
                    'bg-muted/30 dark:bg-zinc-900/60 backdrop-blur-sm',
                    'border border-border/50 dark:border-white/[0.08]',
                    'border-l-2 select-none touch-none',
                    isHovered && 'bg-muted/50 dark:bg-zinc-800/60',
                    isDragging && 'cursor-grabbing shadow-xl scale-105 z-50'
                  )}
                  style={{
                    borderLeftColor: account.color,
                    transform: `translate(${offset.x}px, ${offset.y}px)${isDragging ? ' scale(1.05)' : ''}`,
                  }}
                >
                  {/* Drag handle indicator */}
                  <GripVertical className="absolute top-1/2 left-1 -translate-y-1/2 w-3 h-3 text-muted-foreground/40" />
                  <div className="flex justify-between items-start mb-1 ml-3">
                    <span
                      className={cn(
                        'text-xs font-semibold text-foreground tracking-tight truncate max-w-[100px]',
                        privacyMode && PRIVACY_BLUR_CLASS
                      )}
                    >
                      {cleanEmail(account.email)}
                    </span>
                    <ChevronRight
                      className={cn(
                        'w-3.5 h-3.5 text-muted-foreground transition-opacity',
                        isHovered ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {total.toLocaleString()} reqs
                    </span>
                    <div className="flex gap-1">
                      {account.failureCount > 0 && (
                        <div className="w-1.5 h-1.5 rounded-full bg-red-500/80" />
                      )}
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/80" />
                    </div>
                  </div>
                  {/* Connector Dot - Right side */}
                  <div
                    className={cn(
                      'absolute top-1/2 -right-1.5 w-3 h-3 rounded-full transform -translate-y-1/2 z-20 transition-colors border',
                      'bg-muted dark:bg-zinc-800 border-border dark:border-zinc-600',
                      isHovered && 'bg-foreground dark:bg-white border-transparent'
                    )}
                  />
                </div>
              );
            })}
          </div>

          {/* Center Provider */}
          <div className="z-10 w-52 flex items-center flex-shrink-0">
            {(() => {
              const isDragging = draggingId === 'provider';
              const offset = getOffset('provider');
              return (
                <div
                  data-provider-node
                  onPointerDown={(e) => handlePointerDown('provider', e)}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerUp}
                  className={cn(
                    'group relative w-full rounded-xl p-4 cursor-grab transition-shadow duration-200',
                    'bg-muted/30 dark:bg-zinc-900/60 backdrop-blur-sm',
                    'border-2 border-border/50 dark:border-white/[0.08]',
                    // Idle animations: float + border glow (disabled when dragging)
                    !isDragging && 'animate-subtle-float animate-border-glow',
                    'select-none touch-none',
                    hoveredAccount !== null && 'scale-[1.02]',
                    isDragging && 'cursor-grabbing shadow-2xl scale-105 z-50'
                  )}
                  style={
                    {
                      '--glow-color': `${providerColor}60`,
                      borderColor: hoveredAccount !== null ? `${providerColor}80` : undefined,
                      transform: `translate(${offset.x}px, ${offset.y}px)${isDragging ? ' scale(1.05)' : ''}`,
                    } as React.CSSProperties
                  }
                >
                  {/* Drag handle */}
                  <GripVertical className="absolute top-2 right-2 w-4 h-4 text-muted-foreground/40" />

                  {/* Animated glow background */}
                  <div
                    className="absolute inset-0 rounded-xl animate-glow-pulse pointer-events-none"
                    style={{ '--glow-color': `${providerColor}30` } as React.CSSProperties}
                  />

                  {/* Left Connector Point */}
                  <div
                    className="absolute top-1/2 -left-1.5 w-3 h-3 rounded-full transform -translate-y-1/2"
                    style={{
                      backgroundColor: providerColor,
                      boxShadow: `0 0 0 4px var(--background)`,
                    }}
                  />

                  {/* Right Connector Point - only show if there are right accounts */}
                  {hasRightAccounts && (
                    <div
                      className="absolute top-1/2 -right-1.5 w-3 h-3 rounded-full transform -translate-y-1/2"
                      style={{
                        backgroundColor: providerColor,
                        boxShadow: `0 0 0 4px var(--background)`,
                      }}
                    />
                  )}

                  <div className="flex items-center gap-3 mb-4 relative z-10">
                    {/* Provider icon with breathing animation */}
                    <div className="animate-icon-breathe">
                      <ProviderIcon provider={providerData.provider} size={36} withBackground />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-foreground tracking-tight">
                        {providerData.displayName}
                      </h3>
                      <p className="text-[10px] text-muted-foreground font-medium uppercase">
                        Provider
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2 relative z-10">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground">Total Requests</span>
                      <span className="text-foreground font-mono">
                        {totalRequests.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground">Accounts</span>
                      <span className="text-foreground font-mono">{accounts.length}</span>
                    </div>
                    <div className="w-full bg-muted dark:bg-zinc-800/50 h-1 rounded-full mt-2 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(100, (totalRequests / (maxRequests * accounts.length)) * 100)}%`,
                          backgroundColor: providerColor,
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Right Accounts */}
          {hasRightAccounts && (
            <div className="flex flex-col gap-3 z-10 w-44 justify-center">
              {rightAccounts.map((account) => {
                const originalIndex = accounts.findIndex((a) => a.id === account.id);
                const total = account.successCount + account.failureCount;
                const isHovered = hoveredAccount === originalIndex;
                const isDragging = draggingId === account.id;
                const offset = getOffset(account.id);

                return (
                  <div
                    key={account.id}
                    data-account-index={originalIndex}
                    data-right-side
                    onClick={() => !isDragging && setSelectedAccount(account)}
                    onMouseEnter={() => setHoveredAccount(originalIndex)}
                    onMouseLeave={() => setHoveredAccount(null)}
                    onPointerDown={(e) => handlePointerDown(account.id, e)}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                    className={cn(
                      'group/card relative rounded-lg p-3 pl-6 cursor-grab transition-shadow duration-200',
                      'bg-muted/30 dark:bg-zinc-900/60 backdrop-blur-sm',
                      'border border-border/50 dark:border-white/[0.08]',
                      'border-r-2 select-none touch-none',
                      isHovered && 'bg-muted/50 dark:bg-zinc-800/60',
                      isDragging && 'cursor-grabbing shadow-xl scale-105 z-50'
                    )}
                    style={{
                      borderRightColor: account.color,
                      transform: `translate(${offset.x}px, ${offset.y}px)${isDragging ? ' scale(1.05)' : ''}`,
                    }}
                  >
                    {/* Drag handle indicator */}
                    <GripVertical className="absolute top-1/2 right-1 -translate-y-1/2 w-3 h-3 text-muted-foreground/40" />
                    <div className="flex justify-between items-start mb-1 mr-3">
                      <ChevronRight
                        className={cn(
                          'w-3.5 h-3.5 text-muted-foreground transition-opacity rotate-180',
                          isHovered ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                      <span
                        className={cn(
                          'text-xs font-semibold text-foreground tracking-tight truncate max-w-[100px]',
                          privacyMode && PRIVACY_BLUR_CLASS
                        )}
                      >
                        {cleanEmail(account.email)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/80" />
                        {account.failureCount > 0 && (
                          <div className="w-1.5 h-1.5 rounded-full bg-red-500/80" />
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {total.toLocaleString()} reqs
                      </span>
                    </div>
                    {/* Connector Dot - Left side */}
                    <div
                      className={cn(
                        'absolute top-1/2 -left-1.5 w-3 h-3 rounded-full transform -translate-y-1/2 z-20 transition-colors border',
                        'bg-muted dark:bg-zinc-800 border-border dark:border-zinc-600',
                        isHovered && 'bg-foreground dark:bg-white border-transparent'
                      )}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Section: Connection Timeline - Fixed compact width */}
        <div className="w-56 flex-shrink-0">
          <ConnectionTimeline events={connectionEvents} privacyMode={privacyMode} />
        </div>
      </div>

      {/* Detail Panel - slides in from bottom, pushes content */}
      <div
        className={cn(
          'overflow-hidden transition-all duration-300 ease-out',
          selectedAccount ? 'max-h-[200px] opacity-100' : 'max-h-0 opacity-0'
        )}
      >
        <div className={cn('bg-card dark:bg-zinc-950 border-t border-border', 'p-4')}>
          <div className="relative">
            <button
              onClick={() => setSelectedAccount(null)}
              className="absolute top-0 right-0 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            {selectedAccount && (
              <div className="grid grid-cols-4 gap-4">
                {/* Account Info */}
                <div className="border-r border-border pr-4">
                  <div className="flex items-center gap-2 mb-1">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: selectedAccount.color }}
                    />
                    <span
                      className={cn(
                        'text-sm font-semibold text-foreground tracking-tight truncate',
                        privacyMode && PRIVACY_BLUR_CLASS
                      )}
                    >
                      {cleanEmail(selectedAccount.email)}
                    </span>
                  </div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-widest">
                    Source Account
                  </div>
                </div>

                {/* Stats */}
                <div className="bg-muted/30 dark:bg-zinc-900/50 rounded-lg p-3 border border-border">
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-700 dark:text-emerald-500" />
                    <span>SUCCESSFUL</span>
                  </div>
                  <div className="text-xl font-mono text-emerald-700 dark:text-emerald-500 tracking-tighter">
                    {selectedAccount.successCount.toLocaleString()}
                  </div>
                </div>

                <div className="bg-muted/30 dark:bg-zinc-900/50 rounded-lg p-3 border border-border">
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-1">
                    <XCircle className="w-3 h-3 text-red-700 dark:text-red-500" />
                    <span>FAILED</span>
                  </div>
                  <div className="text-xl font-mono text-red-700 dark:text-red-500 tracking-tighter">
                    {selectedAccount.failureCount.toLocaleString()}
                  </div>
                </div>

                <div className="bg-muted/30 dark:bg-zinc-900/50 rounded-lg p-3 border border-border">
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-1">
                    <Clock className="w-3 h-3" />
                    <span>LAST SYNC</span>
                  </div>
                  <div className="text-sm font-mono text-foreground mt-1">
                    {getTimeAgo(selectedAccount.lastUsedAt)}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
