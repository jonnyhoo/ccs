/**
 * Model Config Section
 * Presets and model mapping configuration UI
 */

import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Sparkles, Zap, Star, X, Plus } from 'lucide-react';
import { FlexibleModelSelector } from '../provider-model-selector';
import type { ModelConfigSectionProps } from './types';

export function ModelConfigSection({
  catalog,
  savedPresets,
  currentModel,
  opusModel,
  sonnetModel,
  haikuModel,
  providerModels,
  onApplyPreset,
  onUpdateEnvValue,
  onOpenCustomPreset,
  onDeletePreset,
  isDeletePending,
}: ModelConfigSectionProps) {
  const showPresets = (catalog && catalog.models.length > 0) || savedPresets.length > 0;

  return (
    <>
      {/* Quick Presets */}
      {showPresets && (
        <div>
          <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            Presets
          </h3>
          <p className="text-xs text-muted-foreground mb-3">Apply pre-configured model mappings</p>
          <div className="flex flex-wrap gap-2">
            {/* Recommended presets from catalog */}
            {catalog?.models.slice(0, 4).map((model) => (
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
                  onApplyPreset({
                    ANTHROPIC_MODEL: mapping.default,
                    ANTHROPIC_DEFAULT_OPUS_MODEL: mapping.opus,
                    ANTHROPIC_DEFAULT_SONNET_MODEL: mapping.sonnet,
                    ANTHROPIC_DEFAULT_HAIKU_MODEL: mapping.haiku,
                  });
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
                    onApplyPreset({
                      ANTHROPIC_MODEL: preset.default,
                      ANTHROPIC_DEFAULT_OPUS_MODEL: preset.opus,
                      ANTHROPIC_DEFAULT_SONNET_MODEL: preset.sonnet,
                      ANTHROPIC_DEFAULT_HAIKU_MODEL: preset.haiku,
                    });
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
                    onDeletePreset(preset.name);
                  }}
                  disabled={isDeletePending}
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            ))}

            <Button
              variant="outline"
              size="sm"
              className="text-xs h-7 gap-1 border-primary/50 text-primary hover:bg-primary/10 hover:border-primary"
              onClick={onOpenCustomPreset}
            >
              <Plus className="w-3 h-3" />
              Custom
            </Button>
          </div>
        </div>
      )}

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
            onChange={(model) => onUpdateEnvValue('ANTHROPIC_MODEL', model)}
            catalog={catalog}
            allModels={providerModels}
          />
          <FlexibleModelSelector
            label="Opus (Most capable)"
            description="For complex reasoning tasks"
            value={opusModel}
            onChange={(model) => onUpdateEnvValue('ANTHROPIC_DEFAULT_OPUS_MODEL', model)}
            catalog={catalog}
            allModels={providerModels}
          />
          <FlexibleModelSelector
            label="Sonnet (Balanced)"
            description="Balance of speed and capability"
            value={sonnetModel}
            onChange={(model) => onUpdateEnvValue('ANTHROPIC_DEFAULT_SONNET_MODEL', model)}
            catalog={catalog}
            allModels={providerModels}
          />
          <FlexibleModelSelector
            label="Haiku (Fast)"
            description="Quick responses for simple tasks"
            value={haikuModel}
            onChange={(model) => onUpdateEnvValue('ANTHROPIC_DEFAULT_HAIKU_MODEL', model)}
            catalog={catalog}
            allModels={providerModels}
          />
        </div>
      </div>
    </>
  );
}
