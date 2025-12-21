/**
 * Friendly UI Section
 * Left column with environment variables and info tabs
 * Enhanced with OpenRouter-specific streamlined UI when applicable
 */

import { useMemo, useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { EnvEditorSection } from './env-editor-section';
import { InfoSection } from './info-section';
import { OpenRouterModelPicker } from '@/components/profiles/openrouter-model-picker';
import { ModelTierMapping, type TierMapping } from '@/components/profiles/model-tier-mapping';
import { Label } from '@/components/ui/label';
import { MaskedInput } from '@/components/ui/masked-input';
import { ChevronRight, Settings2 } from 'lucide-react';
import { isOpenRouterProfile, extractTierMapping, applyTierMapping } from './utils';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { Settings, SettingsResponse } from './types';

interface FriendlyUISectionProps {
  profileName: string;
  data: SettingsResponse | undefined;
  currentSettings: Settings | undefined;
  newEnvKey: string;
  onNewEnvKeyChange: (key: string) => void;
  onEnvValueChange: (key: string, value: string) => void;
  onAddEnvVar: () => void;
  onEnvBulkChange?: (env: Record<string, string>) => void;
}

export function FriendlyUISection({
  profileName,
  data,
  currentSettings,
  newEnvKey,
  onNewEnvKeyChange,
  onEnvValueChange,
  onAddEnvVar,
  onEnvBulkChange,
}: FriendlyUISectionProps) {
  const isOpenRouter = isOpenRouterProfile(currentSettings);
  const settingsEnv = currentSettings?.env;

  // Derive tier mapping from env vars (no local state to sync)
  const tierMapping = useMemo<TierMapping>(
    () => extractTierMapping(settingsEnv ?? {}),
    [settingsEnv]
  );

  // Memoize currentEnv for consistent reference
  const currentEnv = settingsEnv ?? {};

  // Handle model selection from OpenRouter picker - applies to ALL tiers
  const handleModelChange = (modelId: string) => {
    if (onEnvBulkChange) {
      // Update all 4 model tiers at once
      const newEnv = {
        ...currentEnv,
        ANTHROPIC_MODEL: modelId,
        ANTHROPIC_DEFAULT_OPUS_MODEL: modelId,
        ANTHROPIC_DEFAULT_SONNET_MODEL: modelId,
        ANTHROPIC_DEFAULT_HAIKU_MODEL: modelId,
      };
      onEnvBulkChange(newEnv);
    } else {
      // Fallback: update one by one
      onEnvValueChange('ANTHROPIC_MODEL', modelId);
      onEnvValueChange('ANTHROPIC_DEFAULT_OPUS_MODEL', modelId);
      onEnvValueChange('ANTHROPIC_DEFAULT_SONNET_MODEL', modelId);
      onEnvValueChange('ANTHROPIC_DEFAULT_HAIKU_MODEL', modelId);
    }
    // Show feedback toast
    toast.success('Applied model to all tiers', { duration: 2000 });
  };

  // Handle tier mapping change
  const handleTierMappingChange = (mapping: TierMapping) => {
    // Apply tier mapping to env vars
    if (onEnvBulkChange) {
      const newEnv = applyTierMapping(currentEnv, mapping);
      onEnvBulkChange(newEnv);
    } else {
      // Fallback: update one by one
      if (mapping.opus !== undefined) {
        onEnvValueChange('ANTHROPIC_DEFAULT_OPUS_MODEL', mapping.opus || '');
      }
      if (mapping.sonnet !== undefined) {
        onEnvValueChange('ANTHROPIC_DEFAULT_SONNET_MODEL', mapping.sonnet || '');
      }
      if (mapping.haiku !== undefined) {
        onEnvValueChange('ANTHROPIC_DEFAULT_HAIKU_MODEL', mapping.haiku || '');
      }
    }
  };

  // State for collapsible sections
  const [showAllEnvVars, setShowAllEnvVars] = useState(false);

  // For OpenRouter: filter out model-related env vars from the main display
  // These are managed by the model picker and tier mapping
  const openRouterManagedKeys = new Set([
    'ANTHROPIC_MODEL',
    'ANTHROPIC_DEFAULT_OPUS_MODEL',
    'ANTHROPIC_DEFAULT_SONNET_MODEL',
    'ANTHROPIC_DEFAULT_HAIKU_MODEL',
  ]);

  // Count of hidden env vars for OpenRouter profiles
  const hiddenEnvVarCount = isOpenRouter
    ? Object.keys(currentEnv).filter((k) => openRouterManagedKeys.has(k)).length
    : 0;

  return (
    <div className="h-full w-full min-w-0 flex flex-col">
      <Tabs defaultValue="env" className="h-full w-full min-w-0 flex flex-col">
        <div className="px-4 pt-4 shrink-0">
          <TabsList className="w-full">
            <TabsTrigger value="env" className="flex-1">
              {isOpenRouter ? 'Configuration' : 'Environment Variables'}
            </TabsTrigger>
            <TabsTrigger value="info" className="flex-1">
              Info & Usage
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col min-w-0">
          <TabsContent
            value="env"
            className="flex-1 mt-0 border-0 p-0 data-[state=inactive]:hidden flex flex-col overflow-hidden min-w-0"
          >
            {/* OpenRouter Streamlined View */}
            {isOpenRouter ? (
              <div className="flex-1 overflow-hidden">
                <div className="h-full overflow-y-auto overflow-x-hidden p-4 space-y-6">
                  {/* Model Selection - Primary Focus */}
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">Model Selection</Label>
                    <OpenRouterModelPicker
                      value={currentEnv.ANTHROPIC_MODEL}
                      onChange={handleModelChange}
                      placeholder="Search OpenRouter models..."
                    />
                  </div>

                  {/* Model Tier Mapping - Collapsible */}
                  <ModelTierMapping
                    selectedModel={currentEnv.ANTHROPIC_MODEL}
                    value={tierMapping}
                    onChange={handleTierMappingChange}
                  />

                  {/* API Key - Simplified */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">API Key</Label>
                    <MaskedInput
                      value={currentEnv.ANTHROPIC_AUTH_TOKEN || ''}
                      onChange={(e) => onEnvValueChange('ANTHROPIC_AUTH_TOKEN', e.target.value)}
                      placeholder="sk-or-v1-..."
                      className="font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      Get your API key from{' '}
                      <a
                        href="https://openrouter.ai/keys"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        openrouter.ai/keys
                      </a>
                    </p>
                  </div>

                  {/* Advanced: All Environment Variables */}
                  <Collapsible open={showAllEnvVars} onOpenChange={setShowAllEnvVars}>
                    <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors group">
                      <ChevronRight
                        className={cn(
                          'h-4 w-4 transition-transform',
                          showAllEnvVars && 'rotate-90'
                        )}
                      />
                      <Settings2 className="h-4 w-4" />
                      <span>All Environment Variables</span>
                      <span className="text-xs font-normal opacity-70">
                        ({Object.keys(currentEnv).length} vars
                        {hiddenEnvVarCount > 0 && `, ${hiddenEnvVarCount} managed by picker`})
                      </span>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-4">
                      <div className="space-y-3 border rounded-lg p-3 bg-muted/30">
                        {Object.entries(currentEnv).map(([key, value]) => (
                          <div key={key} className="space-y-1">
                            <Label className="text-xs text-muted-foreground flex items-center gap-2">
                              {key}
                              {openRouterManagedKeys.has(key) && (
                                <span className="text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary rounded">
                                  managed
                                </span>
                              )}
                            </Label>
                            {key === 'ANTHROPIC_AUTH_TOKEN' ? (
                              <MaskedInput
                                value={value}
                                onChange={(e) => onEnvValueChange(key, e.target.value)}
                                className="font-mono text-xs h-8"
                              />
                            ) : (
                              <input
                                type="text"
                                value={value}
                                onChange={(e) => onEnvValueChange(key, e.target.value)}
                                className="w-full font-mono text-xs h-8 px-2 rounded border bg-background"
                                readOnly={openRouterManagedKeys.has(key)}
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              </div>
            ) : (
              /* Standard Env Editor for non-OpenRouter profiles */
              <EnvEditorSection
                currentSettings={currentSettings}
                newEnvKey={newEnvKey}
                onNewEnvKeyChange={onNewEnvKeyChange}
                onEnvValueChange={onEnvValueChange}
                onAddEnvVar={onAddEnvVar}
              />
            )}
          </TabsContent>

          <TabsContent
            value="info"
            className="h-full mt-0 border-0 p-0 data-[state=inactive]:hidden"
          >
            <InfoSection profileName={profileName} data={data} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
