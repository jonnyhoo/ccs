/**
 * Model Preferences Grid Component
 * Displays all available models categorized by provider source
 */

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Cpu, AlertCircle } from 'lucide-react';
import { useCliproxyModels, useCliproxyUpdateCheck } from '@/hooks/use-cliproxy';
import { cn } from '@/lib/utils';

/** Category display configuration */
const CATEGORY_CONFIG: Record<string, { name: string; color: string; bgColor: string }> = {
  google: { name: 'Google (Gemini)', color: 'text-blue-600', bgColor: 'bg-blue-50' },
  openai: { name: 'OpenAI (GPT)', color: 'text-green-600', bgColor: 'bg-green-50' },
  anthropic: { name: 'Anthropic (Claude)', color: 'text-orange-600', bgColor: 'bg-orange-50' },
  antigravity: { name: 'Antigravity', color: 'text-purple-600', bgColor: 'bg-purple-50' },
  other: { name: 'Other', color: 'text-gray-600', bgColor: 'bg-gray-50' },
};

function getCategoryDisplay(category: string) {
  return (
    CATEGORY_CONFIG[category.toLowerCase()] || {
      name: category.charAt(0).toUpperCase() + category.slice(1),
      color: 'text-gray-600',
      bgColor: 'bg-gray-50',
    }
  );
}

function ModelPreferencesSkeleton() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Available Models</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 rounded-lg" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyModelsState() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Available Models</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
            <AlertCircle className="w-6 h-6 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground mb-1">No models available</p>
          <p className="text-xs text-muted-foreground">
            Start a CLIProxy session to fetch available models
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export function ModelPreferencesGrid() {
  const { data: modelsData, isLoading, isError } = useCliproxyModels();
  const { data: updateCheck } = useCliproxyUpdateCheck();
  const backendLabel = updateCheck?.backendLabel ?? 'CLIProxy';

  // Sort categories by model count
  const sortedCategories = useMemo(() => {
    if (!modelsData?.byCategory) return [];
    return Object.entries(modelsData.byCategory)
      .sort(([, a], [, b]) => b.length - a.length)
      .map(([category, models]) => ({
        category,
        display: getCategoryDisplay(category),
        models,
      }));
  }, [modelsData]);

  if (isLoading) {
    return <ModelPreferencesSkeleton />;
  }

  if (isError || !modelsData || modelsData.totalCount === 0) {
    return <EmptyModelsState />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Cpu className="w-4 h-4" />
          Available Models
          <Badge variant="secondary" className="text-xs">
            {modelsData.totalCount} total
          </Badge>
        </CardTitle>
        <CardDescription>
          Models available through {backendLabel}, grouped by provider
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedCategories.map(({ category, display, models }) => (
            <div
              key={category}
              className={cn('p-4 rounded-lg border', display.bgColor, 'border-transparent')}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className={cn('font-medium text-sm', display.color)}>{display.name}</h3>
                <Badge variant="outline" className="text-xs">
                  {models.length}
                </Badge>
              </div>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {models.slice(0, 5).map((model) => (
                  <div
                    key={model.id}
                    className="text-xs text-muted-foreground truncate"
                    title={model.id}
                  >
                    {model.id}
                  </div>
                ))}
                {models.length > 5 && (
                  <div className="text-xs text-muted-foreground italic">
                    +{models.length - 5} more
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
