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
}

export interface UpdateProfile {
  baseUrl?: string;
  apiKey?: string;
  model?: string;
}

export interface Variant {
  name: string;
  provider: 'gemini' | 'codex' | 'agy' | 'qwen';
  settings: string;
}

export interface CreateVariant {
  name: string;
  provider: 'gemini' | 'codex' | 'agy' | 'qwen';
  model?: string;
}

export interface AuthStatus {
  provider: string;
  displayName: string;
  authenticated: boolean;
  lastAuth: string | null;
  tokenFiles: number;
}

export interface Account {
  name: string;
  type?: string;
  created: string;
  last_used?: string | null;
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
    auth: () => request<{ authStatus: AuthStatus[] }>('/cliproxy/auth'),
    create: (data: CreateVariant) =>
      request('/cliproxy', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    delete: (name: string) => request(`/cliproxy/${name}`, { method: 'DELETE' }),
  },
  accounts: {
    list: () => request<{ accounts: Account[]; default: string | null }>('/accounts'),
    setDefault: (name: string) =>
      request('/accounts/default', {
        method: 'POST',
        body: JSON.stringify({ name }),
      }),
  },
};
