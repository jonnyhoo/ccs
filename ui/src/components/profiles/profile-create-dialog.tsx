/**
 * Profile Create Dialog Component
 * Modal dialog with provider preset cards and model configuration
 */

/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useMemo } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useCreateProfile } from '@/hooks/use-profiles';
import { useOpenRouterCatalog } from '@/hooks/use-openrouter-models';
import { Loader2, Plus, AlertTriangle, Info, Eye, EyeOff, Settings2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  PROVIDER_PRESETS,
  getPresetsByCategory,
  type ProviderPreset,
} from '@/lib/provider-presets';
import {
  searchModels,
  formatPricingPair,
  formatContextLength,
  formatModelAge,
  getNewestModelsPerProvider,
} from '@/lib/openrouter-utils';
import type { CategorizedModel } from '@/lib/openrouter-types';

const schema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .regex(/^[a-zA-Z][a-zA-Z0-9._-]*$/, 'Must start with letter, only letters/numbers/.-_'),
  baseUrl: z.string().url('Invalid URL format'),
  apiKey: z.string().min(1, 'API key is required'),
  model: z.string().optional(),
  opusModel: z.string().optional(),
  sonnetModel: z.string().optional(),
  haikuModel: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface ProfileCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (name: string) => void;
  initialMode?: 'normal' | 'openrouter';
}

// Common URL mistakes to warn about
const PROBLEMATIC_PATHS = ['/chat/completions', '/v1/messages', '/messages', '/completions'];

export function ProfileCreateDialog({ open, onOpenChange, onSuccess }: ProfileCreateDialogProps) {
  const createMutation = useCreateProfile();
  const [activeTab, setActiveTab] = useState('basic');
  const [urlWarning, setUrlWarning] = useState<string | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string | null>('openrouter');
  const [modelSearch, setModelSearch] = useState('');

  // OpenRouter models for model picker
  const { models: openRouterModels } = useOpenRouterCatalog();

  const {
    register,
    handleSubmit,
    formState: { errors },
    control,
    reset,
    setValue,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      baseUrl: '',
      apiKey: '',
      model: '',
      opusModel: '',
      sonnetModel: '',
      haikuModel: '',
    },
  });

  const baseUrlValue = useWatch({ control, name: 'baseUrl' });

  // Get current preset config
  const currentPreset = useMemo(() => {
    if (!selectedPreset || selectedPreset === 'custom') return null;
    return PROVIDER_PRESETS.find((p) => p.id === selectedPreset);
  }, [selectedPreset]);

  // Filter models for OpenRouter search (newest first)
  const filteredModels = useMemo(() => {
    if (!modelSearch.trim()) {
      // Show newest models when no search
      return getNewestModelsPerProvider(openRouterModels, 2);
    }
    // Search and sort by created date (newest first)
    const results = searchModels(openRouterModels, modelSearch);
    return [...results].sort((a, b) => (b.created ?? 0) - (a.created ?? 0)).slice(0, 20);
  }, [openRouterModels, modelSearch]);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      reset();
      setActiveTab('basic');
      setUrlWarning(null);
      setShowApiKey(false);
      setSelectedPreset('openrouter');
      setModelSearch('');
      // Pre-fill with OpenRouter preset
      const openrouterPreset = PROVIDER_PRESETS.find((p) => p.id === 'openrouter');
      if (openrouterPreset) {
        setTimeout(() => {
          setValue('name', openrouterPreset.defaultProfileName);
          setValue('baseUrl', openrouterPreset.baseUrl);
        }, 0);
      }
    }
  }, [open, reset, setValue]);

  // Handle preset selection
  const handlePresetSelect = (presetId: string) => {
    setSelectedPreset(presetId);
    const preset = PROVIDER_PRESETS.find((p) => p.id === presetId);
    if (preset) {
      setValue('name', preset.defaultProfileName);
      setValue('baseUrl', preset.baseUrl);
      if (preset.defaultModel) {
        setValue('model', preset.defaultModel);
        setValue('opusModel', preset.defaultModel);
        setValue('sonnetModel', preset.defaultModel);
        setValue('haikuModel', preset.defaultModel);
      }
    } else {
      // Custom
      setValue('name', '');
      setValue('baseUrl', '');
      setValue('model', '');
    }
  };

  // Handle model selection from picker - applies to all 4 model tiers
  const handleModelSelect = (model: CategorizedModel) => {
    setValue('model', model.id);
    setValue('opusModel', model.id);
    setValue('sonnetModel', model.id);
    setValue('haikuModel', model.id);
    setModelSearch(model.name);
    // Show feedback that model was applied to all tiers
    toast.success(`Applied "${model.name}" to all model tiers`, {
      duration: 2000,
    });
  };

  // Check for common URL mistakes - only for truly custom URLs
  // Presets (OpenRouter, GLM, GLMT, Kimi) have vetted URLs that may require full paths
  useEffect(() => {
    // Only warn for custom URLs, not preset-selected ones
    const isCustomUrl = selectedPreset === 'custom';
    if (baseUrlValue && isCustomUrl) {
      const lowerUrl = baseUrlValue.toLowerCase();
      for (const path of PROBLEMATIC_PATHS) {
        if (lowerUrl.endsWith(path)) {
          const suggestedUrl = baseUrlValue.replace(new RegExp(path + '$', 'i'), '');
          setUrlWarning(
            `URL ends with "${path}" - Claude appends this automatically. You likely want: ${suggestedUrl}`
          );
          return;
        }
      }
    }
    setUrlWarning(null);
  }, [baseUrlValue, selectedPreset]);

  const onSubmit = async (data: FormData) => {
    // Use user-provided baseUrl (allows customization of preset URLs)
    const finalData = {
      ...data,
    };
    try {
      await createMutation.mutateAsync(finalData);
      toast.success(`Profile "${finalData.name}" created`);
      onSuccess(finalData.name);
      onOpenChange(false);
    } catch (error) {
      toast.error((error as Error).message || 'Failed to create profile');
    }
  };

  const hasBasicErrors = !!errors.name || !!errors.baseUrl || !!errors.apiKey;
  const hasModelErrors =
    !!errors.model || !!errors.opusModel || !!errors.sonnetModel || !!errors.haikuModel;

  const isOpenRouter = selectedPreset === 'openrouter';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] p-0 gap-0 overflow-hidden max-h-[90vh]">
        <DialogHeader className="p-6 pb-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-primary" />
            Create API Profile
          </DialogTitle>
          <DialogDescription>
            Choose a provider or configure a custom API endpoint.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col overflow-hidden">
          {/* Provider Preset Cards - Compact horizontal layout */}
          <div className="px-6 py-3 border-b bg-muted/30 space-y-2">
            {/* Main Options: OpenRouter + Custom */}
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Provider</Label>
              <div className="flex gap-2">
                {getPresetsByCategory('recommended').map((preset) => (
                  <CompactPresetCard
                    key={preset.id}
                    preset={preset}
                    isSelected={selectedPreset === preset.id}
                    onClick={() => handlePresetSelect(preset.id)}
                  />
                ))}
                {/* Custom option */}
                <button
                  type="button"
                  onClick={() => handlePresetSelect('custom')}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-md border transition-all text-sm',
                    selectedPreset === 'custom' ||
                      getPresetsByCategory('alternative').some((p) => p.id === selectedPreset)
                      ? 'border-primary bg-primary/5 font-medium'
                      : 'border-muted hover:border-muted-foreground/30'
                  )}
                >
                  <Settings2 className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>Custom</span>
                </button>
              </div>
            </div>

            {/* Show alternative presets when Custom is selected or an alternative is selected */}
            {(selectedPreset === 'custom' ||
              getPresetsByCategory('alternative').some((p) => p.id === selectedPreset)) && (
              <div className="pt-2 border-t border-dashed">
                <Label className="text-xs text-muted-foreground mb-1.5 block">
                  Quick Templates
                </Label>
                <div className="flex gap-2 flex-wrap">
                  {getPresetsByCategory('alternative').map((preset) => (
                    <CompactPresetCard
                      key={preset.id}
                      preset={preset}
                      isSelected={selectedPreset === preset.id}
                      onClick={() => handlePresetSelect(preset.id)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex flex-col flex-1 overflow-hidden"
          >
            <div className="px-6 pt-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="basic" className="relative">
                  Basic Information
                  {hasBasicErrors && (
                    <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-destructive animate-pulse" />
                  )}
                </TabsTrigger>
                <TabsTrigger value="models" className="relative">
                  Model Configuration
                  {hasModelErrors && (
                    <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-destructive animate-pulse" />
                  )}
                </TabsTrigger>
              </TabsList>
            </div>

            <ScrollArea className="flex-1">
              <TabsContent value="basic" className="p-6 space-y-4 mt-0">
                {/* Profile Name */}
                <div className="space-y-1.5">
                  <Label htmlFor="name">
                    Profile Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="name"
                    {...register('name')}
                    placeholder="my-api"
                    className="font-mono"
                  />
                  {errors.name ? (
                    <p className="text-xs text-destructive">{errors.name.message}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Used in CLI:{' '}
                      <code className="bg-muted px-1 rounded text-[10px]">ccs my-api "prompt"</code>
                    </p>
                  )}
                </div>

                {/* Base URL - always editable, pre-filled from preset */}
                <div className="space-y-1.5">
                  <Label htmlFor="baseUrl">
                    API Base URL <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="baseUrl"
                    {...register('baseUrl')}
                    placeholder="https://api.example.com/v1"
                  />
                  {errors.baseUrl ? (
                    <p className="text-xs text-destructive">{errors.baseUrl.message}</p>
                  ) : urlWarning ? (
                    <div className="flex items-start gap-2 text-xs text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{urlWarning}</span>
                    </div>
                  ) : currentPreset ? (
                    <p className="text-xs text-muted-foreground">
                      Pre-filled from {currentPreset.name}. You can customize if needed.
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      The endpoint that accepts OpenAI-compatible and Anthropic requests
                    </p>
                  )}
                </div>

                {/* API Key */}
                <div className="space-y-1.5">
                  <Label htmlFor="apiKey">
                    API Key <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="apiKey"
                      type={showApiKey ? 'text' : 'password'}
                      {...register('apiKey')}
                      placeholder={currentPreset?.apiKeyPlaceholder ?? 'sk-...'}
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-9 w-9 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowApiKey(!showApiKey)}
                      tabIndex={-1}
                    >
                      {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  {errors.apiKey ? (
                    <p className="text-xs text-destructive">{errors.apiKey.message}</p>
                  ) : (
                    currentPreset?.apiKeyHint && (
                      <p className="text-xs text-muted-foreground">{currentPreset.apiKeyHint}</p>
                    )
                  )}
                </div>
              </TabsContent>

              <TabsContent value="models" className="p-6 mt-0 space-y-4">
                <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-950/20 text-blue-800 dark:text-blue-300 rounded-md text-sm border border-blue-100 dark:border-blue-900/30">
                  <Info className="w-5 h-5 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium mb-1">Model Mapping</p>
                    <p className="text-xs opacity-90">
                      Map Claude Code tiers (Opus/Sonnet/Haiku) to models supported by your
                      provider.
                    </p>
                  </div>
                </div>

                {/* OpenRouter Model Picker */}
                {isOpenRouter && (
                  <div className="space-y-2">
                    <Label>Search Models</Label>
                    <Input
                      value={modelSearch}
                      onChange={(e) => setModelSearch(e.target.value)}
                      placeholder="Type to search (e.g., opus, sonnet, gpt-4o)..."
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && filteredModels.length > 0) {
                          e.preventDefault();
                          handleModelSelect(filteredModels[0]);
                        }
                      }}
                    />
                    <div className="border rounded-md max-h-48 overflow-y-auto">
                      {filteredModels.length === 0 ? (
                        <p className="text-sm text-muted-foreground p-3 text-center">
                          {modelSearch
                            ? `No models found for "${modelSearch}"`
                            : 'Loading models...'}
                        </p>
                      ) : (
                        <div className="p-1">
                          {!modelSearch && (
                            <div className="flex items-center gap-1.5 px-2 py-1 text-xs text-muted-foreground">
                              <Sparkles className="w-3 h-3 text-accent" />
                              <span>Newest Models</span>
                            </div>
                          )}
                          {filteredModels.map((model) => (
                            <ModelSearchItem
                              key={model.id}
                              model={model}
                              onClick={() => handleModelSelect(model)}
                              showAge={!modelSearch}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Model Inputs */}
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="model">
                      Default Model
                      <Badge variant="outline" className="ml-2 text-[10px] font-mono">
                        ANTHROPIC_MODEL
                      </Badge>
                    </Label>
                    <Input
                      id="model"
                      {...register('model')}
                      placeholder={currentPreset?.defaultModel ?? 'claude-sonnet-4'}
                      className="font-mono text-sm"
                    />
                  </div>

                  <div className="grid gap-3 pt-2 border-t">
                    <div className="space-y-1.5">
                      <Label htmlFor="sonnetModel" className="text-sm">
                        Sonnet Mapping
                        <Badge variant="outline" className="ml-2 text-[10px] font-mono">
                          DEFAULT_SONNET
                        </Badge>
                      </Label>
                      <Input
                        id="sonnetModel"
                        {...register('sonnetModel')}
                        placeholder="e.g. gpt-4o, claude-sonnet-4"
                        className="font-mono text-sm h-9"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="opusModel" className="text-sm">
                        Opus Mapping
                        <Badge variant="outline" className="ml-2 text-[10px] font-mono">
                          DEFAULT_OPUS
                        </Badge>
                      </Label>
                      <Input
                        id="opusModel"
                        {...register('opusModel')}
                        placeholder="e.g. o1, claude-opus-4.5"
                        className="font-mono text-sm h-9"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="haikuModel" className="text-sm">
                        Haiku Mapping
                        <Badge variant="outline" className="ml-2 text-[10px] font-mono">
                          DEFAULT_HAIKU
                        </Badge>
                      </Label>
                      <Input
                        id="haikuModel"
                        {...register('haikuModel')}
                        placeholder="e.g. gpt-4o-mini, claude-3.5-haiku"
                        className="font-mono text-sm h-9"
                      />
                    </div>
                  </div>
                </div>
              </TabsContent>
            </ScrollArea>

            <DialogFooter className="p-6 pt-4 border-t bg-muted/10">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending}
                className={cn(createMutation.isPending && 'opacity-80')}
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Profile
                  </>
                )}
              </Button>
            </DialogFooter>
          </Tabs>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Compact preset card component - horizontal layout */
function CompactPresetCard({
  preset,
  isSelected,
  onClick,
}: {
  preset: ProviderPreset;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 px-3 py-1.5 rounded-md border transition-all text-sm',
        isSelected
          ? preset.featured
            ? 'border-accent bg-accent/10 dark:bg-accent/20 font-medium'
            : 'border-primary bg-primary/5 font-medium'
          : 'border-muted hover:border-muted-foreground/30'
      )}
    >
      {preset.icon ? (
        <img src={preset.icon} alt="" className="w-3.5 h-3.5" />
      ) : (
        <div className="w-3.5 h-3.5 rounded-full bg-muted flex items-center justify-center text-[8px] font-bold">
          {preset.name.charAt(0)}
        </div>
      )}
      <span>{preset.name}</span>
      {preset.badge && (
        <Badge variant="secondary" className="text-[9px] px-1 py-0 ml-0.5">
          {preset.badge}
        </Badge>
      )}
    </button>
  );
}

/** Model search result item */
function ModelSearchItem({
  model,
  onClick,
  showAge,
}: {
  model: CategorizedModel;
  onClick: () => void;
  showAge?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
    >
      <span className="flex-1 truncate">{model.name}</span>
      <span className="text-muted-foreground group-hover:text-accent-foreground/80 ml-2 flex items-center gap-2 text-xs">
        {showAge && model.created && (
          <Badge
            variant="outline"
            className="text-[10px] text-accent group-hover:text-accent-foreground/80 group-hover:border-accent-foreground/30"
          >
            {formatModelAge(model.created)}
          </Badge>
        )}
        {model.isFree ? (
          <Badge
            variant="secondary"
            className="text-xs group-hover:bg-accent-foreground/20 group-hover:text-accent-foreground"
          >
            Free
          </Badge>
        ) : (
          <span>{formatPricingPair(model.pricing)}</span>
        )}
        <span>{formatContextLength(model.context_length)}</span>
      </span>
    </button>
  );
}
