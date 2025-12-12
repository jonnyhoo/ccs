/**
 * Quick Setup Wizard Component
 * Phase 03: Multi-account dashboard support
 *
 * Step-by-step wizard: Provider -> Auth -> Account -> Variant -> Success
 */

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Copy,
  Check,
  RefreshCw,
  ChevronRight,
  ArrowLeft,
  Terminal,
  User,
  Sparkles,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import { useCliproxyAuth, useCreateVariant, useStartAuth } from '@/hooks/use-cliproxy';
import type { AuthStatus, OAuthAccount } from '@/lib/api-client';
import { MODEL_CATALOGS } from '@/lib/model-catalogs';

interface QuickSetupWizardProps {
  open: boolean;
  onClose: () => void;
}

type WizardStep = 'provider' | 'auth' | 'account' | 'variant' | 'success';

const providers = [
  { id: 'gemini', name: 'Google Gemini', description: 'Gemini Pro/Flash models' },
  { id: 'codex', name: 'OpenAI Codex', description: 'GPT-4 and codex models' },
  { id: 'agy', name: 'Antigravity', description: 'Antigravity AI models' },
  { id: 'qwen', name: 'Alibaba Qwen', description: 'Qwen Code models' },
  { id: 'iflow', name: 'iFlow', description: 'iFlow AI models' },
];

export function QuickSetupWizard({ open, onClose }: QuickSetupWizardProps) {
  const [step, setStep] = useState<WizardStep>('provider');
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [selectedAccount, setSelectedAccount] = useState<OAuthAccount | null>(null);
  const [variantName, setVariantName] = useState('');
  const [modelName, setModelName] = useState('');
  const [copied, setCopied] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isAddingNewAccount, setIsAddingNewAccount] = useState(false); // Track explicit "add account" action

  const { data: authData, refetch } = useCliproxyAuth();
  const createMutation = useCreateVariant();
  const startAuthMutation = useStartAuth();

  // Get auth status for selected provider
  const providerAuth = authData?.authStatus.find(
    (s: AuthStatus) => s.provider === selectedProvider
  );
  const accounts = providerAuth?.accounts || [];

  // Reset on close - use timeout to avoid synchronous setState in effect
  useEffect(() => {
    if (!open) {
      const timer = setTimeout(() => {
        setStep('provider');
        setSelectedProvider('');
        setSelectedAccount(null);
        setVariantName('');
        setModelName('');
        setCopied(false);
        setIsAddingNewAccount(false);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Auto-advance from auth step when account detected
  // BUT only if user didn't explicitly click "Add new account"
  useEffect(() => {
    if (step === 'auth' && accounts.length > 0 && !isAddingNewAccount) {
      const timer = setTimeout(() => {
        setStep('account');
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [step, accounts, isAddingNewAccount]);

  const copyCommand = async (cmd: string) => {
    await navigator.clipboard.writeText(cmd);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  };

  const handleStartAuth = () => {
    startAuthMutation.mutate(
      { provider: selectedProvider },
      {
        onSuccess: (data) => {
          // Account created, select it and advance to variant step
          if (data.account) {
            setSelectedAccount(data.account as OAuthAccount);
            setStep('variant');
          }
          refetch(); // Refresh auth status
        },
      }
    );
  };

  const handleProviderSelect = (providerId: string) => {
    setSelectedProvider(providerId);
    const auth = authData?.authStatus.find((s: AuthStatus) => s.provider === providerId);
    const provAccounts = auth?.accounts || [];

    if (provAccounts.length === 0) {
      // No accounts - go to auth step to add first account
      setStep('auth');
    } else {
      // Has accounts - always show account selection (includes "Add new account" option)
      setStep('account');
    }
  };

  const handleAccountSelect = (account: OAuthAccount) => {
    setSelectedAccount(account);
    setStep('variant');
  };

  const handleCreateVariant = async () => {
    if (!variantName || !selectedProvider) return;

    try {
      await createMutation.mutateAsync({
        name: variantName,
        provider: selectedProvider as 'gemini' | 'codex' | 'agy' | 'qwen' | 'iflow',
        model: modelName || undefined,
        account: selectedAccount?.id,
      });
      setStep('success');
    } catch (error) {
      console.error('Failed to create variant:', error);
    }
  };

  const authCommand = `ccs ${selectedProvider} --auth --add`;

  // Progress steps for indicator
  const allSteps = ['provider', 'auth', 'variant', 'success'];
  const getStepProgress = (s: WizardStep) => {
    if (s === 'account') return 1; // Same as auth
    return allSteps.indexOf(s);
  };
  const currentProgress = getStepProgress(step);

  // Prevent accidental close when user has made progress
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      // Allow closing from success step or provider step (no progress yet)
      if (step === 'success' || step === 'provider') {
        onClose();
        return;
      }
      // For other steps, require explicit close via Cancel/Back
      // The X button still works, but clicking outside doesn't close
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="sm:max-w-lg"
        onPointerDownOutside={(e) => {
          // Prevent closing on outside click when user has made progress
          if (step !== 'success' && step !== 'provider') {
            e.preventDefault();
          }
        }}
        onEscapeKeyDown={(e) => {
          // Prevent ESC close during auth or variant creation
          if (startAuthMutation.isPending || createMutation.isPending) {
            e.preventDefault();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Quick Setup Wizard
          </DialogTitle>
          <DialogDescription>
            {step === 'provider' && 'Select a provider to get started'}
            {step === 'auth' && 'Authenticate with your provider'}
            {step === 'account' && 'Select which account to use'}
            {step === 'variant' && 'Create your custom variant'}
            {step === 'success' && 'Setup complete!'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Step: Provider Selection */}
          {step === 'provider' && (
            <div className="grid gap-2">
              {providers.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleProviderSelect(p.id)}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors text-left"
                >
                  <div>
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-muted-foreground">{p.description}</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </button>
              ))}
            </div>
          )}

          {/* Step: Authentication */}
          {step === 'auth' && (
            <div className="space-y-4">
              {/* Primary: OAuth Button */}
              <div className="text-center space-y-3">
                <p className="text-sm text-muted-foreground">
                  Authenticate with {providers.find((p) => p.id === selectedProvider)?.name} to add
                  an account
                </p>
                <Button
                  onClick={handleStartAuth}
                  disabled={startAuthMutation.isPending}
                  className="w-full gap-2"
                  size="lg"
                >
                  {startAuthMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Authenticating...
                    </>
                  ) : (
                    <>
                      <ExternalLink className="w-4 h-4" />
                      Authenticate in Browser
                    </>
                  )}
                </Button>
                {startAuthMutation.isPending && (
                  <p className="text-xs text-muted-foreground">
                    Complete the OAuth flow in your browser...
                  </p>
                )}
              </div>

              {/* Divider */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">Or use terminal</span>
                </div>
              </div>

              {/* Secondary: CLI Command */}
              <Card>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Terminal className="w-4 h-4" />
                    Run this command in your terminal:
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 px-3 py-2 bg-muted rounded-md font-mono text-sm">
                      {authCommand}
                    </code>
                    <Button variant="outline" size="icon" onClick={() => copyCommand(authCommand)}>
                      {copied ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <div className="flex items-center justify-between">
                <Button
                  variant="ghost"
                  onClick={() => setStep('provider')}
                  disabled={startAuthMutation.isPending}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                <Button
                  variant="outline"
                  onClick={handleRefresh}
                  disabled={isRefreshing || startAuthMutation.isPending}
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                  {isRefreshing ? 'Checking...' : 'Refresh Status'}
                </Button>
              </div>
            </div>
          )}

          {/* Step: Account Selection */}
          {step === 'account' && (
            <div className="space-y-4">
              {/* Existing accounts header */}
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Select an account ({accounts.length})
              </div>

              <div className="grid gap-2">
                {accounts.map((acc: OAuthAccount) => (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => handleAccountSelect(acc)}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                        <User className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div>
                        <div className="font-medium">{acc.email || acc.id}</div>
                        {acc.isDefault && (
                          <div className="text-xs text-muted-foreground">Default account</div>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </button>
                ))}
              </div>

              {/* Divider */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">Or</span>
                </div>
              </div>

              {/* Add new account button - more prominent */}
              <button
                type="button"
                className="w-full flex items-center gap-3 p-3 border-2 border-dashed border-primary/50 rounded-lg hover:border-primary hover:bg-primary/5 transition-colors text-left"
                onClick={() => {
                  setIsAddingNewAccount(true);
                  setStep('auth');
                }}
              >
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <ExternalLink className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <div className="font-medium text-primary">Add new account</div>
                  <div className="text-xs text-muted-foreground">
                    Authenticate with a different account
                  </div>
                </div>
              </button>

              <div className="flex items-center justify-between pt-2">
                <Button variant="ghost" onClick={() => setStep('provider')}>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
              </div>
            </div>
          )}

          {/* Step: Create Variant */}
          {step === 'variant' && (
            <div className="space-y-4">
              {selectedAccount && (
                <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md text-sm">
                  <User className="w-4 h-4" />
                  <span>Using: {selectedAccount.email || selectedAccount.id}</span>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="variant-name">Variant Name *</Label>
                <Input
                  id="variant-name"
                  value={variantName}
                  onChange={(e) => setVariantName(e.target.value)}
                  placeholder="e.g., my-gemini, g3, flash"
                />
                <div className="text-xs text-muted-foreground">
                  Use this name to invoke: ccs {variantName || '<name>'} "prompt"
                </div>
              </div>

              <div className="space-y-2">
                <Label>Model</Label>
                <Select value={modelName} onValueChange={setModelName}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a model" />
                  </SelectTrigger>
                  <SelectContent>
                    {MODEL_CATALOGS[selectedProvider]?.models.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        <div className="flex items-center gap-2">
                          <span>{m.name}</span>
                          {m.description && (
                            <span className="text-xs text-muted-foreground">
                              - {m.description}
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="text-xs text-muted-foreground">
                  Default: {MODEL_CATALOGS[selectedProvider]?.defaultModel || 'provider default'}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <Button
                  variant="ghost"
                  onClick={() => (accounts.length > 0 ? setStep('account') : setStep('provider'))}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" onClick={onClose}>
                    Skip
                  </Button>
                  <Button
                    onClick={handleCreateVariant}
                    disabled={!variantName || createMutation.isPending}
                  >
                    {createMutation.isPending ? 'Creating...' : 'Create Variant'}
                  </Button>
                </div>
              </div>
              <p className="text-xs text-center text-muted-foreground">
                Skip if you just wanted to add an account without creating a variant
              </p>
            </div>
          )}

          {/* Step: Success */}
          {step === 'success' && (
            <div className="space-y-4 text-center">
              <div className="flex justify-center">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                  <Check className="w-8 h-8 text-green-600 dark:text-green-400" />
                </div>
              </div>
              <div>
                <div className="font-semibold text-lg">Variant Created!</div>
                <div className="text-sm text-muted-foreground">
                  Your custom variant is ready to use
                </div>
              </div>
              <Card>
                <CardContent className="p-4 space-y-2">
                  <div className="text-sm text-muted-foreground">Usage:</div>
                  <code className="block px-3 py-2 bg-muted rounded-md font-mono text-sm">
                    ccs {variantName} "your prompt here"
                  </code>
                </CardContent>
              </Card>
              <Button onClick={onClose} className="w-full">
                Done
              </Button>
            </div>
          )}
        </div>

        {/* Progress indicator */}
        <div className="flex justify-center gap-1 pt-2">
          {allSteps.map((s, i) => (
            <div
              key={s}
              className={`w-2 h-2 rounded-full transition-colors ${
                currentProgress >= i ? 'bg-primary' : 'bg-muted'
              }`}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
