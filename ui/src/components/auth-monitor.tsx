/**
 * Auth Monitor Component with Account Flow Visualization
 * Shows request flow from accounts to providers using custom SVG bezier curves
 * Uses glass panel aesthetic with hover interactions and glow effects
 */

import { useState, useMemo, useEffect } from 'react';
import { useCliproxyAuth } from '@/hooks/use-cliproxy';
import { useCliproxyStats, type AccountUsageStats } from '@/hooks/use-cliproxy-stats';
import { cn, STATUS_COLORS } from '@/lib/utils';
import { getProviderDisplayName, PROVIDER_COLORS } from '@/lib/provider-config';
import { Skeleton } from '@/components/ui/skeleton';
import { ProviderIcon } from '@/components/provider-icon';
import { AccountFlowViz } from '@/components/account-flow-viz';
import { usePrivacy } from '@/contexts/privacy-context';
import type { AuthStatus, OAuthAccount } from '@/lib/api-client';
import { Activity, CheckCircle2, XCircle, ChevronRight, Radio } from 'lucide-react';

interface AccountRow {
  id: string;
  email: string;
  provider: string;
  displayName: string;
  isDefault: boolean;
  successCount: number;
  failureCount: number;
  lastUsedAt?: string;
  color: string;
}

interface ProviderStats {
  provider: string;
  displayName: string;
  totalRequests: number;
  successCount: number;
  failureCount: number;
  accountCount: number;
  accounts: AccountRow[];
}

function getSuccessRate(success: number, failure: number): number {
  const total = success + failure;
  if (total === 0) return 100;
  return Math.round((success / total) * 100);
}

/** Strip common email domains for cleaner display */
function cleanEmail(email: string): string {
  return email.replace(/@(gmail|yahoo|hotmail|outlook|icloud)\.com$/i, '');
}

// Vibrant colors for account segments - darker for light theme contrast
const ACCOUNT_COLORS = [
  '#1e6091', // Deep Cerulean (was #277da1)
  '#2d8a6e', // Deep Seaweed (was #43aa8b)
  '#d4a012', // Dark Tuscan (was #f9c74f)
  '#c92a2d', // Deep Strawberry (was #f94144)
  '#c45a1a', // Deep Pumpkin (was #f3722c)
  '#6b9c4d', // Dark Willow (was #90be6d)
  '#3d5a73', // Deep Blue Slate (was #577590)
  '#cc7614', // Dark Carrot (was #f8961e)
  '#3a7371', // Deep Cyan (was #4d908e)
  '#7c5fc4', // Deep Purple (was #a78bfa)
];

/** Enhanced live pulse indicator with multi-ring animation */
function LivePulse() {
  return (
    <div className="relative flex items-center justify-center w-5 h-5">
      {/* Outer ping ring */}
      <div
        className="absolute w-4 h-4 rounded-full animate-ping opacity-20"
        style={{ backgroundColor: STATUS_COLORS.success }}
      />
      {/* Middle pulse ring */}
      <div
        className="absolute w-3 h-3 rounded-full animate-pulse opacity-40"
        style={{ backgroundColor: STATUS_COLORS.success }}
      />
      {/* Inner solid dot */}
      <div
        className="relative w-2 h-2 rounded-full z-10"
        style={{ backgroundColor: STATUS_COLORS.success }}
      />
    </div>
  );
}

/** Inline success/failure badge for provider cards */
function InlineStatsBadge({ success, failure }: { success: number; failure: number }) {
  if (success === 0 && failure === 0) {
    return <span className="text-[9px] text-muted-foreground/50 font-mono">no activity</span>;
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-0.5">
        <CheckCircle2 className="w-3 h-3 text-emerald-700 dark:text-emerald-500" />
        <span className="text-[10px] font-mono font-medium text-emerald-700 dark:text-emerald-500">
          {success.toLocaleString()}
        </span>
      </div>
      {failure > 0 && (
        <div className="flex items-center gap-0.5">
          <XCircle className="w-3 h-3 text-red-700 dark:text-red-500" />
          <span className="text-[10px] font-mono font-medium text-red-700 dark:text-red-500">
            {failure.toLocaleString()}
          </span>
        </div>
      )}
    </div>
  );
}

export function AuthMonitor() {
  const { data, isLoading, error } = useCliproxyAuth();
  const { data: statsData, isLoading: statsLoading, dataUpdatedAt } = useCliproxyStats();
  const { privacyMode } = usePrivacy();
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [hoveredProvider, setHoveredProvider] = useState<string | null>(null);
  const [timeSinceUpdate, setTimeSinceUpdate] = useState('');

  // Live countdown showing time since last data update
  useEffect(() => {
    if (!dataUpdatedAt) return;
    const updateTime = () => {
      const diff = Math.floor((Date.now() - dataUpdatedAt) / 1000);
      if (diff < 60) {
        setTimeSinceUpdate(`${diff}s ago`);
      } else {
        setTimeSinceUpdate(`${Math.floor(diff / 60)}m ago`);
      }
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [dataUpdatedAt]);

  // Build a map of account email -> usage stats from CLIProxy
  const accountStatsMap = useMemo(() => {
    if (!statsData?.accountStats) return new Map<string, AccountUsageStats>();
    return new Map(Object.entries(statsData.accountStats));
  }, [statsData?.accountStats]);

  // Transform auth status data into account rows
  const { accounts, totalSuccess, totalFailure, totalRequests, providerStats } = useMemo(() => {
    if (!data?.authStatus) {
      return {
        accounts: [],
        totalSuccess: 0,
        totalFailure: 0,
        totalRequests: 0,
        providerStats: [],
      };
    }

    const accountsList: AccountRow[] = [];
    const providerMap = new Map<
      string,
      { success: number; failure: number; accounts: AccountRow[] }
    >();
    let tSuccess = 0;
    let tFailure = 0;
    let colorIndex = 0;

    data.authStatus.forEach((status: AuthStatus) => {
      const providerKey = status.provider;
      if (!providerMap.has(providerKey)) {
        providerMap.set(providerKey, { success: 0, failure: 0, accounts: [] });
      }
      const providerData = providerMap.get(providerKey);
      if (!providerData) return;

      status.accounts?.forEach((account: OAuthAccount) => {
        // Get real stats from CLIProxy - try email first, then id
        const accountEmail = account.email || account.id;
        const realStats = accountStatsMap.get(accountEmail);
        const success = realStats?.successCount ?? 0;
        const failure = realStats?.failureCount ?? 0;
        tSuccess += success;
        tFailure += failure;
        providerData.success += success;
        providerData.failure += failure;

        const row: AccountRow = {
          id: account.id,
          email: account.email || account.id,
          provider: status.provider,
          displayName: status.displayName,
          isDefault: account.isDefault,
          successCount: success,
          failureCount: failure,
          lastUsedAt: realStats?.lastUsedAt ?? account.lastUsedAt,
          color: ACCOUNT_COLORS[colorIndex % ACCOUNT_COLORS.length],
        };
        accountsList.push(row);
        providerData.accounts.push(row);
        colorIndex++;
      });
    });

    // Build provider stats array
    const providerStatsArr: ProviderStats[] = [];
    providerMap.forEach((pData, provider) => {
      if (pData.accounts.length === 0) return;
      providerStatsArr.push({
        provider,
        displayName: getProviderDisplayName(provider),
        totalRequests: pData.success + pData.failure,
        successCount: pData.success,
        failureCount: pData.failure,
        accountCount: pData.accounts.length,
        accounts: pData.accounts,
      });
    });
    providerStatsArr.sort((a, b) => b.totalRequests - a.totalRequests);

    return {
      accounts: accountsList,
      totalSuccess: tSuccess,
      totalFailure: tFailure,
      totalRequests: tSuccess + tFailure,
      providerStats: providerStatsArr,
    };
  }, [data?.authStatus, accountStatsMap]);

  const overallSuccessRate =
    totalRequests > 0 ? Math.round((totalSuccess / totalRequests) * 100) : 100;

  // Get selected provider data for detail view
  const selectedProviderData = selectedProvider
    ? providerStats.find((ps) => ps.provider === selectedProvider)
    : null;

  if (isLoading || statsLoading) {
    return (
      <div className="rounded-xl border border-border overflow-hidden font-mono text-[13px] bg-card/50 dark:bg-zinc-900/60 backdrop-blur-sm">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-20" />
        </div>
        <div className="p-4 space-y-4">
          <div className="flex gap-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-16 flex-1 rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-48 w-full rounded-lg" />
        </div>
      </div>
    );
  }

  if (error || !data?.authStatus || accounts.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border border-border overflow-hidden font-mono text-[13px] text-foreground bg-card/50 dark:bg-zinc-900/60 backdrop-blur-sm">
      {/* Enhanced Live Header with gradient glow */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-gradient-to-r from-emerald-500/5 via-transparent to-transparent dark:from-emerald-500/10">
        <div className="flex items-center gap-2">
          <LivePulse />
          <span className="text-xs font-semibold tracking-tight text-foreground">LIVE</span>
          <span className="text-[10px] text-muted-foreground">Account Monitor</span>
        </div>
        <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Radio className="w-3 h-3 animate-pulse" />
            <span>Updated {timeSinceUpdate || 'now'}</span>
          </div>
          <span className="text-muted-foreground/50">|</span>
          <span>{accounts.length} accounts</span>
          <span className="font-mono">{totalRequests.toLocaleString()} req</span>
        </div>
      </div>

      {/* Summary Stats Row */}
      <div className="grid grid-cols-4 gap-3 p-4 border-b border-border bg-muted/20 dark:bg-zinc-900/30">
        <SummaryCard
          icon={<Activity className="w-4 h-4" />}
          label="Accounts"
          value={accounts.length}
          color="var(--accent)"
        />
        <SummaryCard
          icon={<CheckCircle2 className="w-4 h-4" />}
          label="Success"
          value={totalSuccess.toLocaleString()}
          color={STATUS_COLORS.success}
        />
        <SummaryCard
          icon={<XCircle className="w-4 h-4" />}
          label="Failed"
          value={totalFailure.toLocaleString()}
          color={totalFailure > 0 ? STATUS_COLORS.failed : undefined}
        />
        <SummaryCard
          icon={<Activity className="w-4 h-4" />}
          label="Success Rate"
          value={`${overallSuccessRate}%`}
          color={
            overallSuccessRate === 100
              ? STATUS_COLORS.success
              : overallSuccessRate >= 95
                ? STATUS_COLORS.degraded
                : STATUS_COLORS.failed
          }
        />
      </div>

      {/* Flow Visualization */}
      <div className="relative overflow-hidden">
        {selectedProviderData ? (
          // Account-level flow view
          <AccountFlowViz
            providerData={selectedProviderData}
            onBack={() => setSelectedProvider(null)}
          />
        ) : (
          // Provider cards view
          <div className="p-6">
            <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-4">
              Request Distribution by Provider
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              {providerStats.map((ps) => {
                const successRate = getSuccessRate(ps.successCount, ps.failureCount);
                const providerColor = PROVIDER_COLORS[ps.provider.toLowerCase()] || '#6b7280';
                const isHovered = hoveredProvider === ps.provider;

                return (
                  <button
                    key={ps.provider}
                    onClick={() => setSelectedProvider(ps.provider)}
                    onMouseEnter={() => setHoveredProvider(ps.provider)}
                    onMouseLeave={() => setHoveredProvider(null)}
                    className={cn(
                      'group relative rounded-xl p-4 text-left transition-all duration-300',
                      'bg-muted/30 dark:bg-zinc-900/60 backdrop-blur-sm',
                      'border border-border/50 dark:border-white/[0.08]',
                      'hover:border-opacity-50 hover:scale-[1.02] hover:shadow-lg',
                      isHovered && 'ring-1'
                    )}
                    style={
                      {
                        borderColor: isHovered ? providerColor : undefined,
                        '--ring-color': providerColor,
                      } as React.CSSProperties
                    }
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <ProviderIcon provider={ps.provider} size={36} withBackground />
                      <div>
                        <h3 className="text-sm font-semibold text-foreground tracking-tight">
                          {ps.displayName}
                        </h3>
                        <p className="text-[10px] text-muted-foreground">
                          {ps.accountCount} account{ps.accountCount !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <ChevronRight
                        className={cn(
                          'w-4 h-4 ml-auto text-muted-foreground transition-all',
                          isHovered ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2'
                        )}
                      />
                    </div>

                    <div className="space-y-2">
                      {/* Inline success/failure stats - immediately visible */}
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-muted-foreground">Stats</span>
                        <InlineStatsBadge success={ps.successCount} failure={ps.failureCount} />
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Success Rate</span>
                        <span
                          className="font-mono font-semibold"
                          style={{
                            color:
                              successRate === 100
                                ? STATUS_COLORS.success
                                : successRate >= 95
                                  ? STATUS_COLORS.degraded
                                  : STATUS_COLORS.failed,
                          }}
                        >
                          {successRate}%
                        </span>
                      </div>
                      {/* Progress bar */}
                      <div className="w-full bg-muted dark:bg-zinc-800/50 h-1 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${successRate}%`,
                            backgroundColor: providerColor,
                          }}
                        />
                      </div>
                    </div>

                    {/* Account color dots */}
                    <div className="flex gap-1 mt-3">
                      {ps.accounts.slice(0, 5).map((acc) => (
                        <div
                          key={acc.id}
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: acc.color }}
                          title={privacyMode ? '••••••' : cleanEmail(acc.email)}
                        />
                      ))}
                      {ps.accounts.length > 5 && (
                        <span className="text-[10px] text-muted-foreground ml-1">
                          +{ps.accounts.length - 5}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Summary Card Component
function SummaryCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-card/50 dark:bg-zinc-900/50 border border-border/50 dark:border-white/[0.06]">
      <div
        className="w-8 h-8 rounded-md flex items-center justify-center"
        style={{
          backgroundColor: color ? `${color}15` : 'var(--muted)',
          color: color || 'var(--muted-foreground)',
        }}
      >
        {icon}
      </div>
      <div>
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</div>
        <div
          className="text-lg font-semibold font-mono leading-tight"
          style={{ color: color || 'var(--foreground)' }}
        >
          {value}
        </div>
      </div>
    </div>
  );
}
