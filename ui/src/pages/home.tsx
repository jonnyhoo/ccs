import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/stat-card';
import { HeroSection } from '@/components/hero-section';
import { QuickCommands } from '@/components/quick-commands';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Key,
  Zap,
  Users,
  Activity,
  Plus,
  Stethoscope,
  BookOpen,
  FolderOpen,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';
import { useOverview } from '@/hooks/use-overview';
import { useSharedSummary } from '@/hooks/use-shared';

const HEALTH_VARIANTS = {
  ok: 'success',
  warning: 'warning',
  error: 'error',
} as const;

export function HomePage() {
  const navigate = useNavigate();
  const { data: overview, isLoading: isOverviewLoading } = useOverview();
  const { data: shared, isLoading: isSharedLoading } = useSharedSummary();

  if (isOverviewLoading || isSharedLoading) {
    return (
      <div className="p-6 space-y-6">
        {/* Hero Skeleton */}
        <div className="rounded-xl border p-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-12 w-12 rounded-lg" />
            <div>
              <Skeleton className="h-7 w-[180px] mb-2" />
              <Skeleton className="h-4 w-[220px]" />
            </div>
          </div>
        </div>

        {/* Stats Skeleton */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-3 p-4 border rounded-xl">
              <div className="flex items-center gap-4">
                <Skeleton className="h-12 w-12 rounded-lg" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-20 mb-2" />
                  <Skeleton className="h-7 w-12" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Quick Actions Skeleton */}
        <div className="border rounded-xl p-6 space-y-4">
          <Skeleton className="h-6 w-[140px]" />
          <div className="flex flex-wrap gap-3">
            <Skeleton className="h-10 w-[140px] rounded-md" />
            <Skeleton className="h-10 w-[120px] rounded-md" />
            <Skeleton className="h-10 w-[150px] rounded-md" />
          </div>
        </div>

        {/* Quick Commands Skeleton */}
        <div className="border rounded-xl p-6 space-y-4">
          <Skeleton className="h-6 w-[160px]" />
          <div className="grid grid-cols-2 gap-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-14 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const healthVariant = overview?.health
    ? HEALTH_VARIANTS[overview.health.status as keyof typeof HEALTH_VARIANTS]
    : undefined;

  return (
    <div className="p-6 space-y-6">
      {/* Hero Section */}
      <HeroSection
        version={overview?.version}
        healthStatus={overview?.health?.status}
        healthPassed={overview?.health?.passed}
        healthTotal={overview?.health?.total}
      />

      {/* Configuration Warning */}
      {shared?.symlinkStatus && !shared.symlinkStatus.valid && (
        <Alert variant="warning">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Configuration Required</AlertTitle>
          <AlertDescription>{shared.symlinkStatus.message}</AlertDescription>
        </Alert>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="API Profiles"
          value={overview?.profiles ?? 0}
          icon={Key}
          variant="accent"
          subtitle="Settings-based"
          onClick={() => navigate('/api')}
        />
        <StatCard
          title="CLIProxy"
          value={overview?.cliproxy ?? 0}
          icon={Zap}
          variant="accent"
          subtitle={`${overview?.cliproxyProviders ?? 0} auth + ${overview?.cliproxyVariants ?? 0} custom`}
          onClick={() => navigate('/cliproxy')}
        />
        <StatCard
          title="Accounts"
          value={overview?.accounts ?? 0}
          icon={Users}
          variant="default"
          subtitle="Isolated instances"
          onClick={() => navigate('/accounts')}
        />
        <StatCard
          title="Health"
          value={overview?.health ? `${overview.health.passed}/${overview.health.total}` : '-'}
          icon={Activity}
          variant={healthVariant}
          subtitle="System checks"
          onClick={() => navigate('/health')}
        />
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button onClick={() => navigate('/api')} className="gap-2">
            <Plus className="w-4 h-4" /> New Profile
          </Button>
          <Button variant="outline" onClick={() => navigate('/health')} className="gap-2">
            <Stethoscope className="w-4 h-4" /> Run Doctor
          </Button>
          <Button variant="outline" asChild className="gap-2">
            <a href="https://docs.ccs.kaitran.ca" target="_blank" rel="noopener noreferrer">
              <BookOpen className="w-4 h-4" /> Documentation
            </a>
          </Button>
        </CardContent>
      </Card>

      {/* Quick Commands */}
      <QuickCommands />

      {/* Shared Data Summary */}
      <Card className="group hover:border-primary/50 transition-colors">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-muted-foreground" />
            Shared Data
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/shared')}
            className="gap-1 opacity-70 group-hover:opacity-100 transition-opacity"
          >
            View All <ArrowRight className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <div className="flex gap-6 text-sm">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50">
              <span className="text-xl font-bold font-mono">{shared?.commands ?? 0}</span>
              <span className="text-muted-foreground">Commands</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50">
              <span className="text-xl font-bold font-mono">{shared?.skills ?? 0}</span>
              <span className="text-muted-foreground">Skills</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50">
              <span className="text-xl font-bold font-mono">{shared?.agents ?? 0}</span>
              <span className="text-muted-foreground">Agents</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
