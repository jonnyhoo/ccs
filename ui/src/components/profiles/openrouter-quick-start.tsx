/**
 * OpenRouter Quick Start Card
 * Prominent CTA for new users to create OpenRouter profile
 */

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useOpenRouterReady } from '@/hooks/use-openrouter-models';
import { Sparkles, ExternalLink, ArrowRight, Zap } from 'lucide-react';

interface OpenRouterQuickStartProps {
  onOpenRouterClick: () => void;
  onCustomClick: () => void;
}

export function OpenRouterQuickStart({
  onOpenRouterClick,
  onCustomClick,
}: OpenRouterQuickStartProps) {
  const { modelCount, isLoading } = useOpenRouterReady();

  return (
    <div className="flex-1 flex items-center justify-center bg-muted/20 p-8">
      <div className="max-w-lg w-full space-y-6">
        {/* Main OpenRouter Card */}
        <Card className="border-accent/30 dark:border-accent/40 bg-gradient-to-br from-accent/5 to-background dark:from-accent/10">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-accent/10 dark:bg-accent/20">
                <img src="/icons/openrouter.svg" alt="OpenRouter" className="w-6 h-6" />
              </div>
              <Badge
                variant="secondary"
                className="bg-accent/10 text-accent dark:bg-accent/20 dark:text-accent-foreground"
              >
                Recommended
              </Badge>
            </div>
            <CardTitle className="text-xl">Start with OpenRouter</CardTitle>
            <CardDescription className="text-base">
              Access {isLoading ? '300+' : `${modelCount}+`} models from OpenAI, Anthropic, Google,
              Meta and more - all through one API.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Key Features */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Zap className="w-4 h-4 text-accent" />
                <span>One API, all providers</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Sparkles className="w-4 h-4 text-accent" />
                <span>Model tier mapping</span>
              </div>
            </div>

            <Button
              onClick={onOpenRouterClick}
              className="w-full bg-accent hover:bg-accent/90 text-white"
              size="lg"
            >
              Create OpenRouter Profile
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              Get your API key at{' '}
              <a
                href="https://openrouter.ai/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:underline inline-flex items-center gap-1"
              >
                openrouter.ai/keys
                <ExternalLink className="w-3 h-3" />
              </a>
            </p>
          </CardContent>
        </Card>

        {/* Divider */}
        <div className="flex items-center gap-4">
          <Separator className="flex-1" />
          <span className="text-xs text-muted-foreground">or</span>
          <Separator className="flex-1" />
        </div>

        {/* Custom Option */}
        <Button variant="outline" onClick={onCustomClick} className="w-full">
          Create Custom API Profile
        </Button>
      </div>
    </div>
  );
}
