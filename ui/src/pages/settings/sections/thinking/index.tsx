/**
 * Thinking Section
 * Settings section for thinking budget configuration
 */

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RefreshCw, CheckCircle2, AlertCircle, Brain, Info } from 'lucide-react';
import { useThinkingConfig } from '../../hooks';
import type { ThinkingMode } from '../../types';

const THINKING_LEVELS = [
  { value: 'minimal', label: 'Minimal (512 tokens)' },
  { value: 'low', label: 'Low (1K tokens)' },
  { value: 'medium', label: 'Medium (8K tokens)' },
  { value: 'high', label: 'High (24K tokens)' },
  { value: 'xhigh', label: 'Extra High (32K tokens)' },
  { value: 'auto', label: 'Auto (dynamic)' },
];

export default function ThinkingSection() {
  const {
    config,
    loading,
    saving,
    error,
    success,
    fetchConfig,
    setMode,
    setTierDefault,
    setShowWarnings,
  } = useThinkingConfig();

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex items-center gap-3 text-muted-foreground">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Toast-style alerts */}
      <div
        className={`absolute left-5 right-5 top-20 z-10 transition-all duration-200 ease-out ${
          error || success
            ? 'opacity-100 translate-y-0'
            : 'opacity-0 -translate-y-2 pointer-events-none'
        }`}
      >
        {error && (
          <Alert variant="destructive" className="py-2 shadow-lg">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </div>
              {/* W1: Retry button on error */}
              <Button
                variant="outline"
                size="sm"
                onClick={fetchConfig}
                className="h-7 px-2 text-xs border-destructive/50 hover:bg-destructive/10"
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                Retry
              </Button>
            </div>
          </Alert>
        )}
        {success && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-green-200 bg-green-50 text-green-700 shadow-lg dark:border-green-900/50 dark:bg-green-900/90 dark:text-green-300">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span className="text-sm font-medium">Saved</span>
          </div>
        )}
      </div>

      {/* Scrollable Content */}
      <ScrollArea className="flex-1">
        <div className="p-5 space-y-6">
          <div className="flex items-center gap-3">
            <Brain className="w-5 h-5 text-primary" />
            <p className="text-sm text-muted-foreground">
              Configure extended thinking/reasoning for supported models.
            </p>
          </div>

          {/* U4: Provider support indicator */}
          <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
            <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <div className="text-sm text-blue-700 dark:text-blue-300">
              <p className="font-medium">Supported Providers</p>
              <p className="mt-1 text-blue-600 dark:text-blue-400">
                Thinking budget works with: <strong>agy</strong> (Antigravity),{' '}
                <strong>gemini</strong> (with thinking models). Other providers may ignore this
                setting.
              </p>
            </div>
          </div>

          {/* Mode Selection */}
          <div className="space-y-3">
            <h3 className="text-base font-medium">Thinking Mode</h3>
            <div className="space-y-2">
              {(['auto', 'off', 'manual'] as ThinkingMode[]).map((mode) => (
                <div
                  key={mode}
                  className={`flex items-center justify-between p-4 rounded-lg cursor-pointer transition-colors ${
                    config.mode === mode
                      ? 'bg-primary/10 border border-primary/30'
                      : 'bg-muted/50 hover:bg-muted/80'
                  }`}
                  onClick={() => setMode(mode)}
                >
                  <div>
                    <p className="font-medium capitalize">{mode}</p>
                    <p className="text-sm text-muted-foreground">
                      {mode === 'auto' && 'Automatically set thinking based on model tier'}
                      {mode === 'off' && 'Disable extended thinking'}
                      {mode === 'manual' && 'Use --thinking flag to control manually'}
                    </p>
                  </div>
                  <div
                    className={`w-4 h-4 rounded-full border-2 ${
                      config.mode === mode
                        ? 'bg-primary border-primary'
                        : 'border-muted-foreground/50'
                    }`}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Tier Defaults (only shown when mode is auto) */}
          {config.mode === 'auto' && (
            <div className="space-y-3">
              <h3 className="text-base font-medium">Tier Defaults</h3>
              <p className="text-sm text-muted-foreground">
                Default thinking level for each model tier when in auto mode.
              </p>

              <div className="space-y-3">
                {(['opus', 'sonnet', 'haiku'] as const).map((tier) => (
                  <div key={tier} className="flex items-center gap-4 p-3 rounded-lg bg-muted/30">
                    <Label className="w-20 capitalize font-medium">{tier}</Label>
                    <Select
                      value={config.tier_defaults[tier]}
                      onValueChange={(value) => setTierDefault(tier, value)}
                      disabled={saving}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {THINKING_LEVELS.map((level) => (
                          <SelectItem key={level.value} value={level.value}>
                            {level.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Show Warnings Toggle */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
            <div>
              <p className="font-medium">Show Warnings</p>
              <p className="text-sm text-muted-foreground">
                Display warnings when thinking values are clamped or adjusted
              </p>
            </div>
            <Switch
              checked={config.show_warnings ?? true}
              onCheckedChange={setShowWarnings}
              disabled={saving}
            />
          </div>

          {/* Info Box */}
          <div className="p-4 rounded-lg border bg-muted/30">
            <h4 className="text-sm font-medium mb-2">CLI Override</h4>
            <p className="text-sm text-muted-foreground mb-2">
              Use <code className="px-1.5 py-0.5 rounded bg-muted">--thinking</code> flag to
              override settings per session:
            </p>
            <div className="space-y-1 text-sm font-mono text-muted-foreground">
              <p>ccs gemini --thinking high</p>
              <p>ccs agy --thinking 16384</p>
              <p>ccs gemini --thinking off</p>
            </div>
          </div>
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-4 border-t bg-background">
        <Button
          variant="outline"
          size="sm"
          onClick={fetchConfig}
          disabled={loading || saving}
          className="w-full"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>
    </>
  );
}
