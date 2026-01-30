/**
 * Shared Quota Tooltip Content Component
 * Displays provider-specific quota information in tooltips
 */

import { Clock } from 'lucide-react';
import {
  cn,
  formatResetTime,
  getModelsWithTiers,
  groupModelsByTier,
  isAgyQuotaResult,
  isCodexQuotaResult,
  isGeminiQuotaResult,
  type ModelTier,
  type UnifiedQuotaResult,
} from '@/lib/utils';

interface QuotaTooltipContentProps {
  quota: UnifiedQuotaResult;
  resetTime: string | null;
}

/**
 * Renders provider-specific quota tooltip content
 * Uses type guards for proper TypeScript narrowing
 */
export function QuotaTooltipContent({ quota, resetTime }: QuotaTooltipContentProps) {
  if (!quota?.success) return null;

  // Antigravity (agy) provider tooltip
  if (isAgyQuotaResult(quota)) {
    const tiered = getModelsWithTiers(quota.models || []);
    const groups = groupModelsByTier(tiered);
    const tierOrder: ModelTier[] = ['primary', 'gemini-3', 'gemini-2', 'other'];

    return (
      <div className="text-xs space-y-1">
        <p className="font-medium">Model Quotas:</p>
        {tierOrder.map((tier, idx) => {
          const models = groups.get(tier);
          if (!models || models.length === 0) return null;
          const isFirst = tierOrder.slice(0, idx).every((t) => !groups.get(t)?.length);
          return (
            <div key={tier}>
              {!isFirst && <div className="border-t border-border/40 my-1" />}
              {models.map((m) => (
                <div key={m.name} className="flex justify-between gap-4">
                  <span className={cn('truncate', m.exhausted && 'text-red-500')}>
                    {m.displayName}
                  </span>
                  <span className={cn('font-mono', m.exhausted && 'text-red-500')}>
                    {m.percentage}%
                  </span>
                </div>
              ))}
            </div>
          );
        })}
        <ResetTimeIndicator resetTime={resetTime} />
      </div>
    );
  }

  // Codex provider tooltip
  if (isCodexQuotaResult(quota)) {
    return (
      <div className="text-xs space-y-1">
        <p className="font-medium">Rate Limits:</p>
        {quota.planType && <p className="text-muted-foreground">Plan: {quota.planType}</p>}
        {quota.windows.map((w) => (
          <div key={w.label} className="flex justify-between gap-4">
            <span className={cn(w.remainingPercent < 20 && 'text-red-500')}>{w.label}</span>
            <span className="font-mono">{w.remainingPercent}%</span>
          </div>
        ))}
        <ResetTimeIndicator resetTime={resetTime} />
      </div>
    );
  }

  // Gemini provider tooltip
  if (isGeminiQuotaResult(quota)) {
    return (
      <div className="text-xs space-y-1">
        <p className="font-medium">Buckets:</p>
        {quota.buckets.map((b) => (
          <div key={b.id} className="flex justify-between gap-4">
            <span className={cn(b.remainingPercent < 20 && 'text-red-500')}>
              {b.label}
              {b.tokenType ? ` (${b.tokenType})` : ''}
            </span>
            <span className="font-mono">{b.remainingPercent}%</span>
          </div>
        ))}
        <ResetTimeIndicator resetTime={resetTime} />
      </div>
    );
  }

  return null;
}

/**
 * Reset time indicator shown at bottom of tooltip
 */
function ResetTimeIndicator({ resetTime }: { resetTime: string | null }) {
  if (!resetTime) return null;

  return (
    <div className="flex items-center gap-1.5 pt-1 border-t border-border/50">
      <Clock className="w-3 h-3 text-blue-400" />
      <span className="text-blue-400 font-medium">Resets {formatResetTime(resetTime)}</span>
    </div>
  );
}
