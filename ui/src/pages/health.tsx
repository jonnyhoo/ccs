import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCw, Terminal, Copy, Cpu } from 'lucide-react';
import { HealthGauge } from '@/components/health/health-gauge';
import { HealthStatsBar } from '@/components/health/health-stats-bar';
import { HealthGroupSection } from '@/components/health/health-group-section';
import { useHealth, type HealthGroup } from '@/hooks/use-health';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useEffect, useState } from 'react';

function getOverallStatus(summary: { passed: number; warnings: number; errors: number }) {
  if (summary.errors > 0) return 'error';
  if (summary.warnings > 0) return 'warning';
  return 'ok';
}

function formatRelativeTime(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

function sortGroupsByIssues(groups: HealthGroup[]): HealthGroup[] {
  return [...groups].sort((a, b) => {
    const aErrors = a.checks.filter((c) => c.status === 'error').length;
    const bErrors = b.checks.filter((c) => c.status === 'error').length;
    const aWarnings = a.checks.filter((c) => c.status === 'warning').length;
    const bWarnings = b.checks.filter((c) => c.status === 'warning').length;
    if (aErrors !== bErrors) return bErrors - aErrors;
    return bWarnings - aWarnings;
  });
}

function TerminalHeader() {
  return (
    <div className="font-mono text-sm text-muted-foreground flex items-center gap-2">
      <span className="text-green-500">$</span>
      <span>ccs doctor</span>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Hero skeleton */}
      <div className="rounded-xl border bg-gradient-to-br from-background to-muted/20 p-6">
        <div className="flex items-center gap-6">
          <Skeleton className="w-[120px] h-[120px] rounded-full" />
          <div className="flex-1 space-y-3">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
      </div>

      {/* Stats skeleton */}
      <Skeleton className="h-16 w-full rounded-lg" />

      {/* Groups skeleton */}
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-20 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

export function HealthPage() {
  const { data, isLoading, refetch, dataUpdatedAt } = useHealth();

  // Use dataUpdatedAt directly instead of storing in state
  const lastRefresh = dataUpdatedAt;

  // Update relative time display by forcing re-render every second
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);
  // Consume tick to prevent unused variable warning
  void tick;

  const copyDoctorCommand = () => {
    navigator.clipboard.writeText('ccs doctor');
    toast.success('Copied to clipboard');
  };

  const handleRefresh = () => {
    refetch();
    toast.info('Refreshing health checks...');
  };

  if (isLoading && !data) {
    return <LoadingSkeleton />;
  }

  const overallStatus = data ? getOverallStatus(data.summary) : 'ok';
  const sortedGroups = data?.groups ? sortGroupsByIssues(data.groups) : [];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Hero Section - Terminal-inspired control center header */}
      <div
        className={cn(
          'relative overflow-hidden rounded-xl border p-6',
          'bg-gradient-to-br from-background via-background to-muted/30'
        )}
      >
        {/* Subtle scan lines effect */}
        <div
          className="absolute inset-0 opacity-[0.02] pointer-events-none"
          style={{
            backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 2px, currentColor 2px, currentColor 3px)`,
          }}
        />

        {/* Grid pattern background */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)`,
              backgroundSize: '24px 24px',
            }}
          />
        </div>

        <div className="relative flex flex-col md:flex-row items-start md:items-center gap-6">
          {/* Left: Health Gauge - excludes info from percentage */}
          {data && (
            <div className="shrink-0">
              <HealthGauge
                passed={data.summary.passed}
                total={data.summary.total - data.summary.info}
                status={overallStatus}
                size="md"
              />
            </div>
          )}

          {/* Center: Title and status */}
          <div className="flex-1 space-y-3">
            {/* Terminal prompt */}
            <TerminalHeader />

            {/* Main title */}
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold font-mono tracking-tight">System Health</h1>
              {data?.version && (
                <Badge variant="outline" className="font-mono text-xs bg-muted/50">
                  build {data.version}
                </Badge>
              )}
            </div>

            {/* Status message */}
            <div className="flex items-center gap-2 text-sm">
              <Cpu className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">Last scan:</span>
              <span className="font-mono">
                {lastRefresh ? formatRelativeTime(lastRefresh) : '--'}
              </span>
              <span className="text-muted-foreground">|</span>
              <span className="text-muted-foreground">Auto-refresh:</span>
              <span className="font-mono text-green-500">30s</span>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={copyDoctorCommand}
              className="gap-2 font-mono text-xs"
            >
              <Terminal className="w-3 h-3" />
              ccs doctor
              <Copy className="w-3 h-3 opacity-50" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isLoading}
              className="gap-2"
            >
              <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
              <span className="hidden sm:inline">Refresh</span>
              <kbd className="hidden md:inline-flex h-5 items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                R
              </kbd>
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      {data && (
        <div className="rounded-lg border bg-card p-4">
          <HealthStatsBar
            total={data.summary.total}
            passed={data.summary.passed}
            warnings={data.summary.warnings}
            errors={data.summary.errors}
            info={data.summary.info}
          />
        </div>
      )}

      {/* Health Check Groups - Single column layout */}
      {sortedGroups.length > 0 && (
        <div className="space-y-3">
          {sortedGroups.map((group, index) => (
            <HealthGroupSection
              key={group.id}
              group={group}
              defaultOpen={
                index < 2 ||
                group.checks.some((c) => c.status === 'error' || c.status === 'warning')
              }
            />
          ))}
        </div>
      )}

      {/* Footer metadata */}
      <div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-4">
        <div className="flex items-center gap-4">
          <span>
            Version <span className="font-mono">{data?.version ?? '--'}</span>
          </span>
          <span>
            Platform{' '}
            <span className="font-mono">
              {typeof navigator !== 'undefined' ? navigator.platform : 'linux'}
            </span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span>Live monitoring active</span>
        </div>
      </div>
    </div>
  );
}
