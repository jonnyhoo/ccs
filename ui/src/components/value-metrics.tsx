import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUpIcon, TrendingDownIcon, DollarSignIcon, ZapIcon } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
}

function MetricCard({ title, value, change, changeLabel, icon, trend }: MetricCardProps) {
  const TrendIcon = trend === 'up' ? TrendingUpIcon : trend === 'down' ? TrendingDownIcon : null;

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {icon}
            <h3 className="font-medium text-sm text-muted-foreground">{title}</h3>
          </div>
          {trend && TrendIcon && (
            <Badge variant={trend === 'up' ? 'default' : 'destructive'} className="text-xs">
              <TrendIcon className="w-3 h-3 mr-1" />
              {change && `${Math.abs(change)}%`}
            </Badge>
          )}
        </div>
        <div className="mt-2">
          <div className="text-2xl font-bold">{value}</div>
          {changeLabel && <div className="text-xs text-muted-foreground mt-1">{changeLabel}</div>}
        </div>
      </CardContent>
    </Card>
  );
}

export function ValueMetrics() {
  // Mock data for demonstration
  const metrics = [
    {
      title: 'API Cost Saved',
      value: '$127.50',
      change: 23,
      changeLabel: 'vs last month',
      icon: <DollarSignIcon className="w-4 h-4 text-green-600" />,
      trend: 'up' as const,
    },
    {
      title: 'Tokens Saved',
      value: '2.4M',
      change: 18,
      changeLabel: 'through caching',
      icon: <ZapIcon className="w-4 h-4 text-blue-600" />,
      trend: 'up' as const,
    },
    {
      title: 'Queries Faster',
      value: '43%',
      change: 12,
      changeLabel: 'average speedup',
      icon: <TrendingUpIcon className="w-4 h-4 text-purple-600" />,
      trend: 'up' as const,
    },
    {
      title: 'Errors Reduced',
      value: '-67%',
      change: 67,
      changeLabel: 'with retry logic',
      icon: <TrendingDownIcon className="w-4 h-4 text-red-600" />,
      trend: 'down' as const,
    },
  ];

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Performance Metrics</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((metric, index) => (
          <MetricCard key={index} {...metric} />
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Monthly Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-lg font-semibold">$342.10</div>
              <div className="text-xs text-muted-foreground">Total Saved</div>
            </div>
            <div>
              <div className="text-lg font-semibold">8.7M</div>
              <div className="text-xs text-muted-foreground">Tokens Processed</div>
            </div>
            <div>
              <div className="text-lg font-semibold">1,247</div>
              <div className="text-xs text-muted-foreground">Queries Handled</div>
            </div>
            <div>
              <div className="text-lg font-semibold">99.8%</div>
              <div className="text-xs text-muted-foreground">Uptime</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
