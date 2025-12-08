import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/stat-card';
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

const HEALTH_COLORS = {
  ok: 'text-green-500',
  warning: 'text-yellow-500',
  error: 'text-red-500',
} as const;

export function HomePage() {
  const navigate = useNavigate();
  const { data: overview, isLoading: isOverviewLoading } = useOverview();
  const { data: shared, isLoading: isSharedLoading } = useSharedSummary();

  if (isOverviewLoading || isSharedLoading) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <Skeleton className="h-9 w-[200px] mb-2" />
          <Skeleton className="h-5 w-[320px]" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-3 p-4 border rounded-lg">
              <div className="flex items-center justify-between">
                <Skeleton className="h-8 w-8 rounded-full" />
                <Skeleton className="h-6 w-12" />
              </div>
              <div>
                <Skeleton className="h-4 w-20 mb-1" />
                <Skeleton className="h-7 w-16" />
              </div>
            </div>
          ))}
        </div>
        <div className="border rounded-lg p-6 space-y-4">
          <Skeleton className="h-6 w-[180px]" />
          <div className="flex flex-wrap gap-3">
            <Skeleton className="h-10 w-[140px] rounded-md" />
            <Skeleton className="h-10 w-[120px] rounded-md" />
            <Skeleton className="h-10 w-[150px] rounded-md" />
          </div>
        </div>
        <div className="border rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-[140px]" />
            <Skeleton className="h-8 w-[80px] rounded-md" />
          </div>
          <div className="flex gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-2">
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-4 w-8" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Welcome to CCS Config</h1>
        <p className="text-muted-foreground">Manage your Claude Code Switch configuration</p>
      </div>

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
          onClick={() => navigate('/api')}
        />
        <StatCard
          title="CLIProxy Variants"
          value={overview?.cliproxy ?? 0}
          icon={Zap}
          onClick={() => navigate('/cliproxy')}
        />
        <StatCard
          title="Accounts"
          value={overview?.accounts ?? 0}
          icon={Users}
          onClick={() => navigate('/accounts')}
        />
        <StatCard
          title="Health"
          value={overview?.health ? `${overview.health.passed}/${overview.health.total}` : '-'}
          icon={Activity}
          color={
            overview?.health
              ? HEALTH_COLORS[overview.health.status as keyof typeof HEALTH_COLORS]
              : undefined
          }
          onClick={() => navigate('/health')}
        />
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button onClick={() => navigate('/api')}>
            <Plus className="w-4 h-4 mr-2" /> New Profile
          </Button>
          <Button variant="outline" onClick={() => navigate('/health')}>
            <Stethoscope className="w-4 h-4 mr-2" /> Run Doctor
          </Button>
          <Button variant="outline" asChild>
            <a href="https://github.com/kaitranntt/ccs" target="_blank" rel="noopener noreferrer">
              <BookOpen className="w-4 h-4 mr-2" /> Documentation
            </a>
          </Button>
        </CardContent>
      </Card>

      {/* Shared Data Summary */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Shared Data</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => navigate('/shared')}>
            View All
          </Button>
        </CardHeader>
        <CardContent>
          <div className="flex gap-6 text-sm">
            <div className="flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium">{shared?.commands ?? 0}</span>
              <span className="text-muted-foreground">Commands</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium">{shared?.skills ?? 0}</span>
              <span className="text-muted-foreground">Skills</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium">{shared?.agents ?? 0}</span>
              <span className="text-muted-foreground">Agents</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
