import { useNavigate } from 'react-router-dom';
import { HeroSection } from '@/components/hero-section';
import { AuthMonitor } from '@/components/auth-monitor';
import { ErrorLogsMonitor } from '@/components/error-logs-monitor';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Key, Zap, Users, Activity, AlertTriangle } from 'lucide-react';
import { useOverview } from '@/hooks/use-overview';
import { useSharedSummary } from '@/hooks/use-shared';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

const HEALTH_VARIANTS = {
  ok: 'success',
  warning: 'warning',
  error: 'error',
} as const;

type StatVariant = 'default' | 'success' | 'warning' | 'error' | 'accent';

const variantStyles: Record<StatVariant, { iconBg: string; iconColor: string }> = {
  default: { iconBg: 'bg-muted', iconColor: 'text-muted-foreground' },
  success: { iconBg: 'bg-green-600/15', iconColor: 'text-green-700 dark:text-green-500' },
  warning: { iconBg: 'bg-amber-500/15', iconColor: 'text-amber-700 dark:text-amber-400' },
  error: { iconBg: 'bg-red-600/15', iconColor: 'text-red-700 dark:text-red-500' },
  accent: { iconBg: 'bg-accent/15', iconColor: 'text-accent' },
};

function InlineStat({
  title,
  value,
  icon: Icon,
  variant = 'default',
  onClick,
}: {
  title: string;
  value: number | string;
  icon: LucideIcon;
  variant?: StatVariant;
  onClick?: () => void;
}) {
  const styles = variantStyles[variant];

  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 px-4 py-2.5 rounded-lg border bg-card/50',
        'transition-all hover:bg-card hover:shadow-sm hover:-translate-y-0.5',
        'active:scale-[0.98]'
      )}
    >
      <div className={cn('flex items-center justify-center w-9 h-9 rounded-md', styles.iconBg)}>
        <Icon className={cn('w-4 h-4', styles.iconColor)} />
      </div>
      <div className="text-left">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{title}</p>
        <p className={cn('text-lg font-bold font-mono leading-tight', styles.iconColor)}>{value}</p>
      </div>
    </button>
  );
}

export function HomePage() {
  const navigate = useNavigate();
  const { data: overview, isLoading: isOverviewLoading } = useOverview();
  const { data: shared, isLoading: isSharedLoading } = useSharedSummary();

  if (isOverviewLoading || isSharedLoading) {
    return (
      <div className="p-6 space-y-6">
        {/* Hero Row Skeleton */}
        <div className="rounded-xl border p-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Skeleton className="h-12 w-12 rounded-lg" />
            <div>
              <Skeleton className="h-7 w-[180px] mb-2" />
              <Skeleton className="h-4 w-[220px]" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-14 w-28 rounded-lg" />
            ))}
          </div>
        </div>

        {/* Auth Monitor Skeleton */}
        <div className="border rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 border-b flex items-center justify-between">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-20" />
          </div>
          <div className="px-4 py-3 border-b">
            <Skeleton className="h-2 w-full rounded-full" />
          </div>
          {[1, 2, 3].map((i) => (
            <div key={i} className="px-4 py-2.5 flex items-center gap-3 border-b last:border-b-0">
              <Skeleton className="w-2.5 h-2.5 rounded-full" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-1.5 w-24 rounded-full" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const healthVariant = overview?.health
    ? HEALTH_VARIANTS[overview.health.status as keyof typeof HEALTH_VARIANTS]
    : undefined;

  return (
    <div className="p-6 space-y-6">
      {/* Hero Row: Logo/Title + Inline Stats */}
      <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-background via-background to-muted/30">
        {/* Subtle background pattern */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)`,
              backgroundSize: '24px 24px',
            }}
          />
        </div>

        {/* Single Row Layout */}
        <div className="relative p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Left: Logo + Title */}
          <HeroSection version={overview?.version} />

          {/* Right: Inline Stats */}
          <div className="flex flex-wrap items-center gap-3">
            <InlineStat
              title="Profiles"
              value={overview?.profiles ?? 0}
              icon={Key}
              variant="accent"
              onClick={() => navigate('/api')}
            />
            <InlineStat
              title="CLIProxy"
              value={overview?.cliproxy ?? 0}
              icon={Zap}
              variant="accent"
              onClick={() => navigate('/cliproxy')}
            />
            <InlineStat
              title="Accounts"
              value={overview?.accounts ?? 0}
              icon={Users}
              variant="default"
              onClick={() => navigate('/accounts')}
            />
            <InlineStat
              title="Health"
              value={overview?.health ? `${overview.health.passed}/${overview.health.total}` : '-'}
              icon={Activity}
              variant={healthVariant}
              onClick={() => navigate('/health')}
            />
          </div>
        </div>
      </div>

      {/* Configuration Warning */}
      {shared?.symlinkStatus && !shared.symlinkStatus.valid && (
        <Alert variant="warning">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Configuration Required</AlertTitle>
          <AlertDescription>{shared.symlinkStatus.message}</AlertDescription>
        </Alert>
      )}

      {/* Auth Monitor */}
      <AuthMonitor />

      {/* Error Logs Monitor - shows only when there are errors */}
      <ErrorLogsMonitor />
    </div>
  );
}
