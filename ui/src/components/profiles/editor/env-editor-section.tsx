/**
 * Environment Variables Editor Section
 * Visual editor for profile environment variables
 */

import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MaskedInput } from '@/components/ui/masked-input';
import { Plus } from 'lucide-react';
import { isSensitiveKey } from './utils';
import type { Settings } from './types';

interface EnvEditorSectionProps {
  currentSettings: Settings | undefined;
  newEnvKey: string;
  newEnvValue: string;
  onNewEnvKeyChange: (value: string) => void;
  onNewEnvValueChange: (value: string) => void;
  onEnvValueChange: (key: string, value: string) => void;
  onAddEnvVar: () => void;
}

export function EnvEditorSection({
  currentSettings,
  newEnvKey,
  newEnvValue,
  onNewEnvKeyChange,
  onNewEnvValueChange,
  onEnvValueChange,
  onAddEnvVar,
}: EnvEditorSectionProps) {
  return (
    <>
      {/* Scrollable Environment Variables List */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {currentSettings?.env && Object.keys(currentSettings.env).length > 0 ? (
            <>
              {Object.entries(currentSettings.env).map(([key, value]) => (
                <div key={key} className="space-y-1.5">
                  <Label className="text-xs font-medium flex items-center gap-2 text-muted-foreground">
                    {key}
                    {isSensitiveKey(key) && (
                      <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">
                        sensitive
                      </Badge>
                    )}
                  </Label>
                  {isSensitiveKey(key) ? (
                    <MaskedInput
                      value={value}
                      onChange={(e) => onEnvValueChange(key, e.target.value)}
                      className="font-mono text-sm h-8"
                    />
                  ) : (
                    <Input
                      value={value}
                      onChange={(e) => onEnvValueChange(key, e.target.value)}
                      className="font-mono text-sm h-8"
                    />
                  )}
                </div>
              ))}
            </>
          ) : (
            <div className="py-8 text-center text-muted-foreground bg-muted/30 rounded-lg border border-dashed text-sm">
              <p>No environment variables configured.</p>
              <p className="text-xs mt-1 opacity-70">
                Add variables using the input below or edit the JSON directly.
              </p>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Fixed Add Input at Bottom */}
      <div className="p-4 border-t bg-background shrink-0">
        <Label className="text-xs font-medium text-muted-foreground">
          Add Environment Variable
        </Label>
        <div className="flex gap-2 mt-2">
          <Input
            placeholder="VARIABLE_NAME"
            value={newEnvKey}
            onChange={(e) => onNewEnvKeyChange(e.target.value.toUpperCase())}
            className="font-mono text-sm h-8 w-2/5"
            onKeyDown={(e) => e.key === 'Enter' && newEnvKey.trim() && onAddEnvVar()}
          />
          <Input
            placeholder="value"
            value={newEnvValue}
            onChange={(e) => onNewEnvValueChange(e.target.value)}
            className="font-mono text-sm h-8 flex-1"
            onKeyDown={(e) => e.key === 'Enter' && newEnvKey.trim() && onAddEnvVar()}
          />
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={onAddEnvVar}
            disabled={!newEnvKey.trim()}
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </>
  );
}
