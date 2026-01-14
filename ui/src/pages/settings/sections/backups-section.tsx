/**
 * Backups Section
 * Settings section for managing settings.json backups (list and restore)
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { RefreshCw, CheckCircle2, AlertCircle, RotateCcw, Clock, Archive } from 'lucide-react';
import { useRawConfig } from '../hooks';

/** Duration in ms before success toast auto-dismisses */
const SUCCESS_DISPLAY_DURATION_MS = 3000;

/** Duration in ms before error toast auto-dismisses */
const ERROR_DISPLAY_DURATION_MS = 5000;

interface Backup {
  timestamp: string;
  date: string;
}

interface BackupsResponse {
  backups: Backup[];
}

export default function BackupsSection() {
  const { fetchRawConfig } = useRawConfig();

  // AbortController refs for cleanup
  const abortControllerRef = useRef<AbortController | null>(null);
  const restoreAbortControllerRef = useRef<AbortController | null>(null);

  // State
  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [confirmRestore, setConfirmRestore] = useState<string | null>(null); // Confirmation dialog state

  // Fetch backups
  const fetchBackups = useCallback(async () => {
    // Abort previous request
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/persist/backups', {
        signal: abortControllerRef.current.signal,
      });
      if (!response.ok) {
        throw new Error('Failed to fetch backups');
      }
      const data: BackupsResponse = await response.json();
      setBackups(data.backups || []);
    } catch (err) {
      // Ignore abort errors
      if (err instanceof Error && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  // Restore backup (wrapped in useCallback for callback stability)
  const restoreBackup = useCallback(
    async (timestamp: string) => {
      // Abort previous restore request
      restoreAbortControllerRef.current?.abort();
      restoreAbortControllerRef.current = new AbortController();

      try {
        setRestoring(timestamp);
        setError(null);
        const response = await fetch('/api/persist/restore', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ timestamp }),
          signal: restoreAbortControllerRef.current.signal,
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to restore backup');
        }

        setSuccess('Backup restored successfully');
        await fetchBackups();
        await fetchRawConfig();
      } catch (err) {
        // Ignore abort errors
        if (err instanceof Error && err.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setRestoring(null);
      }
    },
    [fetchBackups, fetchRawConfig]
  );

  // Load on mount
  useEffect(() => {
    fetchBackups();
  }, [fetchBackups]);

  // Cleanup: abort pending requests on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      restoreAbortControllerRef.current?.abort();
    };
  }, []);

  // Clear success after timeout
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), SUCCESS_DISPLAY_DURATION_MS);
      return () => clearTimeout(timer);
    }
  }, [success]);

  // Clear error after timeout
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), ERROR_DISPLAY_DURATION_MS);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Loading skeleton
  if (loading) {
    return (
      <>
        <ScrollArea className="flex-1">
          <div className="p-5 space-y-4">
            <div className="space-y-2">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-full" />
            </div>
            {[1, 2, 3].map((i) => (
              <Card key={i} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                  <Skeleton className="h-8 w-20" />
                </div>
              </Card>
            ))}
          </div>
        </ScrollArea>
        <div className="p-4 border-t bg-background">
          <Skeleton className="h-9 w-full" />
        </div>
      </>
    );
  }

  return (
    <>
      {/* Toast-style alerts */}
      <div
        className={`absolute left-5 right-5 top-20 z-10 transition-all duration-200 ease-out ${
          error || success
            ? 'opacity-100 translate-y-0'
            : 'opacity-0 -translate-y-2 pointer-events-none'
        }`}
      >
        {error && (
          <Alert variant="destructive" className="py-2 shadow-lg">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {success && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-green-200 bg-green-50 text-green-700 shadow-lg dark:border-green-900/50 dark:bg-green-900/90 dark:text-green-300">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span className="text-sm font-medium">{success}</span>
          </div>
        )}
      </div>

      {/* Scrollable Content */}
      <ScrollArea className="flex-1">
        <div className="p-5 space-y-4">
          {/* Header */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Archive className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold">Settings Backups</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Restore previous versions of your settings.json file. Backups are created
              automatically when settings are modified.
            </p>
          </div>

          {/* Backups List */}
          {backups.length === 0 ? (
            <Card className="p-8">
              <div className="text-center">
                <Archive className="w-12 h-12 mx-auto mb-3 opacity-30 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No backups available</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Backups will appear here when you modify settings
                </p>
              </div>
            </Card>
          ) : (
            <div className="space-y-2">
              {backups.map((backup, index) => (
                <Card key={backup.timestamp} className="p-4 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <Clock className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-medium font-mono">{backup.timestamp}</p>
                          {index === 0 && (
                            <Badge variant="secondary" className="text-xs">
                              Latest
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{backup.date}</p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setConfirmRestore(backup.timestamp)}
                      disabled={restoring !== null}
                      className="gap-2 shrink-0"
                    >
                      <RotateCcw
                        className={`w-4 h-4 ${restoring === backup.timestamp ? 'animate-spin' : ''}`}
                      />
                      {restoring === backup.timestamp ? 'Restoring...' : 'Restore'}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-4 border-t bg-background">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            fetchBackups();
            fetchRawConfig();
          }}
          disabled={loading || restoring !== null}
          className="w-full"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Restore Confirmation Dialog */}
      <AlertDialog open={!!confirmRestore} onOpenChange={() => setConfirmRestore(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore Backup?</AlertDialogTitle>
            <AlertDialogDescription>
              This will replace your current settings with backup from{' '}
              <code className="font-mono bg-muted px-1.5 py-0.5 rounded text-foreground">
                {confirmRestore}
              </code>
              . This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmRestore) {
                  restoreBackup(confirmRestore);
                }
                setConfirmRestore(null);
              }}
            >
              Restore
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
