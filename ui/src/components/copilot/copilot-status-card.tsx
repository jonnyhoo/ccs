/**
 * Copilot Status Card
 *
 * Displays GitHub Copilot integration status overview.
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useCopilot } from '@/hooks/use-copilot';
import { CheckCircle2, XCircle, AlertTriangle, Loader2, Download } from 'lucide-react';

export function CopilotStatusCard() {
  const {
    status,
    statusLoading,
    startAuth,
    isAuthenticating,
    startDaemon,
    isStartingDaemon,
    stopDaemon,
    isStoppingDaemon,
    install,
    isInstalling,
  } = useCopilot();

  if (statusLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>GitHub Copilot Status</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (!status) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>GitHub Copilot Status</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Failed to load status</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          GitHub Copilot Status
          {status.enabled ? (
            <Badge variant="default">Enabled</Badge>
          ) : (
            <Badge variant="secondary">Disabled</Badge>
          )}
        </CardTitle>
        <CardDescription>Use your GitHub Copilot subscription with Claude Code</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Warning Banner */}
        <div className="flex items-start gap-2 rounded-md border border-yellow-500/20 bg-yellow-500/10 p-3">
          <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
          <p className="text-sm text-yellow-700 dark:text-yellow-300">
            This uses a reverse-engineered API. Excessive usage may trigger GitHub abuse detection.
          </p>
        </div>

        {/* Status Grid */}
        <div className="grid gap-4 md:grid-cols-3">
          {/* Installed */}
          <div className="flex items-center gap-2">
            {status.installed ? (
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            ) : (
              <XCircle className="h-5 w-5 text-red-500" />
            )}
            <span className="text-sm">
              copilot-api {status.installed ? `v${status.version}` : 'Not Installed'}
            </span>
          </div>

          {/* Authenticated */}
          <div className="flex items-center gap-2">
            {status.authenticated ? (
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            ) : (
              <XCircle className="h-5 w-5 text-red-500" />
            )}
            <span className="text-sm">
              {status.authenticated ? 'Authenticated' : 'Not Authenticated'}
            </span>
          </div>

          {/* Daemon */}
          <div className="flex items-center gap-2">
            {status.daemon_running ? (
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            ) : (
              <XCircle className="h-5 w-5 text-muted-foreground" />
            )}
            <span className="text-sm">Daemon {status.daemon_running ? 'Running' : 'Stopped'}</span>
          </div>
        </div>

        {/* Quick Info */}
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          <span>Port: {status.port}</span>
          <span>Model: {status.model}</span>
          <span>Auto-start: {status.auto_start ? 'Yes' : 'No'}</span>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2 pt-2">
          {!status.installed && (
            <Button onClick={() => install(undefined)} disabled={isInstalling} size="sm">
              {isInstalling ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Installing...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Install copilot-api
                </>
              )}
            </Button>
          )}

          {!status.authenticated && (
            <Button
              onClick={() => startAuth()}
              disabled={isAuthenticating || !status.installed}
              size="sm"
            >
              {isAuthenticating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Authenticating...
                </>
              ) : (
                'Authenticate with GitHub'
              )}
            </Button>
          )}

          {status.daemon_running ? (
            <Button
              onClick={() => stopDaemon()}
              disabled={isStoppingDaemon}
              variant="outline"
              size="sm"
            >
              {isStoppingDaemon ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Stopping...
                </>
              ) : (
                'Stop Daemon'
              )}
            </Button>
          ) : (
            <Button
              onClick={() => startDaemon()}
              disabled={isStartingDaemon || !status.authenticated}
              variant="outline"
              size="sm"
            >
              {isStartingDaemon ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Starting...
                </>
              ) : (
                'Start Daemon'
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
