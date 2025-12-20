/**
 * Accounts Page
 * Phase 03: REST API Routes & CRUD
 */

import { AccountsTable } from '@/components/account/accounts-table';
import { useAccounts } from '@/hooks/use-accounts';

export function AccountsPage() {
  const { data, isLoading } = useAccounts();

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Accounts</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage multi-account Claude sessions (profiles.json)
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground">Loading accounts...</div>
      ) : (
        <AccountsTable data={data?.accounts || []} defaultAccount={data?.default ?? null} />
      )}

      <div className="text-sm text-muted-foreground border-t pt-4 mt-4">
        <p>
          Accounts are isolated Claude instances with separate sessions.
          <br />
          Use <code className="bg-muted px-1 rounded">ccs auth create &lt;name&gt;</code> to add new
          accounts via CLI.
        </p>
      </div>
    </div>
  );
}
