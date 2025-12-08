/**
 * CLIProxy Page
 * Phase 03: REST API Routes & CRUD
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Check, X } from 'lucide-react';
import { CliproxyTable } from '@/components/cliproxy-table';
import { CliproxyDialog } from '@/components/cliproxy-dialog';
import { useCliproxy, useCliproxyAuth } from '@/hooks/use-cliproxy';

export function CliproxyPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data, isLoading } = useCliproxy();
  const { data: authData, isLoading: authLoading } = useCliproxyAuth();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">CLIProxy</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage OAuth-based provider variants (Gemini, Codex, Antigravity, Qwen)
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Create Variant
        </Button>
      </div>

      {/* Built-in Profiles Auth Status */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Built-in Profiles</h2>
        {authLoading ? (
          <div className="text-muted-foreground">Loading auth status...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {authData?.authStatus.map((status) => (
              <div
                key={status.provider}
                className={`p-4 rounded-lg border ${
                  status.authenticated
                    ? 'border-green-500/30 bg-green-500/5'
                    : 'border-muted bg-muted/5'
                }`}
              >
                <div className="flex items-center gap-2">
                  {status.authenticated ? (
                    <Check className="w-4 h-4 text-green-500" />
                  ) : (
                    <X className="w-4 h-4 text-muted-foreground" />
                  )}
                  <span className="font-medium">{status.displayName}</span>
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {status.authenticated ? (
                    <>
                      Authenticated
                      {status.lastAuth && (
                        <span className="ml-1">
                          ({new Date(status.lastAuth).toLocaleDateString()})
                        </span>
                      )}
                    </>
                  ) : (
                    <>
                      Not authenticated
                      <span className="block text-xs mt-1">
                        Run:{' '}
                        <code className="bg-muted px-1 rounded">ccs {status.provider} --auth</code>
                      </span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Custom Variants */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Custom Variants</h2>
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
