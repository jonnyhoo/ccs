/**
 * Usage Analytics API Routes
 *
 * Provides REST endpoints for Claude Code usage analytics.
 * Supports daily, monthly, and session-based usage data aggregation.
 *
 * Performance optimizations:
 * - Persistent disk cache to avoid re-parsing JSONL files on startup
 * - TTL-based in-memory caching for fast repeated requests
 * - Request coalescing to prevent duplicate concurrent requests
 * - Non-blocking prewarm with instant stale data serving
 */

import { Router, Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  loadDailyUsageData,
  loadMonthlyUsageData,
  loadSessionData,
  loadAllUsageData,
  loadHourlyUsageData,
} from './data-aggregator';
import type {
  DailyUsage,
  HourlyUsage,
  MonthlyUsage,
  SessionUsage,
  Anomaly,
  AnomalySummary,
  TokenBreakdown,
} from './usage-types';
import { getModelPricing } from './model-pricing';
import {
  readDiskCache,
  writeDiskCache,
  isDiskCacheFresh,
  isDiskCacheStale,
  clearDiskCache,
  getCacheAge,
} from './usage-disk-cache';
import { ok, info, fail } from '../utils/ui';

// ============================================================================
// Multi-Instance Support - Aggregate usage from CCS profiles
// ============================================================================

/** Path to CCS instances directory */
const CCS_INSTANCES_DIR = path.join(os.homedir(), '.ccs', 'instances');

/**
 * Get list of CCS instance paths that have usage data
 * Only returns instances with existing projects/ directory
 */
function getInstancePaths(): string[] {
  if (!fs.existsSync(CCS_INSTANCES_DIR)) {
    return [];
  }

  try {
    const entries = fs.readdirSync(CCS_INSTANCES_DIR, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(CCS_INSTANCES_DIR, entry.name))
      .filter((instancePath) => {
        // Only include instances that have a projects directory
        const projectsPath = path.join(instancePath, 'projects');
        return fs.existsSync(projectsPath);
      });
  } catch {
    console.error(fail('Failed to read CCS instances directory'));
    return [];
  }
}

/**
 * Load usage data from a specific instance
 * Uses custom JSONL parser with instance's projects directory
 */
async function loadInstanceData(instancePath: string): Promise<{
  daily: DailyUsage[];
  hourly: HourlyUsage[];
  monthly: MonthlyUsage[];
  session: SessionUsage[];
}> {
  try {
    const projectsDir = path.join(instancePath, 'projects');
    const result = await loadAllUsageData({ projectsDir });
    return result;
  } catch (_err) {
    // Instance may have no usage data - that's OK
    const instanceName = path.basename(instancePath);
    console.log(info(`No usage data in instance: ${instanceName}`));
    return { daily: [], hourly: [], monthly: [], session: [] };
  }
}

/**
 * Merge daily usage data from multiple sources
 * Combines entries with same date by aggregating tokens
 */
function mergeDailyData(sources: DailyUsage[][]): DailyUsage[] {
  const dateMap = new Map<string, DailyUsage>();

  for (const source of sources) {
    for (const day of source) {
      const existing = dateMap.get(day.date);
      if (existing) {
        // Aggregate tokens for same date
        existing.inputTokens += day.inputTokens;
        existing.outputTokens += day.outputTokens;
        existing.cacheCreationTokens += day.cacheCreationTokens;
        existing.cacheReadTokens += day.cacheReadTokens;
        existing.totalCost += day.totalCost;
        // Merge unique models
        const modelSet = new Set([...existing.modelsUsed, ...day.modelsUsed]);
        existing.modelsUsed = Array.from(modelSet);
        // Merge model breakdowns by aggregating same modelName
        for (const breakdown of day.modelBreakdowns) {
          const existingBreakdown = existing.modelBreakdowns.find(
            (b) => b.modelName === breakdown.modelName
          );
          if (existingBreakdown) {
            existingBreakdown.inputTokens += breakdown.inputTokens;
            existingBreakdown.outputTokens += breakdown.outputTokens;
            existingBreakdown.cacheCreationTokens += breakdown.cacheCreationTokens;
            existingBreakdown.cacheReadTokens += breakdown.cacheReadTokens;
            existingBreakdown.cost += breakdown.cost;
          } else {
            existing.modelBreakdowns.push({ ...breakdown });
          }
        }
      } else {
        // Clone to avoid mutating original
        dateMap.set(day.date, {
          ...day,
          modelsUsed: [...day.modelsUsed],
          modelBreakdowns: day.modelBreakdowns.map((b) => ({ ...b })),
        });
      }
    }
  }

  return Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Merge monthly usage data from multiple sources
 */
function mergeMonthlyData(sources: MonthlyUsage[][]): MonthlyUsage[] {
  const monthMap = new Map<string, MonthlyUsage>();

  for (const source of sources) {
    for (const month of source) {
      const existing = monthMap.get(month.month);
      if (existing) {
        existing.inputTokens += month.inputTokens;
        existing.outputTokens += month.outputTokens;
        existing.cacheCreationTokens += month.cacheCreationTokens;
        existing.cacheReadTokens += month.cacheReadTokens;
        existing.totalCost += month.totalCost;
        const modelSet = new Set([...existing.modelsUsed, ...month.modelsUsed]);
        existing.modelsUsed = Array.from(modelSet);
      } else {
        monthMap.set(month.month, { ...month, modelsUsed: [...month.modelsUsed] });
      }
    }
  }

  return Array.from(monthMap.values()).sort((a, b) => a.month.localeCompare(b.month));
}

/**
 * Merge hourly usage data from multiple sources
 * Combines entries with same hour by aggregating tokens
 */
function mergeHourlyData(sources: HourlyUsage[][]): HourlyUsage[] {
  const hourMap = new Map<string, HourlyUsage>();

  for (const source of sources) {
    for (const hour of source) {
      const existing = hourMap.get(hour.hour);
      if (existing) {
        existing.inputTokens += hour.inputTokens;
        existing.outputTokens += hour.outputTokens;
        existing.cacheCreationTokens += hour.cacheCreationTokens;
        existing.cacheReadTokens += hour.cacheReadTokens;
        existing.totalCost += hour.totalCost;
        const modelSet = new Set([...existing.modelsUsed, ...hour.modelsUsed]);
        existing.modelsUsed = Array.from(modelSet);
        // Merge model breakdowns
        for (const breakdown of hour.modelBreakdowns) {
          const existingBreakdown = existing.modelBreakdowns.find(
            (b) => b.modelName === breakdown.modelName
          );
          if (existingBreakdown) {
            existingBreakdown.inputTokens += breakdown.inputTokens;
            existingBreakdown.outputTokens += breakdown.outputTokens;
            existingBreakdown.cacheCreationTokens += breakdown.cacheCreationTokens;
            existingBreakdown.cacheReadTokens += breakdown.cacheReadTokens;
            existingBreakdown.cost += breakdown.cost;
          } else {
            existing.modelBreakdowns.push({ ...breakdown });
          }
        }
      } else {
        hourMap.set(hour.hour, {
          ...hour,
          modelsUsed: [...hour.modelsUsed],
          modelBreakdowns: hour.modelBreakdowns.map((b) => ({ ...b })),
        });
      }
    }
  }

  return Array.from(hourMap.values()).sort((a, b) => a.hour.localeCompare(b.hour));
}

/**
 * Merge session data from multiple sources
 * Deduplicates by sessionId (same session shouldn't appear in multiple instances)
 */
function mergeSessionData(sources: SessionUsage[][]): SessionUsage[] {
  const sessionMap = new Map<string, SessionUsage>();

  for (const source of sources) {
    for (const session of source) {
      // Use sessionId as unique key - later entries overwrite earlier ones
      sessionMap.set(session.sessionId, session);
    }
  }

  return Array.from(sessionMap.values()).sort(
    (a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
  );
}

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
  const hourly = cache.get('hourly') as CacheEntry<HourlyUsage[]> | undefined;
  const monthly = cache.get('monthly') as CacheEntry<MonthlyUsage[]> | undefined;
  const session = cache.get('session') as CacheEntry<SessionUsage[]> | undefined;

  // Write if we have at least daily data (the most essential)
  if (daily) {
    writeDiskCache(daily.data, hourly?.data ?? [], monthly?.data ?? [], session?.data ?? []);
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
          console.error(fail(`Background refresh failed for ${key}: ${err}`));
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
    return await loadDailyUsageData();
  });
}

/** Cached loader for monthly usage data */
async function getCachedMonthlyData(): Promise<MonthlyUsage[]> {
  return getCachedData('monthly', CACHE_TTL.monthly, async () => {
    return await loadMonthlyUsageData();
  });
}

/** Cached loader for session data */
async function getCachedSessionData(): Promise<SessionUsage[]> {
  return getCachedData('session', CACHE_TTL.session, async () => {
    return await loadSessionData();
  });
}

/** Cached loader for hourly usage data */
async function getCachedHourlyData(): Promise<HourlyUsage[]> {
  return getCachedData('hourly', CACHE_TTL.daily, async () => {
    return await loadHourlyUsageData();
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
 * Load fresh data and update both memory and disk caches
 * Aggregates data from default ~/.claude/ AND all CCS instances
 */
async function refreshFromSource(): Promise<{
  daily: DailyUsage[];
  hourly: HourlyUsage[];
  monthly: MonthlyUsage[];
  session: SessionUsage[];
}> {
  // Load default data (from ~/.claude/projects/ or CLAUDE_CONFIG_DIR)
  const defaultData = await loadAllUsageData();

  // Load data from all CCS instances sequentially (to avoid env var race condition)
  const instancePaths = getInstancePaths();
  const instanceDataResults: Array<{
    daily: DailyUsage[];
    hourly: HourlyUsage[];
    monthly: MonthlyUsage[];
    session: SessionUsage[];
  }> = [];

  for (const instancePath of instancePaths) {
    try {
      const data = await loadInstanceData(instancePath);
      instanceDataResults.push(data);
    } catch (err) {
      const instanceName = path.basename(instancePath);
      console.error(fail(`Failed to load instance ${instanceName}: ${err}`));
    }
  }

  // Collect successful instance data
  const allDailySources: DailyUsage[][] = [defaultData.daily];
  const allHourlySources: HourlyUsage[][] = [defaultData.hourly];
  const allMonthlySources: MonthlyUsage[][] = [defaultData.monthly];
  const allSessionSources: SessionUsage[][] = [defaultData.session];

  for (const result of instanceDataResults) {
    allDailySources.push(result.daily);
    allHourlySources.push(result.hourly);
    allMonthlySources.push(result.monthly);
    allSessionSources.push(result.session);
  }

  if (instanceDataResults.length > 0) {
    console.log(info(`Aggregated usage data from ${instanceDataResults.length} CCS instance(s)`));
  }

  // Merge all data sources
  const daily = mergeDailyData(allDailySources);
  const hourly = mergeHourlyData(allHourlySources);
  const monthly = mergeMonthlyData(allMonthlySources);
  const session = mergeSessionData(allSessionSources);

  // Update in-memory cache
  const now = Date.now();
  cache.set('daily', { data: daily, timestamp: now });
  cache.set('hourly', { data: hourly, timestamp: now });
  cache.set('monthly', { data: monthly, timestamp: now });
  cache.set('session', { data: session, timestamp: now });
  lastFetchTimestamp = now;

  // Persist to disk
  writeDiskCache(daily, hourly, monthly, session);

  return { daily, hourly, monthly, session };
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
  cache.set('hourly', { data: diskCache.hourly || [], timestamp: diskCache.timestamp });
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
  console.log(info('Pre-warming usage cache...'));

  try {
    const diskCache = readDiskCache();

    // Fresh disk cache - use it directly
    if (diskCache && isDiskCacheFresh(diskCache)) {
      const now = Date.now();
      cache.set('daily', { data: diskCache.daily, timestamp: diskCache.timestamp });
      cache.set('hourly', { data: diskCache.hourly || [], timestamp: diskCache.timestamp });
      cache.set('monthly', { data: diskCache.monthly, timestamp: diskCache.timestamp });
      cache.set('session', { data: diskCache.session, timestamp: diskCache.timestamp });
      lastFetchTimestamp = diskCache.timestamp;

      const elapsed = Date.now() - start;
      console.log(
        ok(`Usage cache ready from disk (${elapsed}ms, cached ${getCacheAge(diskCache)})`)
      );
      return { timestamp: now, elapsed, source: 'disk-fresh' };
    }

    // Stale disk cache - use it immediately, refresh in background
    if (diskCache && isDiskCacheStale(diskCache)) {
      const now = Date.now();
      cache.set('daily', { data: diskCache.daily, timestamp: diskCache.timestamp });
      cache.set('hourly', { data: diskCache.hourly || [], timestamp: diskCache.timestamp });
      cache.set('monthly', { data: diskCache.monthly, timestamp: diskCache.timestamp });
      cache.set('session', { data: diskCache.session, timestamp: diskCache.timestamp });
      lastFetchTimestamp = diskCache.timestamp;

      const elapsed = Date.now() - start;
      console.log(
        ok(
          `Usage cache ready from disk (${elapsed}ms, stale ${getCacheAge(diskCache)}, refreshing...)`
        )
      );

      // Background refresh
      if (!isRefreshing) {
        isRefreshing = true;
        refreshFromSource()
          .then(() => console.log(ok('Background refresh complete')))
          .catch((err) => console.error(fail(`Background refresh failed: ${err}`)))
          .finally(() => {
            isRefreshing = false;
          });
      }

      return { timestamp: now, elapsed, source: 'disk-stale' };
    }

    // No usable disk cache - refresh from source (blocking for first startup only)
    console.log(info('No disk cache, loading from source...'));
    await refreshFromSource();

    const elapsed = Date.now() - start;
    console.log(ok(`Usage cache ready (${elapsed}ms)`));
    return { timestamp: Date.now(), elapsed, source: 'fresh' };
  } catch (err) {
    console.error(fail(`Failed to prewarm usage cache: ${err}`));
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
  data: T[] | undefined,
  since?: string,
  until?: string
): T[] {
  if (!data || !Array.isArray(data)) return [];
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
 * Calculate cost breakdown for token categories
 * Uses weighted average pricing across models in the dataset
 */
function calculateTokenBreakdownCosts(dailyData: DailyUsage[]): TokenBreakdown {
  let inputTokens = 0;
  let outputTokens = 0;
  let cacheCreationTokens = 0;
  let cacheReadTokens = 0;
  let inputCost = 0;
  let outputCost = 0;
  let cacheCreationCost = 0;
  let cacheReadCost = 0;

  for (const day of dailyData) {
    for (const breakdown of day.modelBreakdowns) {
      const pricing = getModelPricing(breakdown.modelName);

      inputTokens += breakdown.inputTokens;
      outputTokens += breakdown.outputTokens;
      cacheCreationTokens += breakdown.cacheCreationTokens;
      cacheReadTokens += breakdown.cacheReadTokens;

      inputCost += (breakdown.inputTokens / 1_000_000) * pricing.inputPerMillion;
      outputCost += (breakdown.outputTokens / 1_000_000) * pricing.outputPerMillion;
      cacheCreationCost +=
        (breakdown.cacheCreationTokens / 1_000_000) * pricing.cacheCreationPerMillion;
      cacheReadCost += (breakdown.cacheReadTokens / 1_000_000) * pricing.cacheReadPerMillion;
    }
  }

  return {
    input: { tokens: inputTokens, cost: Math.round(inputCost * 100) / 100 },
    output: { tokens: outputTokens, cost: Math.round(outputCost * 100) / 100 },
    cacheCreation: { tokens: cacheCreationTokens, cost: Math.round(cacheCreationCost * 100) / 100 },
    cacheRead: { tokens: cacheReadTokens, cost: Math.round(cacheReadCost * 100) / 100 },
  };
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
      let totalCacheCreationTokens = 0;
      let totalCacheReadTokens = 0;
      let totalCost = 0;

      for (const day of filtered) {
        totalInputTokens += day.inputTokens;
        totalOutputTokens += day.outputTokens;
        totalCacheCreationTokens += day.cacheCreationTokens;
        totalCacheReadTokens += day.cacheReadTokens;
        totalCost += day.totalCost;
      }

      const totalTokens = totalInputTokens + totalOutputTokens;
      const totalCacheTokens = totalCacheCreationTokens + totalCacheReadTokens;

      // Calculate detailed token breakdown with costs
      const tokenBreakdown = calculateTokenBreakdownCosts(filtered);

      res.json({
        success: true,
        data: {
          totalTokens,
          totalInputTokens,
          totalOutputTokens,
          totalCacheTokens,
          totalCacheCreationTokens,
          totalCacheReadTokens,
          totalCost: Math.round(totalCost * 100) / 100,
          tokenBreakdown,
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
 * GET /api/usage/hourly
 *
 * Returns hourly usage trends for chart visualization.
 * Query: ?since=YYYYMMDD&until=YYYYMMDD (defaults to last 24 hours)
 * Fills in gaps with zero values for hours without activity.
 */
usageRoutes.get(
  '/hourly',
  async (req: Request<object, object, object, UsageQuery>, res: Response) => {
    try {
      const since = validateDate(req.query.since);
      const until = validateDate(req.query.until);

      const hourlyData = await getCachedHourlyData();

      // Filter by date range (guard against undefined)
      const filtered = (hourlyData || []).filter((h) => {
        // Extract date from hour format "YYYY-MM-DD HH:00"
        const hourDate = h.hour.slice(0, 10).replace(/-/g, '');
        if (since && hourDate < since) return false;
        if (until && hourDate > until) return false;
        return true;
      });

      // Transform for chart consumption
      const trends = filtered.map((hour) => ({
        hour: hour.hour,
        tokens: hour.inputTokens + hour.outputTokens,
        inputTokens: hour.inputTokens,
        outputTokens: hour.outputTokens,
        cacheTokens: hour.cacheCreationTokens + hour.cacheReadTokens,
        cost: Math.round(hour.totalCost * 100) / 100,
        modelsUsed: hour.modelsUsed.length,
        requests: hour.modelBreakdowns.length,
      }));

      // Fill gaps with zero values for hours without activity
      const filledTrends = fillHourlyGaps(trends, since, until);

      res.json({
        success: true,
        data: filledTrends,
      });
    } catch (error) {
      errorResponse(res, error, 'Failed to fetch hourly usage');
    }
  }
);

/**
 * Fill gaps in hourly data with zero values
 * Ensures continuous timeline for chart display
 */
function fillHourlyGaps(
  data: Array<{
    hour: string;
    tokens: number;
    inputTokens: number;
    outputTokens: number;
    cacheTokens: number;
    cost: number;
    modelsUsed: number;
    requests: number;
  }>,
  since?: string,
  until?: string
): typeof data {
  // If no date range specified, return as-is
  if (!since && !until) {
    return data.sort((a, b) => a.hour.localeCompare(b.hour));
  }

  // Create a map of existing hours for O(1) lookup
  const hourMap = new Map(data.map((d) => [d.hour, d]));

  // Determine the hour range (use UTC to match stored hour keys)
  const now = new Date();
  const startDate = since
    ? new Date(
        Date.UTC(
          parseInt(since.slice(0, 4)),
          parseInt(since.slice(4, 6)) - 1,
          parseInt(since.slice(6, 8)),
          0,
          0,
          0
        )
      )
    : new Date(now.getTime() - 24 * 60 * 60 * 1000); // Default: 24 hours ago

  const endDate = until
    ? new Date(
        Date.UTC(
          parseInt(until.slice(0, 4)),
          parseInt(until.slice(4, 6)) - 1,
          parseInt(until.slice(6, 8)),
          23,
          59,
          59
        )
      )
    : now;

  // Cap endDate at current time to avoid filling future hours with zeros
  const cappedEndDate = endDate > now ? now : endDate;

  const result: typeof data = [];

  // Iterate through each hour in the range
  const current = new Date(startDate);
  current.setMinutes(0, 0, 0);

  while (current <= cappedEndDate) {
    // Format hour key as "YYYY-MM-DD HH:00" in UTC to match storage format
    const year = current.getUTCFullYear();
    const month = String(current.getUTCMonth() + 1).padStart(2, '0');
    const day = String(current.getUTCDate()).padStart(2, '0');
    const hour = String(current.getUTCHours()).padStart(2, '0');
    const hourKey = `${year}-${month}-${day} ${hour}:00`;

    if (hourMap.has(hourKey)) {
      const entry = hourMap.get(hourKey);
      if (entry) {
        result.push(entry);
      }
    } else {
      // Insert zero entry for this hour
      result.push({
        hour: hourKey,
        tokens: 0,
        inputTokens: 0,
        outputTokens: 0,
        cacheTokens: 0,
        cost: 0,
        modelsUsed: 0,
        requests: 0,
      });
    }

    // Move to next hour
    current.setTime(current.getTime() + 60 * 60 * 1000);
  }

  return result;
}

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

      // Aggregate model usage across all days with detailed breakdown
      const modelMap = new Map<
        string,
        {
          model: string;
          inputTokens: number;
          outputTokens: number;
          cacheCreationTokens: number;
          cacheReadTokens: number;
          cost: number;
        }
      >();

      for (const day of filtered) {
        for (const breakdown of day.modelBreakdowns) {
          const existing = modelMap.get(breakdown.modelName) || {
            model: breakdown.modelName,
            inputTokens: 0,
            outputTokens: 0,
            cacheCreationTokens: 0,
            cacheReadTokens: 0,
            cost: 0,
          };

          existing.inputTokens += breakdown.inputTokens;
          existing.outputTokens += breakdown.outputTokens;
          existing.cacheCreationTokens += breakdown.cacheCreationTokens;
          existing.cacheReadTokens += breakdown.cacheReadTokens;
          existing.cost += breakdown.cost;

          modelMap.set(breakdown.modelName, existing);
        }
      }

      // Calculate totals for percentage
      const models = Array.from(modelMap.values());
      const totalTokens = models.reduce((sum, m) => sum + m.inputTokens + m.outputTokens, 0);

      // Add percentage, cost breakdown, and I/O ratio
      const result = models
        .map((m) => {
          const pricing = getModelPricing(m.model);

          // Calculate cost breakdown
          const inputCost = (m.inputTokens / 1_000_000) * pricing.inputPerMillion;
          const outputCost = (m.outputTokens / 1_000_000) * pricing.outputPerMillion;
          const cacheCreationCost =
            (m.cacheCreationTokens / 1_000_000) * pricing.cacheCreationPerMillion;
          const cacheReadCost = (m.cacheReadTokens / 1_000_000) * pricing.cacheReadPerMillion;

          // Calculate I/O ratio
          const ioRatio = m.outputTokens > 0 ? m.inputTokens / m.outputTokens : 0;

          return {
            model: m.model,
            tokens: m.inputTokens + m.outputTokens,
            inputTokens: m.inputTokens,
            outputTokens: m.outputTokens,
            cacheCreationTokens: m.cacheCreationTokens,
            cacheReadTokens: m.cacheReadTokens,
            cacheTokens: m.cacheCreationTokens + m.cacheReadTokens,
            cost: Math.round(m.cost * 100) / 100,
            percentage:
              totalTokens > 0
                ? Math.round(((m.inputTokens + m.outputTokens) / totalTokens) * 1000) / 10
                : 0,
            costBreakdown: {
              input: { tokens: m.inputTokens, cost: Math.round(inputCost * 100) / 100 },
              output: { tokens: m.outputTokens, cost: Math.round(outputCost * 100) / 100 },
              cacheCreation: {
                tokens: m.cacheCreationTokens,
                cost: Math.round(cacheCreationCost * 100) / 100,
              },
              cacheRead: { tokens: m.cacheReadTokens, cost: Math.round(cacheReadCost * 100) / 100 },
            },
            ioRatio: Math.round(ioRatio * 10) / 10,
          };
        })
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

// ============================================================================
// ANOMALY DETECTION
// ============================================================================

/** Anomaly detection thresholds */
const ANOMALY_THRESHOLDS = {
  HIGH_INPUT_TOKENS: 10_000_000, // 10M tokens/day/model
  HIGH_IO_RATIO: 100, // 100x input/output ratio
  COST_SPIKE_MULTIPLIER: 2, // 2x average daily cost
  HIGH_CACHE_READ_TOKENS: 1_000_000_000, // 1B cache read tokens
};

/**
 * Detect anomalies in usage data
 */
function detectAnomalies(dailyData: DailyUsage[]): Anomaly[] {
  const anomalies: Anomaly[] = [];

  // Calculate average daily cost for spike detection
  const totalCost = dailyData.reduce((sum, day) => sum + day.totalCost, 0);
  const avgDailyCost = dailyData.length > 0 ? totalCost / dailyData.length : 0;
  const costSpikeThreshold = avgDailyCost * ANOMALY_THRESHOLDS.COST_SPIKE_MULTIPLIER;

  for (const day of dailyData) {
    // Check for cost spikes
    if (avgDailyCost > 0 && day.totalCost > costSpikeThreshold) {
      const multiplier = Math.round((day.totalCost / avgDailyCost) * 10) / 10;
      anomalies.push({
        date: day.date,
        type: 'cost_spike',
        value: day.totalCost,
        threshold: avgDailyCost,
        message: `Cost ${multiplier}x above daily average ($${Math.round(day.totalCost)} vs $${Math.round(avgDailyCost)})`,
      });
    }

    // Check per-model anomalies
    for (const breakdown of day.modelBreakdowns) {
      // High input tokens per model
      if (breakdown.inputTokens > ANOMALY_THRESHOLDS.HIGH_INPUT_TOKENS) {
        const multiplier =
          Math.round((breakdown.inputTokens / ANOMALY_THRESHOLDS.HIGH_INPUT_TOKENS) * 10) / 10;
        anomalies.push({
          date: day.date,
          type: 'high_input',
          model: breakdown.modelName,
          value: breakdown.inputTokens,
          threshold: ANOMALY_THRESHOLDS.HIGH_INPUT_TOKENS,
          message: `Input tokens ${multiplier}x above threshold (${formatTokenCount(breakdown.inputTokens)})`,
        });
      }

      // High I/O ratio
      if (breakdown.outputTokens > 0) {
        const ioRatio = breakdown.inputTokens / breakdown.outputTokens;
        if (ioRatio > ANOMALY_THRESHOLDS.HIGH_IO_RATIO) {
          const multiplier = Math.round((ioRatio / ANOMALY_THRESHOLDS.HIGH_IO_RATIO) * 10) / 10;
          anomalies.push({
            date: day.date,
            type: 'high_io_ratio',
            model: breakdown.modelName,
            value: ioRatio,
            threshold: ANOMALY_THRESHOLDS.HIGH_IO_RATIO,
            message: `I/O ratio ${multiplier}x above threshold (${Math.round(ioRatio)}:1)`,
          });
        }
      }

      // High cache read tokens
      if (breakdown.cacheReadTokens > ANOMALY_THRESHOLDS.HIGH_CACHE_READ_TOKENS) {
        const multiplier =
          Math.round((breakdown.cacheReadTokens / ANOMALY_THRESHOLDS.HIGH_CACHE_READ_TOKENS) * 10) /
          10;
        anomalies.push({
          date: day.date,
          type: 'high_cache_read',
          model: breakdown.modelName,
          value: breakdown.cacheReadTokens,
          threshold: ANOMALY_THRESHOLDS.HIGH_CACHE_READ_TOKENS,
          message: `Cache reads ${multiplier}x above threshold (${formatTokenCount(breakdown.cacheReadTokens)})`,
        });
      }
    }
  }

  // Sort by date descending
  return anomalies.sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Format token count for human readability
 */
function formatTokenCount(tokens: number): string {
  if (tokens >= 1_000_000_000) {
    return `${(tokens / 1_000_000_000).toFixed(1)}B`;
  } else if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(1)}M`;
  } else if (tokens >= 1_000) {
    return `${(tokens / 1_000).toFixed(1)}K`;
  }
  return tokens.toString();
}

/**
 * Summarize anomalies by type
 */
function summarizeAnomalies(anomalies: Anomaly[]): AnomalySummary {
  const uniqueDates = new Set<string>();
  let highInputDays = 0;
  let highIoRatioDays = 0;
  let costSpikeDays = 0;
  let highCacheReadDays = 0;

  // Track unique dates per anomaly type
  const highInputDates = new Set<string>();
  const highIoRatioDates = new Set<string>();
  const costSpikeDates = new Set<string>();
  const highCacheReadDates = new Set<string>();

  for (const anomaly of anomalies) {
    uniqueDates.add(anomaly.date);

    switch (anomaly.type) {
      case 'high_input':
        highInputDates.add(anomaly.date);
        break;
      case 'high_io_ratio':
        highIoRatioDates.add(anomaly.date);
        break;
      case 'cost_spike':
        costSpikeDates.add(anomaly.date);
        break;
      case 'high_cache_read':
        highCacheReadDates.add(anomaly.date);
        break;
    }
  }

  highInputDays = highInputDates.size;
  highIoRatioDays = highIoRatioDates.size;
  costSpikeDays = costSpikeDates.size;
  highCacheReadDays = highCacheReadDates.size;

  return {
    totalAnomalies: anomalies.length,
    highInputDays,
    highIoRatioDays,
    costSpikeDays,
    highCacheReadDays,
  };
}

/**
 * GET /api/usage/insights
 *
 * Returns anomaly detection results for usage patterns.
 * Query: ?since=YYYYMMDD&until=YYYYMMDD
 */
usageRoutes.get(
  '/insights',
  async (req: Request<object, object, object, UsageQuery>, res: Response) => {
    try {
      const since = validateDate(req.query.since);
      const until = validateDate(req.query.until);

      const dailyData = await getCachedDailyData();
      const filtered = filterByDateRange(dailyData, since, until);

      const anomalies = detectAnomalies(filtered);
      const summary = summarizeAnomalies(anomalies);

      res.json({
        success: true,
        data: {
          anomalies,
          summary,
        },
      });
    } catch (error) {
      errorResponse(res, error, 'Failed to fetch usage insights');
    }
  }
);
