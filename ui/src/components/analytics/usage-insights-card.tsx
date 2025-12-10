import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CheckCircle2, Zap, Gauge, DollarSign, Database, Lightbulb } from 'lucide-react';
import type { Anomaly, AnomalySummary, AnomalyType } from '@/hooks/use-usage';
import { cn } from '@/lib/utils';

interface UsageInsightsCardProps {
  anomalies?: Anomaly[];
  summary?: AnomalySummary;
  isLoading?: boolean;
  className?: string;
}

const ANOMALY_CONFIG: Record<
  AnomalyType,
  {
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    label: string;
    description: string;
  }
> = {
  high_input: {
    icon: Zap,
    color: 'text-yellow-600 dark:text-yellow-400',
    label: 'High Input',
    description: 'Unusually high input token usage detected.',
  },
  high_io_ratio: {
    icon: Gauge,
    color: 'text-orange-600 dark:text-orange-400',
    label: 'High I/O Ratio',
    description: 'Output tokens are significantly higher than input tokens.',
  },
  cost_spike: {
    icon: DollarSign,
    color: 'text-red-600 dark:text-red-400',
    label: 'Cost Spike',
    description: 'Daily cost is significantly higher than average.',
  },
  high_cache_read: {
    icon: Database,
    color: 'text-cyan-600 dark:text-cyan-400',
    label: 'Heavy Caching',
    description: 'High volume of cache read operations.',
  },
};

export function UsageInsightsCard({
  anomalies = [],
  summary,
  isLoading,
  className,
}: UsageInsightsCardProps) {
  if (isLoading) {
    return (
      <Card className={cn('flex flex-col h-full', className)}>
        <CardHeader className="px-4 py-3 border-b">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-muted-foreground" />
            Usage Insights
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 flex-1 flex items-center justify-center">
          <div className="animate-pulse flex flex-col items-center gap-2 opacity-50">
            <div className="h-8 w-8 bg-muted rounded-full" />
            <div className="h-4 w-32 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const hasAnomalies = summary && summary.totalAnomalies > 0;

  return (
    <Card className={cn('flex flex-col h-full overflow-hidden', className)}>
      <CardHeader className="px-4 py-3 border-b bg-muted/5">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Lightbulb
              className={cn('w-4 h-4', hasAnomalies ? 'text-amber-500' : 'text-green-500')}
            />
            Usage Insights
          </CardTitle>
          {hasAnomalies ? (
            <Badge
              variant="destructive"
              className="h-5 px-1.5 text-[10px] uppercase font-bold tracking-wider"
            >
              Attention Needed
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="h-5 px-1.5 text-[10px] uppercase font-bold tracking-wider text-green-600 border-green-200 bg-green-50 dark:bg-green-900/10 dark:border-green-800"
            >
              Healthy
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-0 flex-1 min-h-0 flex flex-col">
        {hasAnomalies ? (
          <ScrollArea className="flex-1">
            <div className="divide-y">
              {anomalies.map((anomaly, index) => {
                const config = ANOMALY_CONFIG[anomaly.type];
                const Icon = config.icon;

                return (
                  <div key={index} className="p-4 hover:bg-muted/50 transition-colors">
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          'p-2 rounded-lg shrink-0 bg-muted/30',
                          config.color
                            .replace('text-', 'bg-')
                            .replace('600', '100')
                            .replace('400', '900/20')
                        )}
                      >
                        <Icon className={cn('h-4 w-4', config.color)} />
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium text-sm">{config.label}</p>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {anomaly.date}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {anomaly.message}
                        </p>
                        {anomaly.model && (
                          <div className="pt-1">
                            <Badge
                              variant="secondary"
                              className="text-[10px] px-1 py-0 h-5 font-mono"
                            >
                              {anomaly.model}
                            </Badge>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-muted-foreground">
            <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center mb-3">
              <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <p className="font-medium text-foreground">No anomalies detected</p>
            <p className="text-xs mt-1 max-w-[200px]">
              Your usage patterns look normal for the selected period.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
