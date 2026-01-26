/**
 * React Query hooks for CLIProxy sync functionality
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

/** Sync status response */
export interface SyncStatus {
  connected: boolean;
  configured: boolean;
  remoteUrl?: string;
  latencyMs?: number;
  version?: string;
  error?: string;
  errorCode?: string;
}

/** Sync preview item */
export interface SyncPreviewItem {
  name: string;
  baseUrl?: string;
  modelName?: string;
}

/** Masked payload item for preview */
interface MaskedPayloadItem {
  'api-key': string;
  'base-url'?: string;
  prefix?: string;
  models?: { name: string; alias: string }[];
}

/** Sync preview response */
export interface SyncPreview {
  profiles: SyncPreviewItem[];
  payload: MaskedPayloadItem[];
  count: number;
}

/** Sync result response */
export interface SyncResult {
  success: boolean;
  syncedCount?: number;
  remoteUrl?: string;
  profiles?: string[];
  error?: string;
  errorCode?: string;
  message?: string;
}

/** Model alias */
export interface ModelAlias {
  from: string;
  to: string;
}

/** Aliases response */
export interface AliasesResponse {
  aliases: Record<string, ModelAlias[]>;
}

/**
 * Fetch sync status from API
 */
async function fetchSyncStatus(): Promise<SyncStatus> {
  const response = await fetch('/api/cliproxy/sync/status');
  if (!response.ok) {
    let message = 'Failed to fetch sync status';
    try {
      const error = await response.json();
      message = error.error || error.message || message;
    } catch {
      // Non-JSON response (e.g., 502 Bad Gateway)
    }
    throw new Error(message);
  }
  return response.json();
}

/**
 * Fetch sync preview from API
 */
async function fetchSyncPreview(): Promise<SyncPreview> {
  const response = await fetch('/api/cliproxy/sync/preview');
  if (!response.ok) {
    let message = 'Failed to fetch sync preview';
    try {
      const error = await response.json();
      message = error.error || error.message || message;
    } catch {
      // Non-JSON response (e.g., 502 Bad Gateway)
    }
    throw new Error(message);
  }
  return response.json();
}

/**
 * Execute sync to remote CLIProxy
 */
async function executeSync(): Promise<SyncResult> {
  const response = await fetch('/api/cliproxy/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    let message = 'Sync failed';
    try {
      const data = await response.json();
      message = data.error || data.message || message;
    } catch {
      // Non-JSON response (e.g., 502 Bad Gateway)
    }
    throw new Error(message);
  }

  return response.json();
}

/**
 * Hook to get sync status
 */
export function useSyncStatus() {
  return useQuery({
    queryKey: ['cliproxy-sync-status'],
    queryFn: fetchSyncStatus,
    refetchInterval: 30000, // Check every 30 seconds
    retry: 1,
    staleTime: 10000,
  });
}

/**
 * Hook to get sync preview
 */
export function useSyncPreview() {
  return useQuery({
    queryKey: ['cliproxy-sync-preview'],
    queryFn: fetchSyncPreview,
    staleTime: 5000,
    retry: 1,
  });
}

/**
 * Hook to execute sync with toast feedback
 */
export function useExecuteSync() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: executeSync,
    onSuccess: (data) => {
      // Invalidate sync-related queries after successful sync
      queryClient.invalidateQueries({ queryKey: ['cliproxy-sync-status'] });
      queryClient.invalidateQueries({ queryKey: ['cliproxy-sync-preview'] });

      // Show success toast with synced count
      if (data.syncedCount === 0) {
        toast.info('No profiles to sync');
      } else {
        toast.success(
          `Synced ${data.syncedCount} profile${data.syncedCount === 1 ? '' : 's'} to CLIProxy`
        );
      }
    },
    onError: (error: Error) => {
      toast.error(`Sync failed: ${error.message}`);
    },
  });
}
