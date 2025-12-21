/**
 * Profile Editor Component
 * Inline editor for API profile settings with 2-column layout (Friendly UI + Raw JSON)
 */

/* eslint-disable react-refresh/only-export-components */
import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { Loader2, Code2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

import { HeaderSection } from './header-section';
import { FriendlyUISection } from './friendly-ui-section';
import { RawEditorSection } from './raw-editor-section';
import type { ProfileEditorProps, Settings, SettingsResponse } from './types';

export function ProfileEditor({ profileName, onDelete }: ProfileEditorProps) {
  const [localEdits, setLocalEdits] = useState<Record<string, string>>({});
  const [conflictDialog, setConflictDialog] = useState(false);
  const [rawJsonEdits, setRawJsonEdits] = useState<string | null>(null);
  const [newEnvKey, setNewEnvKey] = useState('');
  const [newEnvValue, setNewEnvValue] = useState('');
  const queryClient = useQueryClient();

  // Fetch settings for selected profile
  const { data, isLoading, isError, refetch } = useQuery<SettingsResponse>({
    queryKey: ['settings', profileName],
    queryFn: async () => {
      const res = await fetch(`/api/settings/${profileName}/raw`);
      if (!res.ok) throw new Error(`Failed to load settings: ${res.status}`);
      return res.json();
    },
  });

  const settings = data?.settings;

  // Derive current settings by merging original data with local edits
  const currentSettings = useMemo((): Settings | undefined => {
    if (rawJsonEdits !== null) {
      try {
        return JSON.parse(rawJsonEdits);
      } catch {
        // Fall back to settings merge
      }
    }
    if (!settings) return undefined;
    return { ...settings, env: { ...settings.env, ...localEdits } };
  }, [settings, localEdits, rawJsonEdits]);

  // Compute raw JSON content
  const computedRawJsonContent = useMemo(() => {
    if (rawJsonEdits !== null) return rawJsonEdits;
    if (settings) return JSON.stringify(settings, null, 2);
    return '';
  }, [rawJsonEdits, settings]);

  const handleRawJsonChange = useCallback((value: string) => {
    setRawJsonEdits(value);
  }, []);

  // Sync Visual Editor changes to Raw JSON
  const updateEnvValue = (key: string, value: string) => {
    const newEnv = { ...(currentSettings?.env || {}), [key]: value };
    setLocalEdits((prev) => ({ ...prev, [key]: value }));
    setRawJsonEdits(JSON.stringify({ ...currentSettings, env: newEnv }, null, 2));
  };

  const addNewEnvVar = () => {
    if (!newEnvKey.trim()) return;
    const key = newEnvKey.trim();
    const value = newEnvValue;
    const newEnv = { ...(currentSettings?.env || {}), [key]: value };
    setLocalEdits((prev) => ({ ...prev, [key]: value }));
    setRawJsonEdits(JSON.stringify({ ...currentSettings, env: newEnv }, null, 2));
    setNewEnvKey('');
    setNewEnvValue('');
  };

  // Computed validity and changes check
  const computedIsRawJsonValid = useMemo(() => {
    try {
      JSON.parse(computedRawJsonContent);
      return true;
    } catch {
      return false;
    }
  }, [computedRawJsonContent]);

  const computedHasChanges = useMemo(() => {
    if (rawJsonEdits !== null) return rawJsonEdits !== JSON.stringify(settings, null, 2);
    return Object.keys(localEdits).length > 0;
  }, [rawJsonEdits, localEdits, settings]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      let settingsToSave: Settings;
      try {
        settingsToSave = JSON.parse(computedRawJsonContent);
      } catch {
        settingsToSave = { ...data?.settings, env: { ...data?.settings?.env, ...localEdits } };
      }

      const res = await fetch(`/api/settings/${profileName}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: settingsToSave, expectedMtime: data?.mtime }),
      });

      if (res.status === 409) throw new Error('CONFLICT');
      if (!res.ok) throw new Error('Failed to save');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', profileName] });
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      setLocalEdits({});
      setRawJsonEdits(null);
      toast.success('Settings saved');
    },
    onError: (error: Error) => {
      if (error.message === 'CONFLICT') setConflictDialog(true);
      else toast.error(error.message);
    },
  });

  const handleConflictResolve = async (overwrite: boolean) => {
    setConflictDialog(false);
    if (overwrite) {
      await refetch();
      saveMutation.mutate();
    } else {
      setLocalEdits({});
      setRawJsonEdits(null);
    }
  };

  return (
    <div key={profileName} className="flex-1 flex flex-col overflow-hidden">
      <HeaderSection
        profileName={profileName}
        data={data}
        settings={currentSettings}
        isLoading={isLoading}
        isSaving={saveMutation.isPending}
        hasChanges={computedHasChanges}
        isRawJsonValid={computedIsRawJsonValid}
        onRefresh={() => refetch()}
        onDelete={onDelete}
        onSave={() => saveMutation.mutate()}
      />

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          <span className="ml-3 text-muted-foreground">Loading settings...</span>
        </div>
      ) : isError ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <p className="text-sm text-muted-foreground">Failed to load settings.</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4 mr-1" />
              Retry
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex-1 grid grid-cols-[40%_60%] divide-x overflow-hidden">
          <div className="flex flex-col overflow-hidden bg-muted/5 min-w-0">
            <FriendlyUISection
              profileName={profileName}
              data={data}
              currentSettings={currentSettings}
              newEnvKey={newEnvKey}
              newEnvValue={newEnvValue}
              onNewEnvKeyChange={setNewEnvKey}
              onNewEnvValueChange={setNewEnvValue}
              onEnvValueChange={updateEnvValue}
              onAddEnvVar={addNewEnvVar}
            />
          </div>
          <div className="flex flex-col overflow-hidden">
            <div className="px-6 py-2 bg-muted/30 border-b flex items-center gap-2 shrink-0 h-[45px]">
              <Code2 className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">
                Raw Configuration (JSON)
              </span>
            </div>
            <RawEditorSection
              rawJsonContent={computedRawJsonContent}
              isRawJsonValid={computedIsRawJsonValid}
              rawJsonEdits={rawJsonEdits}
              settings={settings}
              onChange={handleRawJsonChange}
            />
          </div>
        </div>
      )}

      <ConfirmDialog
        open={conflictDialog}
        title="File Modified Externally"
        description="Overwrite with your changes or discard?"
        confirmText="Overwrite"
        variant="destructive"
        onConfirm={() => handleConflictResolve(true)}
        onCancel={() => handleConflictResolve(false)}
      />
    </div>
  );
}

// Re-exports
export { EnvEditorSection } from './env-editor-section';
export { InfoSection } from './info-section';
export { RawEditorSection } from './raw-editor-section';
export { HeaderSection } from './header-section';
export { FriendlyUISection } from './friendly-ui-section';
export { useProfileEditor } from './use-profile-editor';
export { isSensitiveKey, isOpenRouterProfile, extractTierMapping, applyTierMapping } from './utils';
export type { Settings, SettingsResponse, ProfileEditorProps } from './types';
