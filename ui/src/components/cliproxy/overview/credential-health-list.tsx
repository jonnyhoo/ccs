/**
 * Credential Health List Component
 * Auth status indicators for CLIProxy Overview tab
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, AlertCircle, XCircle, MinusCircle, RefreshCw } from 'lucide-react';
import { useCliproxyAuth } from '@/hooks/use-cliproxy';
import { cn } from '@/lib/utils';
import { usePrivacy, PRIVACY_BLUR_CLASS } from '@/contexts/privacy-context';

type CredentialStatus = 'ready' | 'warning' | 'error' | 'disabled';

interface CredentialRowProps {
  name: string;
  provider: string;
  status: CredentialStatus;
  statusMessage: string;
  email?: string;
  expiresAt?: string;
  onRefresh?: () => void;
  privacyMode?: boolean;
}

function CredentialRow({
  name,
  provider,
  status,
  statusMessage,
  email,
  expiresAt,
  onRefresh,
  privacyMode,
}: CredentialRowProps) {
  const statusConfig = {
    ready: {
      icon: CheckCircle2,
      color: 'text-green-600 dark:text-green-400',
      bg: 'bg-green-500/10',
    },
    warning: {
      icon: AlertCircle,
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-500/10',
    },
    error: {
      icon: XCircle,
      color: 'text-red-600 dark:text-red-400',
      bg: 'bg-red-500/10',
    },
    disabled: {
      icon: MinusCircle,
      color: 'text-muted-foreground',
      bg: 'bg-muted',
    },
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  const formatExpiry = (date?: string) => {
    if (!date) return 'Never';
    const expiry = new Date(date);
    const now = new Date();
    const diff = expiry.getTime() - now.getTime();
    if (diff < 0) return 'Expired';
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return 'Soon';
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}d`;
  };

  return (
    <div className="flex items-center justify-between p-3 border-b last:border-0">
      <div className="flex items-center gap-3">
        <div className={cn('p-2 rounded-full', config.bg)}>
          <Icon className={cn('w-4 h-4', config.color)} />
        </div>
        <div>
          <div className={cn('font-medium text-sm', privacyMode && PRIVACY_BLUR_CLASS)}>
            {email ?? name}
          </div>
          <div className="text-xs text-muted-foreground capitalize">{provider}</div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="text-right">
          <Badge
            variant={
              status === 'ready' ? 'outline' : status === 'warning' ? 'secondary' : 'destructive'
            }
            className="text-xs"
          >
            {statusMessage}
          </Badge>
          <div className="text-xs text-muted-foreground mt-0.5">
            Expires: {formatExpiry(expiresAt)}
          </div>
        </div>
        {status === 'warning' && onRefresh && (
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onRefresh}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

function CredentialHealthSkeleton() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Credential Health</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function CredentialHealthList() {
  const { data: authData, isLoading } = useCliproxyAuth();
  const { privacyMode } = usePrivacy();

  if (isLoading) {
    return <CredentialHealthSkeleton />;
  }

  // Flatten accounts from all providers
  const credentials =
    authData?.authStatus.flatMap((status) =>
      (status.accounts ?? []).map((account) => ({
        name: account.id,
        provider: status.provider,
        status: (account as { status?: CredentialStatus }).status ?? 'ready',
        statusMessage: (account as { statusMessage?: string }).statusMessage ?? 'Ready',
        email: account.email,
        expiresAt: (account as { expiresAt?: string }).expiresAt,
      }))
    ) ?? [];

  if (credentials.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Credential Health</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            No credentials configured. Use the login buttons above to authenticate.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Credential Health</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {credentials.map((cred, i) => (
          <CredentialRow
            key={`${cred.provider}-${cred.name}-${i}`}
            {...cred}
            privacyMode={privacyMode}
          />
        ))}
      </CardContent>
    </Card>
  );
}
