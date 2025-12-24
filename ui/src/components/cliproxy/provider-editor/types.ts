/**
 * Type definitions for ProviderEditor components
 */

import type { AuthStatus, OAuthAccount } from '@/lib/api-client';
import type { ProviderCatalog } from '../provider-model-selector';

export interface SettingsResponse {
  profile: string;
  settings: {
    env?: Record<string, string>;
  };
  mtime: number;
  path: string;
}

export interface ProviderEditorProps {
  provider: string;
  displayName: string;
  authStatus: AuthStatus;
  catalog?: ProviderCatalog;
  /** Provider type for logo display (defaults to provider) */
  logoProvider?: string;
  /** Base provider for model filtering (defaults to provider). For variants, this is the parent provider. */
  baseProvider?: string;
  /** True if using remote CLIProxy mode (hides local paths) */
  isRemoteMode?: boolean;
  /** Port number for variant (for display in header) */
  port?: number;
  onAddAccount: () => void;
  onSetDefault: (accountId: string) => void;
  onRemoveAccount: (accountId: string) => void;
  isRemovingAccount?: boolean;
}

export interface AccountItemProps {
  account: OAuthAccount;
  onSetDefault: () => void;
  onRemove: () => void;
  isRemoving?: boolean;
  privacyMode?: boolean;
}

export interface ModelMappingValues {
  default: string;
  opus: string;
  sonnet: string;
  haiku: string;
}

export interface CustomPresetDialogProps {
  open: boolean;
  onClose: () => void;
  currentValues: ModelMappingValues;
  onApply: (values: ModelMappingValues, presetName?: string) => void;
  onSave?: (values: ModelMappingValues, presetName?: string) => void;
  isSaving?: boolean;
  catalog?: ProviderCatalog;
  allModels: { id: string; owned_by: string }[];
}

export interface RawEditorSectionProps {
  rawJsonContent: string;
  isRawJsonValid: boolean;
  rawJsonEdits: string | null;
  onRawJsonChange: (value: string) => void;
  profileEnv?: Record<string, string>;
}

export interface ModelConfigSectionProps {
  catalog?: ProviderCatalog;
  savedPresets: Array<{
    name: string;
    default: string;
    opus: string;
    sonnet: string;
    haiku: string;
  }>;
  currentModel?: string;
  opusModel?: string;
  sonnetModel?: string;
  haikuModel?: string;
  providerModels: Array<{ id: string; owned_by: string }>;
  onApplyPreset: (updates: Record<string, string>) => void;
  onUpdateEnvValue: (key: string, value: string) => void;
  onOpenCustomPreset: () => void;
  onDeletePreset: (name: string) => void;
  isDeletePending?: boolean;
}

export interface UseProviderEditorReturn {
  data: SettingsResponse | undefined;
  isLoading: boolean;
  refetch: () => void;
  rawJsonContent: string;
  rawJsonEdits: string | null;
  isRawJsonValid: boolean;
  hasChanges: boolean;
  currentSettings: { env?: Record<string, string> };
  currentModel?: string;
  opusModel?: string;
  sonnetModel?: string;
  haikuModel?: string;
  handleRawJsonChange: (value: string) => void;
  updateEnvValue: (key: string, value: string) => void;
  updateEnvValues: (updates: Record<string, string>) => void;
  saveMutation: {
    mutate: () => void;
    isPending: boolean;
  };
  conflictDialog: boolean;
  setConflictDialog: (open: boolean) => void;
  handleConflictResolve: (overwrite: boolean) => Promise<void>;
}
