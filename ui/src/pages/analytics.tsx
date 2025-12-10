/**
 * Analytics Page
 *
 * Displays Claude Code usage analytics with charts.
 * Features trend charts, model breakdown, cost analysis, and anomaly detection.
 */

import { useState, useMemo, useRef, useCallback } from 'react';
import type { DateRange } from 'react-day-picker';
import { startOfMonth, subDays, formatDistanceToNow } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverContent, PopoverAnchor } from '@/components/ui/popover';
import { DateRangeFilter } from '@/components/analytics/date-range-filter';
import { UsageSummaryCards } from '@/components/analytics/usage-summary-cards';
import { UsageTrendChart } from '@/components/analytics/usage-trend-chart';
import { ModelBreakdownChart } from '@/components/analytics/model-breakdown-chart';
import { ModelDetailsContent } from '@/components/analytics/model-details-content';
import { SessionStatsCard } from '@/components/analytics/session-stats-card';
import { UsageInsightsCard } from '@/components/analytics/usage-insights-card';
import { TrendingUp, PieChart, RefreshCw, DollarSign, ChevronRight } from 'lucide-react';
import {
  useUsageSummary,
  useUsageTrends,
  useModelUsage,
  useRefreshUsage,
  useUsageStatus,
  useUsageInsights,
  useSessions,
  type ModelUsage,
} from '@/hooks/use-usage';
import { getModelColor } from '@/lib/utils';

// Format token count to human-readable (K/M/B)
function formatTokens(num: number): string {
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(0)}K`;
  return num.toString();
}

export function AnalyticsPage() {
  // Default to last 30 days
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedModel, setSelectedModel] = useState<ModelUsage | null>(null);
  const [popoverPosition, setPopoverPosition] = useState<{ x: number; y: number } | null>(null);
  const popoverAnchorRef = useRef<HTMLDivElement>(null);

  // Refresh hook
  const refreshUsage = useRefreshUsage();

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshUsage();
    } finally {
      setIsRefreshing(false);
    }
  };

  // Convert dates to API format
  const apiOptions = {
    startDate: dateRange?.from,
    endDate: dateRange?.to,
  };

  // Fetch data
  const { data: summary, isLoading: isSummaryLoading } = useUsageSummary(apiOptions);
  const { data: trends, isLoading: isTrendsLoading } = useUsageTrends(apiOptions);
  const { data: models, isLoading: isModelsLoading } = useModelUsage(apiOptions);
  const { data: insights, isLoading: isInsightsLoading } = useUsageInsights(apiOptions);
  const { data: sessions, isLoading: isSessionsLoading } = useSessions({ ...apiOptions, limit: 3 });
  const { data: status } = useUsageStatus();

  // Format "Last updated" text
  const lastUpdatedText = useMemo(() => {
    if (!status?.lastFetch) return null;
    return formatDistanceToNow(new Date(status.lastFetch), { addSuffix: true });
  }, [status?.lastFetch]);

  // Handle model click for popover
  const handleModelClick = useCallback((model: ModelUsage, event: React.MouseEvent) => {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    setPopoverPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
    setSelectedModel(model);
  }, []);

  const handlePopoverClose = useCallback(() => {
    setSelectedModel(null);
    setPopoverPosition(null);
  }, []);

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)] overflow-hidden">
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden p-4 pb-14 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-xl font-semibold">Analytics</h1>
            <p className="text-sm text-muted-foreground">Track usage & insights</p>
          </div>
          <div className="flex items-center gap-2">
            <DateRangeFilter
              value={dateRange}
              onChange={setDateRange}
              presets={[
                { label: '7D', range: { from: subDays(new Date(), 7), to: new Date() } },
                { label: '30D', range: { from: subDays(new Date(), 30), to: new Date() } },
                { label: 'Month', range: { from: startOfMonth(new Date()), to: new Date() } },
                { label: 'All Time', range: { from: undefined, to: new Date() } },
              ]}
            />
            {lastUpdatedText && (
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                Updated {lastUpdatedText}
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              className="gap-2 h-8"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <UsageSummaryCards data={summary} isLoading={isSummaryLoading} />

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-h-0 gap-3">
          {/* Usage Trend Chart - Full Width */}
          <Card className="flex flex-col flex-1 min-h-0 shadow-sm">
            <CardHeader className="px-3 py-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Usage Trends
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3 pt-0 flex-1 min-h-0 flex items-center justify-center">
              <UsageTrendChart data={trends || []} isLoading={isTrendsLoading} className="h-full" />
            </CardContent>
          </Card>

          {/* Bottom Row - Cost by Model (4) + Model Usage (2) + Session Stats (4) */}
          <div className="grid grid-cols-1 lg:grid-cols-10 gap-3 flex-1 min-h-0">
            {/* Cost by Model - 4/10 width with breakdown */}
            <Card className="flex flex-col h-full min-h-0 shadow-sm lg:col-span-4">
              <CardHeader className="px-3 py-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Cost by Model
                </CardTitle>
              </CardHeader>
              <CardContent className="px-2 pb-2 pt-0 flex-1 min-h-0 overflow-y-auto">
                {isModelsLoading ? (
                  <Skeleton className="h-full w-full" />
                ) : (
                  <div className="space-y-0.5">
                    {[...(models || [])]
                      .sort((a, b) => b.cost - a.cost)
                      .map((model) => (
                        <button
                          key={model.model}
                          className="group flex items-center text-xs w-full hover:bg-muted/50 rounded px-2 py-1.5 transition-colors cursor-pointer gap-3"
                          onClick={(e) => handleModelClick(model, e)}
                          title="Click for details"
                        >
                          {/* Model name */}
                          <div className="flex items-center gap-2 min-w-0 w-[180px] shrink-0">
                            <div
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: getModelColor(model.model) }}
                            />
                            <span className="font-medium truncate group-hover:underline underline-offset-2">
                              {model.model}
                            </span>
                          </div>
                          {/* Cost breakdown mini-bar */}
                          <div className="flex-1 flex items-center gap-1 min-w-0">
                            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden flex">
                              <div
                                className="h-full"
                                style={{
                                  backgroundColor: '#335c67',
                                  width: `${model.cost > 0 ? (model.costBreakdown.input.cost / model.cost) * 100 : 0}%`,
                                }}
                                title={`Input: $${model.costBreakdown.input.cost.toFixed(2)}`}
                              />
                              <div
                                className="h-full"
                                style={{
                                  backgroundColor: '#fff3b0',
                                  width: `${model.cost > 0 ? (model.costBreakdown.output.cost / model.cost) * 100 : 0}%`,
                                }}
                                title={`Output: $${model.costBreakdown.output.cost.toFixed(2)}`}
                              />
                              <div
                                className="h-full"
                                style={{
                                  backgroundColor: '#e09f3e',
                                  width: `${model.cost > 0 ? (model.costBreakdown.cacheCreation.cost / model.cost) * 100 : 0}%`,
                                }}
                                title={`Cache Write: $${model.costBreakdown.cacheCreation.cost.toFixed(2)}`}
                              />
                              <div
                                className="h-full"
                                style={{
                                  backgroundColor: '#9e2a2b',
                                  width: `${model.cost > 0 ? (model.costBreakdown.cacheRead.cost / model.cost) * 100 : 0}%`,
                                }}
                                title={`Cache Read: $${model.costBreakdown.cacheRead.cost.toFixed(2)}`}
                              />
                            </div>
                          </div>
                          {/* Token count */}
                          <span className="text-[10px] text-muted-foreground w-14 text-right shrink-0">
                            {formatTokens(model.tokens)}
                          </span>
                          {/* Total cost */}
                          <span className="font-mono font-medium w-16 text-right shrink-0">
                            ${model.cost.toFixed(2)}
                          </span>
                          <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity shrink-0" />
                        </button>
                      ))}
                    {/* Legend */}
                    <div className="flex items-center gap-3 pt-2 px-2 text-[10px] text-muted-foreground border-t mt-2">
                      <span className="flex items-center gap-1">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: '#335c67' }}
                        />
                        Input
                      </span>
                      <span className="flex items-center gap-1">
                        <div
                          className="w-2 h-2 rounded-full border border-muted-foreground/30"
                          style={{ backgroundColor: '#fff3b0' }}
                        />
                        Output
                      </span>
                      <span className="flex items-center gap-1">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: '#e09f3e' }}
                        />
                        Cache Write
                      </span>
                      <span className="flex items-center gap-1">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: '#9e2a2b' }}
                        />
                        Cache Read
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Model Distribution - 2/10 width */}
            <Card className="flex flex-col h-full min-h-0 shadow-sm lg:col-span-2">
              <CardHeader className="px-3 py-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <PieChart className="w-4 h-4" />
                  Model Usage
                </CardTitle>
              </CardHeader>
              <CardContent className="px-2 pb-2 pt-0 flex-1 min-h-0 flex items-center justify-center">
                <ModelBreakdownChart
                  data={models || []}
                  isLoading={isModelsLoading}
                  className="h-full w-full"
                />
              </CardContent>
            </Card>

            {/* Session Stats - 2/10 width */}
            <SessionStatsCard
              data={sessions}
              isLoading={isSessionsLoading}
              className="lg:col-span-2"
            />

            {/* Usage Insights - 2/10 width */}
            <UsageInsightsCard
              anomalies={insights?.anomalies}
              summary={insights?.summary}
              isLoading={isInsightsLoading}
              className="lg:col-span-2"
            />
          </div>

          {/* Model Details Popover - positioned at cursor */}
          <Popover open={!!selectedModel} onOpenChange={(open) => !open && handlePopoverClose()}>
            <PopoverAnchor asChild>
              <div
                ref={popoverAnchorRef}
                className="fixed pointer-events-none"
                style={{
                  left: popoverPosition?.x ?? 0,
                  top: popoverPosition?.y ?? 0,
                  width: 1,
                  height: 1,
                }}
              />
            </PopoverAnchor>
            <PopoverContent className="w-80 p-3" side="top" align="center">
              {selectedModel && <ModelDetailsContent model={selectedModel} />}
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  );
}

export function AnalyticsSkeleton() {
  return (
    <div className="space-y-4 h-full overflow-hidden">
      {/* Usage Trends Skeleton */}
      <Card className="flex flex-col min-h-[300px]">
        <CardHeader className="p-4 pb-2">
          <Skeleton className="h-4 w-32" />
        </CardHeader>
        <CardContent className="p-4 pt-0 flex-1">
          <Skeleton className="h-full w-full" />
        </CardContent>
      </Card>

      {/* Bottom Row Skeletons */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Cost Breakdown Skeleton */}
        <Card className="flex flex-col min-h-[250px]">
          <CardHeader className="p-4 pb-2">
            <Skeleton className="h-4 w-28" />
          </CardHeader>
          <CardContent className="p-4 pt-2">
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Skeleton className="w-2.5 h-2.5 rounded-full" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-3 w-16" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Model Usage Skeleton */}
        <Card className="flex flex-col min-h-[250px]">
          <CardHeader className="p-4 pb-2">
            <Skeleton className="h-4 w-28" />
          </CardHeader>
          <CardContent className="p-4 pt-0 flex-1">
            <div className="flex w-full h-full items-center">
              <div className="flex-1 flex justify-center">
                <Skeleton className="h-[180px] w-[180px] rounded-full" />
              </div>
              <div className="w-[140px] shrink-0 pl-2 space-y-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Skeleton className="w-2 h-2 rounded-full" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
