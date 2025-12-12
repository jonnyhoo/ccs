import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
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
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Hero Section */}
      <HeroSection
        version={overview?.version}
        healthStatus={overview?.health?.status}
        healthPassed={overview?.health?.passed}
        healthTotal={overview?.health?.total}
      />

      {/* Configuration Warning */}
      {shared?.symlinkStatus && !shared.symlinkStatus.valid && (
        <Alert variant="warning" className="animate-in zoom-in-95 duration-300">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Configuration Required</AlertTitle>
          <AlertDescription>{shared.symlinkStatus.message}</AlertDescription>
        </Alert>
      )}

      {/* Stats Grid */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold tracking-tight">System Status</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Quick Actions & Shared Data */}
        <div className="space-y-8 lg:col-span-2">
          {/* Quick Actions */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold tracking-tight">Quick Actions</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card
                className="group cursor-pointer hover:border-primary/50 transition-all hover:shadow-md active:scale-[0.99]"
                onClick={() => navigate('/api')}
              >
                <CardContent className="p-6 flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-primary/10 text-primary group-hover:scale-110 transition-transform">
                    <Plus className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">New Profile</h3>
                    <p className="text-muted-foreground text-sm">Create a new API profile</p>
                  </div>
                </CardContent>
              </Card>

              <Card
                className="group cursor-pointer hover:border-primary/50 transition-all hover:shadow-md active:scale-[0.99]"
                onClick={() => navigate('/health')}
              >
                <CardContent className="p-6 flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-primary/10 text-primary group-hover:scale-110 transition-transform">
                    <Stethoscope className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">Run Doctor</h3>
                    <p className="text-muted-foreground text-sm">Check system health</p>
                  </div>
                </CardContent>
              </Card>

              <Card
                className="group cursor-pointer hover:border-primary/50 transition-all hover:shadow-md active:scale-[0.99]"
                onClick={() => window.open('https://github.com/kaitranntt/ccs', '_blank')}
              >
                <CardContent className="p-6 flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-muted text-muted-foreground group-hover:text-primary transition-colors">
                    <BookOpen className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">Documentation</h3>
                    <p className="text-muted-foreground text-sm">View guides & reference</p>
                  </div>
                </CardContent>
              </Card>

              <Card
                className="group cursor-pointer hover:border-primary/50 transition-all hover:shadow-md active:scale-[0.99]"
                onClick={() => navigate('/shared')}
              >
                <CardContent className="p-6 flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-muted text-muted-foreground group-hover:text-primary transition-colors">
                    <FolderOpen className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">Shared Data</h3>
                    <p className="text-muted-foreground text-sm">Manage resources</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>

          {/* Shared Data Stats */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold tracking-tight">Resource Summary</h2>
            </div>
            <Card>
              <CardContent className="p-6">
                <div className="grid grid-cols-3 gap-4">
                  <div className="flex flex-col items-center justify-center p-4 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors">
                    <span className="text-3xl font-bold font-mono text-primary mb-1">
                      {shared?.commands ?? 0}
                    </span>
                    <span className="text-sm font-medium text-muted-foreground">Commands</span>
                  </div>
                  <div className="flex flex-col items-center justify-center p-4 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors">
                    <span className="text-3xl font-bold font-mono text-primary mb-1">
                      {shared?.skills ?? 0}
                    </span>
                    <span className="text-sm font-medium text-muted-foreground">Skills</span>
                  </div>
                  <div className="flex flex-col items-center justify-center p-4 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors">
                    <span className="text-3xl font-bold font-mono text-primary mb-1">
                      {shared?.agents ?? 0}
                    </span>
                    <span className="text-sm font-medium text-muted-foreground">Agents</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>
        </div>

        {/* Right Column: Quick Commands */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight">Command Palette</h2>
          <QuickCommands />
        </div>
      </div>
    </div>
  );
}
