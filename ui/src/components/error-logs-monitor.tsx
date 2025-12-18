/**
 * Error Logs Monitor Component
 *
 * Displays CLIProxyAPI error logs with master-detail split view.
 * Log list on left, content panel on right for better readability.
 */

import { useState, useMemo } from 'react';
import { useCliproxyErrorLogs, useCliproxyErrorLogContent } from '@/hooks/use-cliproxy-stats';
import { useCliproxyStatus } from '@/hooks/use-cliproxy-stats';
import { cn, STATUS_COLORS } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertTriangle,
  FileWarning,
  Clock,
  FileText,
  XCircle,
  FlaskConical,
  Terminal,
} from 'lucide-react';

/** Demo mode mock data */
const DEMO_ERROR_LOGS = [
  {
    name: 'error-v1-chat-completions-2025-12-18T17-45-23.log',
    size: 4523,
    modified: Math.floor(Date.now() / 1000) - 120,
  },
  {
    name: 'error-v1-messages-2025-12-18T17-30-15.log',
    size: 8912,
    modified: Math.floor(Date.now() / 1000) - 900,
  },
  {
    name: 'error-v1-chat-completions-2025-12-18T16-22-08.log',
    size: 2341,
    modified: Math.floor(Date.now() / 1000) - 5400,
  },
  {
    name: 'error-v1-models-2025-12-18T14-10-55.log',
    size: 1024,
    modified: Math.floor(Date.now() / 1000) - 12600,
  },
];

const DEMO_LOG_CONTENT = `================================================================================
REQUEST ERROR LOG
================================================================================
Timestamp: 2025-12-18T17:45:23Z
Endpoint: /v1/chat/completions
Method: POST
Status: 429 Too Many Requests

--------------------------------------------------------------------------------
REQUEST HEADERS
--------------------------------------------------------------------------------
Content-Type: application/json
Authorization: Bearer ccs-internal-managed
User-Agent: claude-code/1.0

--------------------------------------------------------------------------------
REQUEST BODY
--------------------------------------------------------------------------------
{
  "model": "gemini-claude-opus-4-5-thinking",
  "messages": [
    {"role": "user", "content": "Explain quantum computing"}
  ],
  "max_tokens": 4096,
  "stream": true
}

--------------------------------------------------------------------------------
RESPONSE
--------------------------------------------------------------------------------
{
  "error": {
    "message": "Rate limit exceeded. Please retry after 60 seconds.",
    "type": "rate_limit_error",
    "code": "rate_limit_exceeded"
  }
}

--------------------------------------------------------------------------------
UPSTREAM API ERROR
--------------------------------------------------------------------------------
Provider: gemini
Account: user@gmail.com
Quota: Daily limit reached (1500/1500 requests)
Retry-After: 60
================================================================================`;

/** Format file size in human-readable format */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Format timestamp to relative time */
function formatRelativeTime(unixSeconds: number): string {
  const diff = Math.floor(Date.now() / 1000 - unixSeconds);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

/** Parse error log filename to extract endpoint and timestamp */
function parseErrorLogName(name: string): { endpoint: string; timestamp: string } {
  const match = name.match(/^error-(.+)-(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})\.log$/);
  if (match) {
    const endpoint = match[1].replace(/-/g, '/');
    const timestamp = match[2].replace(/T/, ' ').replace(/-/g, ':');
    return { endpoint: `/${endpoint}`, timestamp };
  }
  return { endpoint: name, timestamp: '' };
}

/** Log content panel component */
function LogContentPanel({ name, demo = false }: { name: string | null; demo?: boolean }) {
  const { data: content, isLoading, error } = useCliproxyErrorLogContent(demo ? null : name);

  // No log selected
  if (!name) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <div className="text-center space-y-2">
          <Terminal className="w-8 h-8 mx-auto opacity-40" />
          <p className="text-xs">Select a log to view details</p>
        </div>
      </div>
    );
  }

  // Demo mode
  if (demo) {
    const { endpoint } = parseErrorLogName(name);
    return (
      <div className="flex-1 flex flex-col min-w-0">
        <div className="px-3 py-2 border-b border-border bg-muted/30 flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-[11px] font-medium truncate">{endpoint}</span>
        </div>
        <ScrollArea className="flex-1">
          <pre className="p-3 text-[10px] font-mono text-muted-foreground whitespace-pre-wrap break-all leading-relaxed">
            {DEMO_LOG_CONTENT}
          </pre>
        </ScrollArea>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex-1 p-4 space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    );
  }

  // Error or no content
  if (error || !content) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <p className="text-xs">Failed to load log content</p>
      </div>
    );
  }

  // Show content
  const { endpoint } = parseErrorLogName(name);
  return (
    <div className="flex-1 flex flex-col min-w-0">
      <div className="px-3 py-2 border-b border-border bg-muted/30 flex items-center gap-2">
        <Terminal className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-[11px] font-medium truncate">{endpoint}</span>
      </div>
      <ScrollArea className="flex-1">
        <pre className="p-3 text-[10px] font-mono text-muted-foreground whitespace-pre-wrap break-all leading-relaxed">
          {content}
        </pre>
      </ScrollArea>
    </div>
  );
}

/** Error log item in the list */
interface ErrorLogItemProps {
  name: string;
  size: number;
  modified: number;
  isSelected: boolean;
  onClick: () => void;
}

function ErrorLogItem({ name, size, modified, isSelected, onClick }: ErrorLogItemProps) {
  const { endpoint, timestamp } = parseErrorLogName(name);

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full px-3 py-2.5 flex items-start gap-2 text-left transition-colors',
        'hover:bg-muted/40 border-l-2',
        isSelected ? 'bg-muted/50 border-l-amber-500' : 'border-l-transparent'
      )}
    >
      <XCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: STATUS_COLORS.failed }} />
      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="text-[11px] font-medium truncate" title={endpoint}>
          {endpoint}
        </div>
        <div className="flex items-center gap-2 text-[9px] text-muted-foreground">
          <span className="flex items-center gap-0.5">
            <Clock className="w-2.5 h-2.5" />
            {formatRelativeTime(modified)}
          </span>
          <span className="flex items-center gap-0.5">
            <FileText className="w-2.5 h-2.5" />
            {formatSize(size)}
          </span>
        </div>
        {timestamp && (
          <div className="text-[9px] text-muted-foreground/70 truncate">{timestamp}</div>
        )}
      </div>
    </button>
  );
}

export function ErrorLogsMonitor({ demo = false }: { demo?: boolean } = {}) {
  const { data: status, isLoading: isStatusLoading } = useCliproxyStatus();
  const {
    data: logs,
    isLoading,
    error,
  } = useCliproxyErrorLogs(demo ? false : (status?.running ?? false));
  // Use demo data or real data
  const displayLogs = demo ? DEMO_ERROR_LOGS : logs;

  // Compute default selection (first log name or null)
  const defaultLogName = useMemo(() => displayLogs?.[0]?.name ?? null, [displayLogs]);

  // Use controlled selection that defaults to first log
  const [selectedLog, setSelectedLog] = useState<string | null>(null);

  // Effective selection: use user selection if available, otherwise default
  const effectiveSelection = selectedLog ?? defaultLogName;

  // Non-demo mode guards
  if (!demo) {
    if (isStatusLoading) return null;
    if (!status?.running) return null;
    if (isLoading) {
      return (
        <div className="rounded-xl border border-border overflow-hidden font-mono text-[13px] bg-card/50 dark:bg-zinc-900/60 backdrop-blur-sm">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-20" />
          </div>
          <div className="p-4 space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-10 w-full rounded-lg" />
            ))}
          </div>
        </div>
      );
    }
    if (!logs || logs.length === 0) return null;
  }

  const errorCount = displayLogs?.length ?? 0;

  return (
    <div className="rounded-xl border border-border overflow-hidden font-mono text-[13px] text-foreground bg-card/50 dark:bg-zinc-900/60 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-gradient-to-r from-amber-500/10 via-transparent to-transparent dark:from-amber-500/15">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" style={{ color: STATUS_COLORS.degraded }} />
          <span className="text-xs font-semibold tracking-tight">Error Logs</span>
          <span className="text-[10px] text-muted-foreground">
            {errorCount} failed request{errorCount !== 1 ? 's' : ''}
          </span>
          {demo && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium bg-violet-500/20 text-violet-400 border border-violet-500/30">
              <FlaskConical className="w-2.5 h-2.5" />
              DEMO
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <FileWarning className="w-3 h-3" />
          <span>CLIProxy Diagnostics</span>
        </div>
      </div>

      {/* Split View: List (left) + Content (right) */}
      <div className="flex h-[280px]">
        {/* Left Panel: Log List */}
        <div className="w-[240px] shrink-0 border-r border-border">
          <ScrollArea className="h-full">
            <div className="divide-y divide-border/50">
              {displayLogs?.slice(0, 10).map((log) => (
                <ErrorLogItem
                  key={log.name}
                  name={log.name}
                  size={log.size}
                  modified={log.modified}
                  isSelected={effectiveSelection === log.name}
                  onClick={() => setSelectedLog(log.name)}
                />
              ))}
            </div>
            {(displayLogs?.length ?? 0) > 10 && (
              <div className="px-3 py-2 text-center text-[9px] text-muted-foreground border-t border-border/50">
                Showing 10 of {displayLogs?.length} logs
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Right Panel: Log Content */}
        <LogContentPanel name={effectiveSelection} demo={demo} />
      </div>

      {/* Footer error */}
      {error && (
        <div className="px-4 py-2 border-t border-border text-[10px] text-destructive">
          {error.message}
        </div>
      )}
    </div>
  );
}
