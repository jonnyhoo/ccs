/**
 * Provider Editor Component
 * Split-view editor for CLIProxy provider settings
 * Similar to ProfileEditor but tailored for provider configuration
 */

import { useState, useMemo, useCallback, lazy, Suspense } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Separator } from '@/components/ui/separator';
import { CopyButton } from '@/components/ui/copy-button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Save,
  Loader2,
  Code2,
  Trash2,
  RefreshCw,
  Info,
  X,
  Shield,
  User,
  Plus,
  Star,
  MoreHorizontal,
  Clock,
  Sparkles,
  Zap,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { ProviderLogo } from './provider-logo';
import { FlexibleModelSelector } from './provider-model-selector';
import type { ProviderCatalog } from './provider-model-selector';
import type { AuthStatus, OAuthAccount } from '@/lib/api-client';
import {
  useCliproxyModels,
  usePresets,
  useCreatePreset,
  useDeletePreset,
} from '@/hooks/use-cliproxy';
import { cn } from '@/lib/utils';

// Lazy load CodeEditor
const CodeEditor = lazy(() =>
  import('@/components/code-editor').then((m) => ({ default: m.CodeEditor }))
);

interface SettingsResponse {
  profile: string;
  settings: {
    env?: Record<string, string>;
  };
  mtime: number;
  path: string;
}

interface ProviderEditorProps {
  provider: string;
  displayName: string;
  authStatus: AuthStatus;
  catalog?: ProviderCatalog;
  /** Provider type for logo display (defaults to provider) */
  logoProvider?: string;
  onAddAccount: () => void;
  onSetDefault: (accountId: string) => void;
  onRemoveAccount: (accountId: string) => void;
  isRemovingAccount?: boolean;
}

export function ProviderEditor({
  provider,
  displayName,
  authStatus,
  catalog,
  logoProvider,
  onAddAccount,
  onSetDefault,
  onRemoveAccount,
  isRemovingAccount,
}: ProviderEditorProps) {
  const [rawJsonEdits, setRawJsonEdits] = useState<string | null>(null);
  const [conflictDialog, setConflictDialog] = useState(false);
  const [customPresetOpen, setCustomPresetOpen] = useState(false);
  const queryClient = useQueryClient();

  // Fetch available models from CLIProxy API
  const { data: modelsData } = useCliproxyModels();

  // Fetch saved presets for this provider
  const { data: presetsData } = usePresets(provider);
  const createPresetMutation = useCreatePreset();
  const deletePresetMutation = useDeletePreset();
  const savedPresets = presetsData?.presets || [];

  // Get models for this provider based on owned_by field
  const providerModels = useMemo(() => {
    if (!modelsData?.models) return [];
    const ownerMap: Record<string, string[]> = {
      gemini: ['google'],
      agy: ['antigravity'],
      codex: ['openai'],
      qwen: ['alibaba', 'qwen'],
      iflow: ['iflow'],
    };
    const owners = ownerMap[provider.toLowerCase()] || [provider.toLowerCase()];
    return modelsData.models.filter((m) =>
      owners.some((o) => m.owned_by.toLowerCase().includes(o))
    );
  }, [modelsData, provider]);

  // Fetch settings for this provider
  const { data, isLoading, refetch } = useQuery<SettingsResponse>({
    queryKey: ['settings', provider],
    queryFn: async () => {
      const res = await fetch(`/api/settings/${provider}/raw`);
      if (!res.ok) {
        // Return empty settings for unconfigured providers
        return {
          profile: provider,
          settings: { env: {} },
          mtime: Date.now(),
          path: `~/.ccs/profiles/${provider}/settings.json`,
        };
      }
      return res.json();
    },
  });

  const settings = data?.settings;

  // Derive raw JSON content
  const rawJsonContent = useMemo(() => {
    if (rawJsonEdits !== null) return rawJsonEdits;
    if (settings) return JSON.stringify(settings, null, 2);
    return '{\n  "env": {}\n}';
  }, [rawJsonEdits, settings]);

  const handleRawJsonChange = useCallback((value: string) => {
    setRawJsonEdits(value);
  }, []);

  // Parse current settings from JSON
  const currentSettings = useMemo(() => {
    try {
      return JSON.parse(rawJsonContent);
    } catch {
      return settings || { env: {} };
    }
  }, [rawJsonContent, settings]);

  // Extract model values from settings
  const currentModel = currentSettings?.env?.ANTHROPIC_MODEL;
  const opusModel = currentSettings?.env?.ANTHROPIC_DEFAULT_OPUS_MODEL;
  const sonnetModel = currentSettings?.env?.ANTHROPIC_DEFAULT_SONNET_MODEL;
  const haikuModel = currentSettings?.env?.ANTHROPIC_DEFAULT_HAIKU_MODEL;

  // Update a setting value
  const updateEnvValue = (key: string, value: string) => {
    const newEnv = { ...(currentSettings?.env || {}), [key]: value };
    const newSettings = { ...currentSettings, env: newEnv };
    setRawJsonEdits(JSON.stringify(newSettings, null, 2));
  };

  // Batch update multiple env values at once
  const updateEnvValues = (updates: Record<string, string>) => {
    const newEnv = { ...(currentSettings?.env || {}), ...updates };
    const newSettings = { ...currentSettings, env: newEnv };
    setRawJsonEdits(JSON.stringify(newSettings, null, 2));
  };

  // Check if JSON is valid
  const isRawJsonValid = useMemo(() => {
    try {
      JSON.parse(rawJsonContent);
      return true;
    } catch {
      return false;
    }
  }, [rawJsonContent]);

  // Check for unsaved changes
  const hasChanges = useMemo(() => {
    if (rawJsonEdits === null) return false;
    return rawJsonEdits !== JSON.stringify(settings, null, 2);
  }, [rawJsonEdits, settings]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const settingsToSave = JSON.parse(rawJsonContent);
      const res = await fetch(`/api/settings/${provider}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: settingsToSave,
          expectedMtime: data?.mtime,
        }),
      });

      if (res.status === 409) throw new Error('CONFLICT');
      if (!res.ok) throw new Error('Failed to save');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', provider] });
      setRawJsonEdits(null);
      toast.success('Settings saved');
    },
    onError: (error: Error) => {
      if (error.message === 'CONFLICT') {
        setConflictDialog(true);
      } else {
        toast.error(error.message);
      }
    },
  });

  const handleConflictResolve = async (overwrite: boolean) => {
    setConflictDialog(false);
    if (overwrite) {
      await refetch();
      saveMutation.mutate();
    } else {
      setRawJsonEdits(null);
    }
  };

  const accounts = authStatus.accounts || [];

  // Render Left Column - Model Config + Info tabs
  const renderFriendlyUI = () => (
    <div className="h-full flex flex-col">
      <Tabs defaultValue="config" className="h-full flex flex-col">
        <div className="px-4 pt-4 shrink-0">
          <TabsList className="w-full">
            <TabsTrigger value="config" className="flex-1">
              Model Config
            </TabsTrigger>
            <TabsTrigger value="info" className="flex-1">
              Info & Usage
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Model Config Tab */}
          <TabsContent
            value="config"
            className="flex-1 mt-0 border-0 p-0 data-[state=inactive]:hidden flex flex-col overflow-hidden"
          >
            <ScrollArea className="flex-1">
              <div className="p-4 space-y-6">
                {/* Quick Presets */}
                {(catalog && catalog.models.length > 0) || savedPresets.length > 0 ? (
                  <div>
                    <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
                      <Sparkles className="w-4 h-4" />
                      Presets
                    </h3>
                    <p className="text-xs text-muted-foreground mb-3">
                      Apply pre-configured model mappings
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {/* Recommended presets from catalog */}
                      {catalog?.models.slice(0, 3).map((model) => (
                        <Button
                          key={model.id}
                          variant="outline"
                          size="sm"
                          className="text-xs h-7 gap-1"
                          onClick={() => {
                            const mapping = model.presetMapping || {
                              default: model.id,
                              opus: model.id,
                              sonnet: model.id,
                              haiku: model.id,
                            };
                            updateEnvValues({
                              ANTHROPIC_MODEL: mapping.default,
                              ANTHROPIC_DEFAULT_OPUS_MODEL: mapping.opus,
                              ANTHROPIC_DEFAULT_SONNET_MODEL: mapping.sonnet,
                              ANTHROPIC_DEFAULT_HAIKU_MODEL: mapping.haiku,
                            });
                            toast.success(`Applied "${model.name}" preset`);
                          }}
                        >
                          <Zap className="w-3 h-3" />
                          {model.name}
                        </Button>
                      ))}

                      {/* User saved presets */}
                      {savedPresets.map((preset) => (
                        <div key={preset.name} className="group relative">
                          <Button
                            variant="secondary"
                            size="sm"
                            className="text-xs h-7 gap-1 pr-6"
                            onClick={() => {
                              updateEnvValues({
                                ANTHROPIC_MODEL: preset.default,
                                ANTHROPIC_DEFAULT_OPUS_MODEL: preset.opus,
                                ANTHROPIC_DEFAULT_SONNET_MODEL: preset.sonnet,
                                ANTHROPIC_DEFAULT_HAIKU_MODEL: preset.haiku,
                              });
                              toast.success(`Applied "${preset.name}" preset`);
                            }}
                          >
                            <Star className="w-3 h-3 fill-current" />
                            {preset.name}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="absolute right-0 top-0 h-7 w-5 opacity-0 group-hover:opacity-100 hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              deletePresetMutation.mutate({ profile: provider, name: preset.name });
                            }}
                            disabled={deletePresetMutation.isPending}
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}

                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-7 gap-1 border-primary/50 text-primary hover:bg-primary/10 hover:border-primary"
                        onClick={() => setCustomPresetOpen(true)}
                      >
                        <Plus className="w-3 h-3" />
                        Custom
                      </Button>
                    </div>
                  </div>
                ) : null}

                <Separator />

                {/* Model Mapping */}
                <div>
                  <h3 className="text-sm font-medium mb-2">Model Mapping</h3>
                  <p className="text-xs text-muted-foreground mb-4">
                    Configure which models to use for each tier
                  </p>
                  <div className="space-y-4">
                    <FlexibleModelSelector
                      label="Default Model"
                      description="Used when no specific tier is requested"
                      value={currentModel}
                      onChange={(model) => updateEnvValue('ANTHROPIC_MODEL', model)}
                      catalog={catalog}
                      allModels={providerModels}
                    />
                    <FlexibleModelSelector
                      label="Opus (Most capable)"
                      description="For complex reasoning tasks"
                      value={opusModel}
                      onChange={(model) => updateEnvValue('ANTHROPIC_DEFAULT_OPUS_MODEL', model)}
                      catalog={catalog}
                      allModels={providerModels}
                    />
                    <FlexibleModelSelector
                      label="Sonnet (Balanced)"
                      description="Balance of speed and capability"
                      value={sonnetModel}
                      onChange={(model) => updateEnvValue('ANTHROPIC_DEFAULT_SONNET_MODEL', model)}
                      catalog={catalog}
                      allModels={providerModels}
                    />
                    <FlexibleModelSelector
                      label="Haiku (Fast)"
                      description="Quick responses for simple tasks"
                      value={haikuModel}
                      onChange={(model) => updateEnvValue('ANTHROPIC_DEFAULT_HAIKU_MODEL', model)}
                      catalog={catalog}
                      allModels={providerModels}
                    />
                  </div>
                </div>

                <Separator />

                {/* Accounts Section */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium flex items-center gap-2">
                      <User className="w-4 h-4" />
                      Accounts
                      {accounts.length > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {accounts.length}
                        </Badge>
                      )}
                    </h3>
                    <Button
                      variant="default"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      onClick={onAddAccount}
                    >
                      <Plus className="w-3 h-3" />
                      Add
                    </Button>
                  </div>

                  {accounts.length > 0 ? (
                    <div className="space-y-2">
                      {accounts.map((account) => (
                        <AccountItem
                          key={account.id}
                          account={account}
                          onSetDefault={() => onSetDefault(account.id)}
                          onRemove={() => onRemoveAccount(account.id)}
                          isRemoving={isRemovingAccount}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="py-6 text-center text-muted-foreground bg-muted/30 rounded-lg border border-dashed">
                      <User className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No accounts connected</p>
                      <p className="text-xs opacity-70">Add an account to get started</p>
                    </div>
                  )}
                </div>
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Info Tab */}
          <TabsContent
            value="info"
            className="h-full mt-0 border-0 p-0 data-[state=inactive]:hidden"
          >
            <ScrollArea className="h-full">
              <div className="p-4 space-y-6">
                {/* Provider Information */}
                <div>
                  <h3 className="text-sm font-medium flex items-center gap-2 mb-3">
                    <Info className="w-4 h-4" />
                    Provider Information
                  </h3>
                  <div className="space-y-3 bg-card rounded-lg border p-4 shadow-sm">
                    <div className="grid grid-cols-[100px_1fr] gap-2 text-sm items-center">
                      <span className="font-medium text-muted-foreground">Provider</span>
                      <span className="font-mono">{displayName}</span>
                    </div>
                    {data && (
                      <>
                        <div className="grid grid-cols-[100px_1fr] gap-2 text-sm items-center">
                          <span className="font-medium text-muted-foreground">File Path</span>
                          <div className="flex items-center gap-2 min-w-0">
                            <code className="bg-muted px-1.5 py-0.5 rounded text-xs break-all">
                              {data.path}
                            </code>
                            <CopyButton value={data.path} size="icon" className="h-5 w-5" />
                          </div>
                        </div>
                        <div className="grid grid-cols-[100px_1fr] gap-2 text-sm items-center">
                          <span className="font-medium text-muted-foreground">Last Modified</span>
                          <span className="text-xs">{new Date(data.mtime).toLocaleString()}</span>
                        </div>
                      </>
                    )}
                    <div className="grid grid-cols-[100px_1fr] gap-2 text-sm items-center">
                      <span className="font-medium text-muted-foreground">Status</span>
                      {authStatus.authenticated ? (
                        <Badge
                          variant="outline"
                          className="w-fit text-green-600 border-green-200 bg-green-50"
                        >
                          <Shield className="w-3 h-3 mr-1" />
                          Authenticated
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="w-fit text-muted-foreground">
                          Not connected
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                {/* Quick Usage */}
                <div>
                  <h3 className="text-sm font-medium mb-3">Quick Usage</h3>
                  <div className="space-y-3 bg-card rounded-lg border p-4 shadow-sm">
                    <UsageCommand
                      label="Run with prompt"
                      command={`ccs ${provider} "your prompt"`}
                    />
                    <UsageCommand label="Change model" command={`ccs ${provider} --config`} />
                    <UsageCommand label="Add account" command={`ccs ${provider} --add`} />
                    <UsageCommand label="List accounts" command={`ccs ${provider} --accounts`} />
                  </div>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );

  // Render Right Column - Raw JSON Editor
  const renderRawEditor = () => (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-full">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Loading editor...</span>
        </div>
      }
    >
      <div className="h-full flex flex-col">
        {!isRawJsonValid && rawJsonEdits !== null && (
          <div className="mb-2 px-3 py-2 bg-destructive/10 text-destructive text-sm rounded-md flex items-center gap-2 mx-6 mt-4 shrink-0">
            <X className="w-4 h-4" />
            Invalid JSON syntax
          </div>
        )}
        <div className="flex-1 overflow-hidden px-6 pb-6 pt-4">
          <div className="h-full border rounded-md overflow-hidden bg-background">
            <CodeEditor
              value={rawJsonContent}
              onChange={handleRawJsonChange}
              language="json"
              minHeight="100%"
            />
          </div>
        </div>
      </div>
    </Suspense>
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b bg-background flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <ProviderLogo provider={logoProvider || provider} size="lg" />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">{displayName}</h2>
              {data && (
                <Badge variant="outline" className="text-xs">
                  {data.path.replace(/^.*\//, '')}
                </Badge>
              )}
            </div>
            {data && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Last modified: {new Date(data.mtime).toLocaleString()}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            size="sm"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !hasChanges || !isRawJsonValid}
          >
            {saveMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-1" />
                Save
              </>
            )}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          <span className="ml-3 text-muted-foreground">Loading settings...</span>
        </div>
      ) : (
        // Split Layout (40% Left / 60% Right)
        <div className="flex-1 grid grid-cols-[40%_60%] divide-x overflow-hidden">
          {/* Left Column: Friendly UI */}
          <div className="flex flex-col overflow-hidden bg-muted/5">{renderFriendlyUI()}</div>

          {/* Right Column: Raw Editor */}
          <div className="flex flex-col overflow-hidden">
            <div className="px-6 py-2 bg-muted/30 border-b flex items-center gap-2 shrink-0 h-[45px]">
              <Code2 className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">
                Raw Configuration (JSON)
              </span>
            </div>
            {renderRawEditor()}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={conflictDialog}
        title="File Modified Externally"
        description="This settings file was modified by another process. Overwrite with your changes or discard?"
        confirmText="Overwrite"
        variant="destructive"
        onConfirm={() => handleConflictResolve(true)}
        onCancel={() => handleConflictResolve(false)}
      />

      {/* Custom Preset Dialog */}
      <CustomPresetDialog
        open={customPresetOpen}
        onClose={() => setCustomPresetOpen(false)}
        currentValues={{
          default: currentModel || '',
          opus: opusModel || '',
          sonnet: sonnetModel || '',
          haiku: haikuModel || '',
        }}
        onApply={(values, presetName) => {
          updateEnvValues({
            ANTHROPIC_MODEL: values.default,
            ANTHROPIC_DEFAULT_OPUS_MODEL: values.opus,
            ANTHROPIC_DEFAULT_SONNET_MODEL: values.sonnet,
            ANTHROPIC_DEFAULT_HAIKU_MODEL: values.haiku,
          });
          toast.success(`Applied ${presetName ? `"${presetName}"` : 'custom'} preset`);
          setCustomPresetOpen(false);
        }}
        onSave={(values, presetName) => {
          if (!presetName) {
            toast.error('Please enter a preset name to save');
            return;
          }
          createPresetMutation.mutate({
            profile: provider,
            data: {
              name: presetName,
              default: values.default,
              opus: values.opus,
              sonnet: values.sonnet,
              haiku: values.haiku,
            },
          });
          setCustomPresetOpen(false);
        }}
        isSaving={createPresetMutation.isPending}
        catalog={catalog}
        allModels={providerModels}
      />
    </div>
  );
}

/** Account item component */
function AccountItem({
  account,
  onSetDefault,
  onRemove,
  isRemoving,
}: {
  account: OAuthAccount;
  onSetDefault: () => void;
  onRemove: () => void;
  isRemoving?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between p-3 rounded-lg border transition-colors',
        account.isDefault ? 'border-primary/30 bg-primary/5' : 'border-border hover:bg-muted/30'
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            'flex items-center justify-center w-8 h-8 rounded-full',
            account.isDefault ? 'bg-primary/10' : 'bg-muted'
          )}
        >
          <User className="w-4 h-4" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{account.email || account.id}</span>
            {account.isDefault && (
              <Badge variant="secondary" className="text-[10px] h-4 px-1.5 gap-0.5">
                <Star className="w-2.5 h-2.5 fill-current" />
                Default
              </Badge>
            )}
          </div>
          {account.lastUsedAt && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
              <Clock className="w-3 h-3" />
              Last used: {new Date(account.lastUsedAt).toLocaleDateString()}
            </div>
          )}
        </div>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7">
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {!account.isDefault && (
            <DropdownMenuItem onClick={onSetDefault}>
              <Star className="w-4 h-4 mr-2" />
              Set as default
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={onRemove}
            disabled={isRemoving}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            {isRemoving ? 'Removing...' : 'Remove account'}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/** Usage command with copy button */
function UsageCommand({ label, command }: { label: string; command: string }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      <div className="mt-1 flex gap-2">
        <code className="flex-1 px-2 py-1.5 bg-muted rounded text-xs font-mono truncate">
          {command}
        </code>
        <CopyButton value={command} size="icon" className="h-6 w-6" />
      </div>
    </div>
  );
}

/** Custom Preset Dialog - Configure all model mappings at once */
interface CustomPresetDialogProps {
  open: boolean;
  onClose: () => void;
  currentValues: {
    default: string;
    opus: string;
    sonnet: string;
    haiku: string;
  };
  onApply: (
    values: { default: string; opus: string; sonnet: string; haiku: string },
    presetName?: string
  ) => void;
  onSave?: (
    values: { default: string; opus: string; sonnet: string; haiku: string },
    presetName?: string
  ) => void;
  isSaving?: boolean;
  catalog?: ProviderCatalog;
  allModels: { id: string; owned_by: string }[];
}

function CustomPresetDialog({
  open,
  onClose,
  currentValues,
  onApply,
  onSave,
  isSaving,
  catalog,
  allModels,
}: CustomPresetDialogProps) {
  const [values, setValues] = useState(currentValues);
  const [presetName, setPresetName] = useState('');

  // Reset values when dialog opens with current values
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setValues(currentValues);
      setPresetName('');
    } else {
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            Custom Preset
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="preset-name">Preset Name (optional)</Label>
            <Input
              id="preset-name"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="e.g., My Custom Config"
              className="text-sm"
            />
          </div>
          <Separator />
          <FlexibleModelSelector
            label="Default Model"
            description="Used when no specific tier is requested"
            value={values.default}
            onChange={(model) => setValues({ ...values, default: model })}
            catalog={catalog}
            allModels={allModels}
          />
          <FlexibleModelSelector
            label="Opus (Most capable)"
            description="For complex reasoning tasks"
            value={values.opus}
            onChange={(model) => setValues({ ...values, opus: model })}
            catalog={catalog}
            allModels={allModels}
          />
          <FlexibleModelSelector
            label="Sonnet (Balanced)"
            description="Balance of speed and capability"
            value={values.sonnet}
            onChange={(model) => setValues({ ...values, sonnet: model })}
            catalog={catalog}
            allModels={allModels}
          />
          <FlexibleModelSelector
            label="Haiku (Fast)"
            description="Quick responses for simple tasks"
            value={values.haiku}
            onChange={(model) => setValues({ ...values, haiku: model })}
            catalog={catalog}
            allModels={allModels}
          />
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          {onSave && (
            <Button
              variant="secondary"
              onClick={() => onSave(values, presetName || undefined)}
              disabled={isSaving || !presetName.trim()}
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <Star className="w-4 h-4 mr-1" />
              )}
              Save Preset
            </Button>
          )}
          <Button onClick={() => onApply(values, presetName || undefined)}>
            <Zap className="w-4 h-4 mr-1" />
            Apply Preset
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
