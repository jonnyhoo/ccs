/**
 * CLIProxy Page
 * Phase 03: REST API Routes & CRUD
 * Phase 06: Multi-Account Management
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Plus, Check, X, User, ChevronDown, Star, Trash2 } from 'lucide-react';
import { CliproxyTable } from '@/components/cliproxy-table';
import { CliproxyDialog } from '@/components/cliproxy-dialog';
import {
  useCliproxy,
  useCliproxyAuth,
  useSetDefaultAccount,
  useRemoveAccount,
} from '@/hooks/use-cliproxy';
import type { OAuthAccount, AuthStatus } from '@/lib/api-client';

function AccountBadge({
  account,
  onSetDefault,
  onRemove,
  isRemoving,
}: {
  account: OAuthAccount;
  onSetDefault: () => void;
  onRemove: () => void;
  isRemoving: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-full border transition-colors hover:bg-muted/80 ${
            account.isDefault
              ? 'border-primary/30 bg-primary/10 text-primary font-medium'
              : 'border-muted bg-muted/40'
          }`}
        >
          <User className="w-3 h-3" />
          <span className="max-w-[200px] truncate">{account.email || account.id}</span>
          {account.isDefault && <Star className="w-3 h-3 fill-current" />}
          <ChevronDown className="w-3 h-3 opacity-50" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <div className="px-2 py-1.5 text-xs text-muted-foreground bg-muted/30 -mx-1 -mt-1 mb-1 border-b">
          <div className="font-medium text-foreground mb-0.5 truncate">
            {account.email || account.id}
          </div>
          {account.lastUsedAt && (
            <div>Last used: {new Date(account.lastUsedAt).toLocaleDateString()}</div>
          )}
        </div>
        {!account.isDefault && (
          <DropdownMenuItem onClick={onSetDefault}>
            <Star className="w-4 h-4 mr-2" />
            Set as default
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          className="text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/30"
          onClick={onRemove}
          disabled={isRemoving}
        >
          <Trash2 className="w-4 h-4 mr-2" />
          {isRemoving ? 'Removing...' : 'Remove account'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ProviderRow({
  status,
  setDefaultMutation,
  removeMutation,
}: {
  status: AuthStatus;
  setDefaultMutation: ReturnType<typeof useSetDefaultAccount>;
  removeMutation: ReturnType<typeof useRemoveAccount>;
}) {
  const accounts = status.accounts || [];

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border-b last:border-0 hover:bg-muted/5 transition-colors gap-4">
      <div className="flex items-center gap-4 min-w-[180px]">
        <div
          className={`flex items-center justify-center w-8 h-8 rounded-full ${
            status.authenticated
              ? 'bg-green-500/10 text-green-600 dark:text-green-400'
              : 'bg-muted text-muted-foreground'
          }`}
        >
          {status.authenticated ? <Check className="w-5 h-5" /> : <X className="w-5 h-5" />}
        </div>
        <div>
          <div className="font-medium flex items-center gap-2">
            {status.displayName}
            {accounts.length > 0 && (
              <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-normal">
                {accounts.length}
              </Badge>
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">{status.provider}</div>
        </div>
      </div>

      <div className="flex-1 flex items-center gap-2 flex-wrap">
        {status.authenticated && accounts.length > 0 ? (
          accounts.map((account) => (
            <AccountBadge
              key={account.id}
              account={account}
              onSetDefault={() =>
                setDefaultMutation.mutate({
                  provider: status.provider,
                  accountId: account.id,
                })
              }
              onRemove={() =>
                removeMutation.mutate({
                  provider: status.provider,
                  accountId: account.id,
                })
              }
              isRemoving={removeMutation.isPending}
            />
          ))
        ) : (
          <div className="text-sm text-muted-foreground italic">
            {status.authenticated
              ? 'Authenticated (No specific accounts tracked)'
              : 'Not authenticated'}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        {!status.authenticated && (
          <div className="text-xs font-mono bg-muted px-2 py-1 rounded text-muted-foreground select-all">
            ccs {status.provider} --auth
          </div>
        )}
        {status.authenticated && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => {
              // This is a placeholder since we can't actually run the auth command from UI easily without a terminal
              // But we can show the command to run
              navigator.clipboard.writeText(`ccs ${status.provider} --auth`);
            }}
            title="Copy auth command"
          >
            <Plus className="w-3 h-3" />
            Add Account
          </Button>
        )}
      </div>
    </div>
  );
}

export function CliproxyPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data, isLoading } = useCliproxy();
  const { data: authData, isLoading: authLoading } = useCliproxyAuth();
  const setDefaultMutation = useSetDefaultAccount();
  const removeMutation = useRemoveAccount();

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">CLIProxy</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage OAuth-based provider variants and multi-account configurations
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Create Variant
        </Button>
      </div>

      {/* Built-in Profiles with Account Management */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Built-in Providers</h2>
          <p className="text-sm text-muted-foreground">
            Manage authentication status and accounts for built-in providers.
          </p>
        </div>

        <Card className="py-0 gap-0">
          <CardContent className="p-0">
            {authLoading ? (
              <div className="p-8 text-center text-muted-foreground">
                Loading authentication status...
              </div>
            ) : (
              <div className="flex flex-col">
                {authData?.authStatus.map((status) => (
                  <ProviderRow
                    key={status.provider}
                    status={status}
                    setDefaultMutation={setDefaultMutation}
                    removeMutation={removeMutation}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Custom Variants */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Custom Variants</h2>
            <p className="text-sm text-muted-foreground">
              Create custom aliases for providers with specific accounts.
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="text-muted-foreground">Loading variants...</div>
        ) : (
          <CliproxyTable data={data?.variants || []} />
        )}
      </div>

      <CliproxyDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </div>
  );
}
