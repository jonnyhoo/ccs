/**
 * API Client
 * Phase 03: REST API Routes & CRUD
 */

const BASE_URL = '/api';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || res.statusText);
  }

  return res.json();
}

// Types
export interface Profile {
  name: string;
  settingsPath: string;
  configured: boolean;
}

export interface CreateProfile {
  name: string;
  baseUrl: string;
  apiKey: string;
  model?: string;
  opusModel?: string;
  sonnetModel?: string;
  haikuModel?: string;
}

export interface UpdateProfile {
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  opusModel?: string;
  sonnetModel?: string;
  haikuModel?: string;
}

export interface Variant {
  name: string;
  provider: 'gemini' | 'codex' | 'agy' | 'qwen' | 'iflow';
  settings: string;
  account?: string;
}

export interface CreateVariant {
  name: string;
  provider: 'gemini' | 'codex' | 'agy' | 'qwen' | 'iflow';
  model?: string;
  account?: string;
}

export interface UpdateVariant {
  provider?: 'gemini' | 'codex' | 'agy' | 'qwen' | 'iflow';
  model?: string;
  account?: string;
}

/** OAuth account info for multi-account support */
export interface OAuthAccount {
  id: string;
  email?: string;
  provider: 'gemini' | 'codex' | 'agy' | 'qwen' | 'iflow';
  isDefault: boolean;
  tokenFile: string;
  createdAt: string;
  lastUsedAt?: string;
}

export interface AuthStatus {
  provider: string;
  displayName: string;
  authenticated: boolean;
  lastAuth: string | null;
  tokenFiles: number;
  accounts: OAuthAccount[];
  defaultAccount?: string;
}

/** Auth file info for Config tab */
export interface AuthFile {
  name: string;
  provider?: string;
}

/** CLIProxy model from /v1/models endpoint */
export interface CliproxyModel {
  id: string;
  object: string;
  created: number;
  owned_by: string;
}

/** Categorized models response from CLIProxyAPI */
export interface CliproxyModelsResponse {
  models: CliproxyModel[];
  byCategory: Record<string, CliproxyModel[]>;
  totalCount: number;
}

/** Provider accounts summary */
export type ProviderAccountsMap = Record<string, OAuthAccount[]>;

export interface Account {
  name: string;
  type?: string;
  created: string;
  last_used?: string | null;
}

// Unified config types
export interface ConfigFormat {
  format: 'yaml' | 'json' | 'none';
  migrationNeeded: boolean;
  backups: string[];
}

export interface MigrationResult {
  success: boolean;
  backupPath?: string;
  error?: string;
  migratedFiles: string[];
  warnings: string[];
}

export interface SecretsExists {
  exists: boolean;
  keys: string[];
}

/** Model preset for quick model switching */
export interface ModelPreset {
  name: string;
  default: string;
  opus: string;
  sonnet: string;
  haiku: string;
}

export interface CreatePreset {
  name: string;
  default: string;
  opus?: string;
  sonnet?: string;
  haiku?: string;
}

/** CLIProxy process status from session tracker */
export interface ProxyProcessStatus {
  running: boolean;
  port?: number;
  pid?: number;
  sessionCount?: number;
  startedAt?: string;
}

/** Error log file metadata from CLIProxyAPI */
export interface CliproxyErrorLog {
  /** Filename (e.g., "error-v1-chat-completions-2025-01-15T10-30-00.log") */
  name: string;
  /** File size in bytes */
  size: number;
  /** Last modified timestamp (Unix seconds) */
  modified: number;
}

/** Result from starting proxy service */
export interface ProxyStartResult {
  started: boolean;
  alreadyRunning: boolean;
  port: number;
  configRegenerated?: boolean;
  error?: string;
}

// API
export const api = {
  profiles: {
    list: () => request<{ profiles: Profile[] }>('/profiles'),
    create: (data: CreateProfile) =>
      request('/profiles', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (name: string, data: UpdateProfile) =>
      request(`/profiles/${name}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    delete: (name: string) => request(`/profiles/${name}`, { method: 'DELETE' }),
  },
  cliproxy: {
    list: () => request<{ variants: Variant[] }>('/cliproxy'),
    getAuthStatus: () => request<{ authStatus: AuthStatus[] }>('/cliproxy/auth'),
    create: (data: CreateVariant) =>
      request('/cliproxy', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (name: string, data: UpdateVariant) =>
      request(`/cliproxy/${name}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    delete: (name: string) => request(`/cliproxy/${name}`, { method: 'DELETE' }),

    // Proxy process status and control
    proxyStatus: () => request<ProxyProcessStatus>('/cliproxy/proxy-status'),
    proxyStart: () => request<ProxyStartResult>('/cliproxy/proxy-start', { method: 'POST' }),

    // Stats and models for Overview tab
    stats: () => request<{ usage: Record<string, unknown> }>('/cliproxy/usage'),
    models: () => request<CliproxyModelsResponse>('/cliproxy/models'),
    updateModel: (provider: string, model: string) =>
      request(`/cliproxy/models/${provider}`, {
        method: 'PUT',
        body: JSON.stringify({ model }),
      }),

    // Config YAML for Config tab
    getConfigYaml: async (): Promise<string> => {
      const res = await fetch(`${BASE_URL}/cliproxy/config.yaml`);
      if (!res.ok) throw new Error('Failed to load config');
      return res.text();
    },
    saveConfigYaml: async (content: string): Promise<void> => {
      const res = await fetch(`${BASE_URL}/cliproxy/config.yaml`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/yaml' },
        body: content,
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'Failed to save config' }));
        throw new Error(error.error || 'Failed to save config');
      }
    },

    // Auth files for Config tab
    getAuthFiles: () => request<{ files: AuthFile[] }>('/cliproxy/auth-files'),
    getAuthFile: async (name: string): Promise<string> => {
      const res = await fetch(
        `${BASE_URL}/cliproxy/auth-files/download?name=${encodeURIComponent(name)}`
      );
      if (!res.ok) throw new Error('Failed to load auth file');
      return res.text();
    },

    // Multi-account management
    accounts: {
      list: () => request<{ accounts: ProviderAccountsMap }>('/cliproxy/accounts'),
      listByProvider: (provider: string) =>
        request<{ provider: string; accounts: OAuthAccount[] }>(`/cliproxy/accounts/${provider}`),
      setDefault: (provider: string, accountId: string) =>
        request(`/cliproxy/accounts/${provider}/default`, {
          method: 'POST',
          body: JSON.stringify({ accountId }),
        }),
      remove: (provider: string, accountId: string) =>
        request(`/cliproxy/accounts/${provider}/${accountId}`, { method: 'DELETE' }),
    },
    // OAuth flow
    auth: {
      /** Start OAuth flow - opens browser for authentication */
      start: (provider: string, nickname?: string) =>
        request<{ success: boolean; account: OAuthAccount }>(`/cliproxy/auth/${provider}/start`, {
          method: 'POST',
          body: JSON.stringify({ nickname }),
        }),
    },
    // Error logs
    errorLogs: {
      /** List error log files */
      list: () => request<{ files: CliproxyErrorLog[] }>('/cliproxy/error-logs'),
      /** Get content of a specific error log */
      getContent: async (name: string): Promise<string> => {
        const res = await fetch(`${BASE_URL}/cliproxy/error-logs/${encodeURIComponent(name)}`);
        if (!res.ok) throw new Error('Failed to load error log');
        return res.text();
      },
    },
  },
  accounts: {
    list: () => request<{ accounts: Account[]; default: string | null }>('/accounts'),
    setDefault: (name: string) =>
      request('/accounts/default', {
        method: 'POST',
        body: JSON.stringify({ name }),
      }),
  },
  // Unified config API
  config: {
    format: () => request<ConfigFormat>('/config/format'),
    get: () => request<Record<string, unknown>>('/config'),
    update: (config: Record<string, unknown>) =>
      request<{ success: boolean }>('/config', {
        method: 'PUT',
        body: JSON.stringify(config),
      }),
    migrate: (dryRun = false) =>
      request<MigrationResult>(`/config/migrate?dryRun=${dryRun}`, { method: 'POST' }),
    rollback: (backupPath: string) =>
      request<{ success: boolean }>('/config/rollback', {
        method: 'POST',
        body: JSON.stringify({ backupPath }),
      }),
  },
  secrets: {
    update: (profile: string, secrets: Record<string, string>) =>
      request<{ success: boolean }>(`/secrets/${profile}`, {
        method: 'PUT',
        body: JSON.stringify(secrets),
      }),
    exists: (profile: string) => request<SecretsExists>(`/secrets/${profile}/exists`),
  },
  /** Model presets for quick model switching */
  presets: {
    list: (profile: string) => request<{ presets: ModelPreset[] }>(`/settings/${profile}/presets`),
    create: (profile: string, data: CreatePreset) =>
      request<{ preset: ModelPreset }>(`/settings/${profile}/presets`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    delete: (profile: string, name: string) =>
      request<{ success: boolean }>(`/settings/${profile}/presets/${encodeURIComponent(name)}`, {
        method: 'DELETE',
      }),
  },
};
