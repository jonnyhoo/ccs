import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { HealthCard } from '@/components/health-card';
import { useHealth } from '@/hooks/use-health';

export function HealthPage() {
  const { data, isLoading, refetch, dataUpdatedAt } = useHealth();

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Health Dashboard</h1>
          {dataUpdatedAt && (
            <p className="text-sm text-muted-foreground">Last check: {formatTime(dataUpdatedAt)}</p>
          )}
        </div>
        <Button variant="outline" onClick={() => refetch()} disabled={isLoading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {data && (
        <div className="flex gap-4 text-sm">
          <div className="flex items-center gap-1">
            <span className="font-medium text-green-600">{data.summary.passed}</span>
            <span className="text-muted-foreground">passed</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="font-medium text-yellow-600">{data.summary.warnings}</span>
            <span className="text-muted-foreground">warnings</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="font-medium text-red-600">{data.summary.errors}</span>
            <span className="text-muted-foreground">errors</span>
          </div>
        </div>
      )}

      {isLoading && !data && <div className="text-muted-foreground">Running health checks...</div>}

      {data && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.checks.map((check) => (
            <HealthCard key={check.id} check={check} />
          ))}
        </div>
      )}
    </div>
  );
}
