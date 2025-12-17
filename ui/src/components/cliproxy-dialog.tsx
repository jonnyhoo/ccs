/**
 * CLIProxy Variant Dialog Component
 * Phase 03: REST API Routes & CRUD
 * Phase 06: Multi-Account Support
 */

import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCreateVariant, useCliproxyAuth } from '@/hooks/use-cliproxy';
import { usePrivacy } from '@/contexts/privacy-context';

const providers = ['gemini', 'codex', 'agy', 'qwen', 'iflow'] as const;

const schema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .regex(/^[a-zA-Z][a-zA-Z0-9._-]*$/, 'Invalid variant name'),
  provider: z.enum(providers, { message: 'Provider is required' }),
  model: z.string().optional(),
  account: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface CliproxyDialogProps {
  open: boolean;
  onClose: () => void;
}

const providerOptions = [
  { value: 'gemini', label: 'Google Gemini' },
  { value: 'codex', label: 'OpenAI Codex' },
  { value: 'agy', label: 'Antigravity' },
  { value: 'qwen', label: 'Alibaba Qwen' },
  { value: 'iflow', label: 'iFlow' },
];

export function CliproxyDialog({ open, onClose }: CliproxyDialogProps) {
  const createMutation = useCreateVariant();
  const { data: authData } = useCliproxyAuth();
  const { privacyMode } = usePrivacy();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  // Watch provider to show relevant accounts
  const selectedProvider = useWatch({ control, name: 'provider' });

  // Get accounts for selected provider
  const providerAuth = authData?.authStatus.find((s) => s.provider === selectedProvider);
  const providerAccounts = providerAuth?.accounts || [];

  const onSubmit = async (data: FormData) => {
    try {
      await createMutation.mutateAsync(data);
      reset();
      onClose();
    } catch (error) {
      console.error('Failed to create variant:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create CLIProxy Variant</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input id="name" {...register('name')} placeholder="my-gemini" />
            {errors.name && <span className="text-xs text-red-500">{errors.name.message}</span>}
          </div>

          <div>
            <Label htmlFor="provider">Provider</Label>
            <select
              id="provider"
              {...register('provider')}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">Select provider...</option>
              {providerOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {errors.provider && (
              <span className="text-xs text-red-500">{errors.provider.message}</span>
            )}
          </div>

          {/* Account selector - only show if provider has accounts */}
          {selectedProvider && providerAccounts.length > 0 && (
            <div>
              <Label htmlFor="account">Account</Label>
              <select
                id="account"
                {...register('account')}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">Use default account</option>
                {providerAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {privacyMode ? '••••••' : acc.email || acc.id}
                    {acc.isDefault ? ' (default)' : ''}
                  </option>
                ))}
              </select>
              <span className="text-xs text-muted-foreground mt-1 block">
                Select which OAuth account this variant should use
              </span>
            </div>
          )}

          {/* Show message if provider selected but no accounts */}
          {selectedProvider && providerAccounts.length === 0 && providerAuth && (
            <div className="text-sm text-amber-600 bg-amber-50 dark:bg-amber-950/20 p-3 rounded-md">
              No accounts authenticated for {providerAuth.displayName}.
              <br />
              <code className="text-xs bg-muted px-1 rounded">ccs {selectedProvider} --auth</code>
            </div>
          )}

          <div>
            <Label htmlFor="model">Model (optional)</Label>
            <Input id="model" {...register('model')} placeholder="gemini-2.5-pro" />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating...' : 'Create'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
