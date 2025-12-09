/**
 * Usage Analytics API Routes
 *
 * Provides REST endpoints for Claude Code usage analytics using better-ccusage library.
 * Supports daily, monthly, and session-based usage data aggregation.
 *
 * Performance optimizations:
 * - Persistent disk cache to avoid re-parsing JSONL files on startup
 * - TTL-based in-memory caching for fast repeated requests
 * - Request coalescing to prevent duplicate concurrent requests
 * - Non-blocking prewarm with instant stale data serving
 */

import { Router, Request, Response } from 'express';
import {
  loadDailyUsageData,
  loadMonthlyUsageData,
  loadSessionData,
  type DailyUsage,
  type MonthlyUsage,
  type SessionUsage,
} from 'better-ccusage/data-loader';
import {
  readDiskCache,
  writeDiskCache,
  isDiskCacheFresh,
  isDiskCacheStale,
  clearDiskCache,
  getCacheAge,
} from './usage-disk-cache';

export const usageRoutes = Router();

/** Query parameters for usage endpoints */
interface UsageQuery {
  since?: string; // YYYYMMDD format
  until?: string; // YYYYMMDD format
  limit?: string;
  offset?: string;
}

// Constants for validation
const MAX_LIMIT = 1000;
const DEFAULT_LIMIT = 50;
const DATE_REGEX = /^\d{8}$/; // YYYYMMDD format

// ============================================================================
// Caching Layer - Reduces better-ccusage library calls
// ============================================================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

// Cache TTLs (milliseconds)
const CACHE_TTL = {
  daily: 60 * 1000, // 1 minute - changes frequently
  monthly: 5 * 60 * 1000, // 5 minutes - aggregated data
  session: 60 * 1000, // 1 minute - user may refresh
};

/// Stale-while-revalidate: max age for stale data (7 days)
// We always show cached data to avoid blocking UI, refresh happens in background
const STALE_TTL = 7 * 24 * 60 * 60 * 1000;

// Track when data was last fetched (for UI indicator)
let lastFetchTimestamp: number | null = null;

/** Get timestamp of last successful data fetch */
export function getLastFetchTimestamp(): number | null {
  return lastFetchTimestamp;
}

// In-memory cache
const cache = new Map<string, CacheEntry<unknown>>();

// Pending requests for coalescing (prevents duplicate concurrent calls)
const pendingRequests = new Map<string, Promise<unknown>>();

// Track if disk cache has been loaded into memory
let diskCacheInitialized = false;

/**
 * Persist cache to disk when we have enough data to be useful.
 * Writes immediately with whatever data is available (empty arrays for missing).
 * This ensures disk cache is created after first Analytics page visit.
 */
function persistCacheIfComplete(): void {
  const daily = cache.get('daily') as CacheEntry<DailyUsage[]> | undefined;
  const monthly = cache.get('monthly') as CacheEntry<MonthlyUsage[]> | undefined;
  const session = cache.get('session') as CacheEntry<SessionUsage[]> | undefined;

  // Write if we have at least daily data (the most essential)
  if (daily) {
    writeDiskCache(daily.data, monthly?.data ?? [], session?.data ?? []);
  }
}

/**
 * Get cached data or fetch from loader with TTL
 * Also coalesces concurrent requests to prevent duplicate library calls
 * Implements stale-while-revalidate pattern for instant responses
 */
async function getCachedData<T>(key: string, ttl: number, loader: () => Promise<T>): Promise<T> {
  // Ensure disk cache is loaded on first request
  ensureDiskCacheLoaded();

  const cached = cache.get(key) as CacheEntry<T> | undefined;
  const now = Date.now();

  // Fresh cache - return immediately
  if (cached && now - cached.timestamp < ttl) {
    return cached.data;
  }

  // Stale cache - return immediately, refresh in background (SWR pattern)
  if (cached && now - cached.timestamp < STALE_TTL) {
    // Fire and forget background refresh if not already pending
    if (!pendingRequests.has(key)) {
      const promise = loader()
        .then((data) => {
          cache.set(key, { data, timestamp: Date.now() });
          lastFetchTimestamp = Date.now();
          // Persist to disk if all data types are cached
          persistCacheIfComplete();
        })
        .catch((err) => {
          console.error(`[!] Background refresh failed for ${key}:`, err);
        })
        .finally(() => {
          pendingRequests.delete(key);
        });
      pendingRequests.set(key, promise);
    }
    return cached.data;
  }

  // No usable cache - check if request is already pending (coalesce)
  const pending = pendingRequests.get(key) as Promise<T> | undefined;
  if (pending) {
    return pending;
  }

  // Create new request
  const promise = loader()
    .then((data) => {
      cache.set(key, { data, timestamp: Date.now() });
      lastFetchTimestamp = Date.now();
      // Persist to disk if all data types are cached
      persistCacheIfComplete();
      return data;
    })
    .finally(() => {
      pendingRequests.delete(key);
    });

  pendingRequests.set(key, promise);
  return promise;
}

/** Cached loader for daily usage data */
async function getCachedDailyData(): Promise<DailyUsage[]> {
  return getCachedData('daily', CACHE_TTL.daily, async () => {
    return (await loadDailyUsageData()) as DailyUsage[];
  });
}

/** Cached loader for monthly usage data */
async function getCachedMonthlyData(): Promise<MonthlyUsage[]> {
  return getCachedData('monthly', CACHE_TTL.monthly, async () => {
    return (await loadMonthlyUsageData()) as MonthlyUsage[];
  });
}

/** Cached loader for session data */
async function getCachedSessionData(): Promise<SessionUsage[]> {
  return getCachedData('session', CACHE_TTL.session, async () => {
    return (await loadSessionData()) as SessionUsage[];
  });
}

/**
 * Clear all cached data (useful for manual refresh)
 */
export function clearUsageCache(): void {
  cache.clear();
  clearDiskCache();
  // Reset so next API call will try to reload from disk/source
  diskCacheInitialized = false;
}

// Track if background refresh is in progress
let isRefreshing = false;

/**
 * Load fresh data from better-ccusage and update both memory and disk caches
 */
async function refreshFromSource(): Promise<{
  daily: DailyUsage[];
  monthly: MonthlyUsage[];
  session: SessionUsage[];
}> {
  const [daily, monthly, session] = await Promise.all([
    loadDailyUsageData() as Promise<DailyUsage[]>,
    loadMonthlyUsageData() as Promise<MonthlyUsage[]>,
    loadSessionData() as Promise<SessionUsage[]>,
  ]);

  // Update in-memory cache
  const now = Date.now();
  cache.set('daily', { data: daily, timestamp: now });
  cache.set('monthly', { data: monthly, timestamp: now });
  cache.set('session', { data: session, timestamp: now });
  lastFetchTimestamp = now;

  // Persist to disk
  writeDiskCache(daily, monthly, session);

  return { daily, monthly, session };
}

// ============================================================================
// Module Initialization - Load disk cache immediately for instant API responses
// ============================================================================

/**
 * Initialize in-memory cache from disk cache (lazy - called on first API request).
 * This ensures first API request gets instant data without calling better-ccusage.
 * Background refresh is NOT triggered here - it happens via SWR pattern in getCachedData().
 */
function ensureDiskCacheLoaded(): void {
  if (diskCacheInitialized) return;
  diskCacheInitialized = true;

  const diskCache = readDiskCache();
  if (!diskCache) return;

  // Load disk cache into memory (regardless of freshness)
  // SWR pattern in getCachedData() will handle background refresh
  cache.set('daily', { data: diskCache.daily, timestamp: diskCache.timestamp });
  cache.set('monthly', { data: diskCache.monthly, timestamp: diskCache.timestamp });
  cache.set('session', { data: diskCache.session, timestamp: diskCache.timestamp });
  lastFetchTimestamp = diskCache.timestamp;
}

/**
 * Pre-warm usage caches on server startup
 *
 * Strategy:
 * 1. Check disk cache - if fresh, use it (instant startup)
 * 2. If stale, use it immediately but trigger background refresh
 * 3. If no cache, return immediately and let first request trigger load
 *
 * This ensures dashboard opens in <1s regardless of cache state
 */
export async function prewarmUsageCache(): Promise<{
  timestamp: number;
  elapsed: number;
  source: string;
}> {
  const start = Date.now();
  console.log('[i] Pre-warming usage cache...');

  try {
    const diskCache = readDiskCache();

    // Fresh disk cache - use it directly
    if (diskCache && isDiskCacheFresh(diskCache)) {
      const now = Date.now();
      cache.set('daily', { data: diskCache.daily, timestamp: diskCache.timestamp });
      cache.set('monthly', { data: diskCache.monthly, timestamp: diskCache.timestamp });
      cache.set('session', { data: diskCache.session, timestamp: diskCache.timestamp });
      lastFetchTimestamp = diskCache.timestamp;

      const elapsed = Date.now() - start;
      console.log(
        `[OK] Usage cache ready from disk (${elapsed}ms, cached ${getCacheAge(diskCache)})`
      );
      return { timestamp: now, elapsed, source: 'disk-fresh' };
    }

    // Stale disk cache - use it immediately, refresh in background
    if (diskCache && isDiskCacheStale(diskCache)) {
      const now = Date.now();
      cache.set('daily', { data: diskCache.daily, timestamp: diskCache.timestamp });
      cache.set('monthly', { data: diskCache.monthly, timestamp: diskCache.timestamp });
      cache.set('session', { data: diskCache.session, timestamp: diskCache.timestamp });
      lastFetchTimestamp = diskCache.timestamp;

      const elapsed = Date.now() - start;
      console.log(
        `[OK] Usage cache ready from disk (${elapsed}ms, stale ${getCacheAge(diskCache)}, refreshing...)`
      );

      // Background refresh
      if (!isRefreshing) {
        isRefreshing = true;
        refreshFromSource()
          .then(() => console.log('[OK] Background refresh complete'))
          .catch((err) => console.error('[!] Background refresh failed:', err))
          .finally(() => {
            isRefreshing = false;
          });
      }

      return { timestamp: now, elapsed, source: 'disk-stale' };
    }

    // No usable disk cache - refresh from source (blocking for first startup only)
    console.log('[i] No disk cache, loading from source...');
    await refreshFromSource();

    const elapsed = Date.now() - start;
    console.log(`[OK] Usage cache ready (${elapsed}ms)`);
    return { timestamp: Date.now(), elapsed, source: 'fresh' };
  } catch (err) {
    console.error('[!] Failed to prewarm usage cache:', err);
    throw err;
  }
}

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validate date string in YYYYMMDD format
 */
function validateDate(dateString?: string): string | undefined {
  if (!dateString) return undefined;

  if (!DATE_REGEX.test(dateString)) {
    throw new Error('Invalid date format. Use YYYYMMDD');
  }

  // Basic range check
  const year = parseInt(dateString.substring(0, 4), 10);
  const month = parseInt(dateString.substring(4, 6), 10);
  const day = parseInt(dateString.substring(6, 8), 10);

  if (year < 2024 || year > 2100) throw new Error('Year out of valid range');
  if (month < 1 || month > 12) throw new Error('Month out of valid range');
  if (day < 1 || day > 31) throw new Error('Day out of valid range');

  return dateString;
}

/**
 * Validate and parse limit parameter
 */
function validateLimit(limit?: string): number {
  if (!limit) return DEFAULT_LIMIT;

  const num = parseInt(limit, 10);
  if (isNaN(num) || num < 1 || num > MAX_LIMIT) {
    throw new Error(`Limit must be between 1 and ${MAX_LIMIT}`);
  }

  return num;
}

/**
 * Validate and parse offset parameter
 */
function validateOffset(offset?: string): number {
  if (!offset) return 0;

  const num = parseInt(offset, 10);
  if (isNaN(num) || num < 0) {
    throw new Error('Offset must be a non-negative number');
  }

  return num;
}

/**
 * Filter data by date range
 */
function filterByDateRange<T extends { date?: string; month?: string; lastActivity?: string }>(
  data: T[],
  since?: string,
  until?: string
): T[] {
  if (!since && !until) return data;

  return data.filter((item) => {
    // Get the date field (prioritize date, then month, then lastActivity)
    const itemDate =
      item.date || item.month?.replace('-', '') || item.lastActivity?.replace(/-/g, '');
    if (!itemDate) return true;

    // Normalize to YYYYMMDD for comparison
    const normalizedDate = itemDate.replace(/-/g, '').substring(0, 8);

    if (since && normalizedDate < since) return false;
    if (until && normalizedDate > until) return false;

    return true;
  });
}

/**
 * Create standard error response
 */
function errorResponse(res: Response, error: unknown, defaultMessage: string): void {
  console.error(defaultMessage + ':', error);

  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  const isValidationError =
    errorMessage.includes('Invalid') ||
    errorMessage.includes('format') ||
    errorMessage.includes('range') ||
    errorMessage.includes('must be');

  const statusCode = isValidationError ? 400 : 500;

  res.status(statusCode).json({
    success: false,
    error: isValidationError ? errorMessage : defaultMessage,
  });
}

/**
 * GET /api/usage/summary
 *
 * Returns usage summary data for quick dashboard display.
 * Query: ?since=YYYYMMDD&until=YYYYMMDD
 */
usageRoutes.get(
  '/summary',
  async (req: Request<object, object, object, UsageQuery>, res: Response) => {
    try {
      const since = validateDate(req.query.since);
      const until = validateDate(req.query.until);

      const dailyData = await getCachedDailyData();
      const filtered = filterByDateRange(dailyData, since, until);

      // Calculate totals
      let totalInputTokens = 0;
      let totalOutputTokens = 0;
      let totalCacheTokens = 0;
      let totalCost = 0;

      for (const day of filtered) {
        totalInputTokens += day.inputTokens;
        totalOutputTokens += day.outputTokens;
        totalCacheTokens += day.cacheCreationTokens + day.cacheReadTokens;
        totalCost += day.totalCost;
      }

      const totalTokens = totalInputTokens + totalOutputTokens;

      res.json({
        success: true,
        data: {
          totalTokens,
          totalInputTokens,
          totalOutputTokens,
          totalCacheTokens,
          totalCost: Math.round(totalCost * 100) / 100,
          totalDays: filtered.length,
          averageTokensPerDay: filtered.length > 0 ? Math.round(totalTokens / filtered.length) : 0,
          averageCostPerDay:
            filtered.length > 0 ? Math.round((totalCost / filtered.length) * 100) / 100 : 0,
        },
      });
    } catch (error) {
      errorResponse(res, error, 'Failed to fetch usage summary');
    }
  }
);

/**
 * GET /api/usage/daily
 *
 * Returns daily usage trends for chart visualization.
 * Query: ?since=YYYYMMDD&until=YYYYMMDD
 */
usageRoutes.get(
  '/daily',
  async (req: Request<object, object, object, UsageQuery>, res: Response) => {
    try {
      const since = validateDate(req.query.since);
      const until = validateDate(req.query.until);

      const dailyData = await getCachedDailyData();
      const filtered = filterByDateRange(dailyData, since, until);

      // Transform for chart consumption
      const trends = filtered.map((day) => ({
        date: day.date,
        tokens: day.inputTokens + day.outputTokens,
        inputTokens: day.inputTokens,
        outputTokens: day.outputTokens,
        cacheTokens: day.cacheCreationTokens + day.cacheReadTokens,
        cost: Math.round(day.totalCost * 100) / 100,
        modelsUsed: day.modelsUsed.length,
      }));

      res.json({
        success: true,
        data: trends,
      });
    } catch (error) {
      errorResponse(res, error, 'Failed to fetch daily usage');
    }
  }
);

/**
 * GET /api/usage/models
 *
 * Returns usage breakdown by model for pie/bar charts.
 * Query: ?since=YYYYMMDD&until=YYYYMMDD
 */
usageRoutes.get(
  '/models',
  async (req: Request<object, object, object, UsageQuery>, res: Response) => {
    try {
      const since = validateDate(req.query.since);
      const until = validateDate(req.query.until);

      const dailyData = await getCachedDailyData();
      const filtered = filterByDateRange(dailyData, since, until);

      // Aggregate model usage across all days
      const modelMap = new Map<
        string,
        {
          model: string;
          inputTokens: number;
          outputTokens: number;
          cacheTokens: number;
          cost: number;
        }
      >();

      for (const day of filtered) {
        for (const breakdown of day.modelBreakdowns) {
          const existing = modelMap.get(breakdown.modelName) || {
            model: breakdown.modelName,
            inputTokens: 0,
            outputTokens: 0,
            cacheTokens: 0,
            cost: 0,
          };

          existing.inputTokens += breakdown.inputTokens;
          existing.outputTokens += breakdown.outputTokens;
          existing.cacheTokens += breakdown.cacheCreationTokens + breakdown.cacheReadTokens;
          existing.cost += breakdown.cost;

          modelMap.set(breakdown.modelName, existing);
        }
      }

      // Calculate totals for percentage
      const models = Array.from(modelMap.values());
      const totalTokens = models.reduce((sum, m) => sum + m.inputTokens + m.outputTokens, 0);

      // Add percentage and sort by tokens
      const result = models
        .map((m) => ({
          ...m,
          tokens: m.inputTokens + m.outputTokens,
          cost: Math.round(m.cost * 100) / 100,
          percentage:
            totalTokens > 0
              ? Math.round(((m.inputTokens + m.outputTokens) / totalTokens) * 1000) / 10
              : 0,
        }))
        .sort((a, b) => b.tokens - a.tokens);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      errorResponse(res, error, 'Failed to fetch model usage');
    }
  }
);

/**
 * GET /api/usage/sessions
 *
 * Returns paginated list of sessions.
 * Query: ?since=YYYYMMDD&until=YYYYMMDD&limit=50&offset=0
 */
usageRoutes.get(
  '/sessions',
  async (req: Request<object, object, object, UsageQuery>, res: Response) => {
    try {
      const since = validateDate(req.query.since);
      const until = validateDate(req.query.until);
      const limit = validateLimit(req.query.limit);
      const offset = validateOffset(req.query.offset);

      const sessionData = await getCachedSessionData();

      // Filter by date range using lastActivity
      const filtered = filterByDateRange(sessionData, since, until);

      // Sort by lastActivity descending
      const sorted = [...filtered].sort(
        (a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
      );

      // Paginate
      const paginated = sorted.slice(offset, offset + limit);

      // Transform for frontend
      const sessions = paginated.map((s) => ({
        sessionId: s.sessionId,
        projectPath: s.projectPath,
        tokens: s.inputTokens + s.outputTokens,
        inputTokens: s.inputTokens,
        outputTokens: s.outputTokens,
        cost: Math.round(s.totalCost * 100) / 100,
        lastActivity: s.lastActivity,
        modelsUsed: s.modelsUsed,
      }));

      res.json({
        success: true,
        data: {
          sessions,
          total: filtered.length,
          limit,
          offset,
          hasMore: offset + limit < filtered.length,
        },
      });
    } catch (error) {
      errorResponse(res, error, 'Failed to fetch sessions');
    }
  }
);

/**
 * GET /api/usage/monthly
 *
 * Returns monthly usage summary for charts.
 * Query: ?since=YYYYMMDD&until=YYYYMMDD
 */
usageRoutes.get(
  '/monthly',
  async (req: Request<object, object, object, UsageQuery>, res: Response) => {
    try {
      const since = validateDate(req.query.since);
      const until = validateDate(req.query.until);

      const monthlyData = await getCachedMonthlyData();

      // Filter by date range (convert month YYYY-MM to YYYYMM01 for comparison)
      const filtered =
        since || until
          ? monthlyData.filter((m) => {
              const monthDate = m.month.replace('-', '') + '01';
              if (since && monthDate < since) return false;
              if (until && monthDate > until) return false;
              return true;
            })
          : monthlyData;

      // Transform for charts
      const result = filtered.map((m) => ({
        month: m.month,
        tokens: m.inputTokens + m.outputTokens,
        inputTokens: m.inputTokens,
        outputTokens: m.outputTokens,
        cacheTokens: m.cacheCreationTokens + m.cacheReadTokens,
        cost: Math.round(m.totalCost * 100) / 100,
        modelsUsed: m.modelsUsed.length,
      }));

      res.json({
        success: true,
        data: result.sort((a, b) => a.month.localeCompare(b.month)),
      });
    } catch (error) {
      errorResponse(res, error, 'Failed to fetch monthly usage');
    }
  }
);

/**
 * POST /api/usage/refresh
 *
 * Clears the usage cache to force fresh data fetch.
 * Useful when user wants to see latest data immediately.
 */
usageRoutes.post('/refresh', (_req: Request, res: Response) => {
  clearUsageCache();
  res.json({
    success: true,
    message: 'Usage cache cleared',
  });
});

/**
 * GET /api/usage/status
 *
 * Returns cache status including last fetch timestamp.
 * Used by UI to show "Last updated: X ago" indicator.
 */
usageRoutes.get('/status', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      lastFetch: lastFetchTimestamp,
      cacheSize: cache.size,
    },
  });
});
