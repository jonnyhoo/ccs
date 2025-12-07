import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/stat-card';
import { Key, Zap, Users, Activity, Plus, Stethoscope, BookOpen, FolderOpen } from 'lucide-react';
import { useOverview } from '@/hooks/use-overview';
import { useSharedSummary } from '@/hooks/use-shared';

export function HomePage() {
  const navigate = useNavigate();
  const { data: overview } = useOverview();
  const { data: shared } = useSharedSummary();

  const healthColor = {
    ok: 'text-green-500',
    warning: 'text-yellow-500',
    error: 'text-red-500',
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Welcome to CCS Config</h1>
        <p className="text-muted-foreground">Manage your Claude Code Switch configuration</p>
      </div>

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
          color={overview?.health ? healthColor[overview.health.status] : undefined}
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
          {shared?.symlinkStatus && (
            <p
              className={`text-xs mt-2 ${shared.symlinkStatus.valid ? 'text-green-600' : 'text-yellow-600'}`}
            >
              {shared.symlinkStatus.message}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
