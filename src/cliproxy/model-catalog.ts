/**
 * Model Catalog - Available models for CLI Proxy providers
 *
 * Ships with CCS to provide users with interactive model selection.
 * Models are mapped to their internal names used by the proxy backend.
 */

import { CLIProxyProvider } from './types';

/**
 * Model entry definition
 */
export interface ModelEntry {
  /** Literal model name to put in settings.json */
  id: string;
  /** Human-readable name for display */
  name: string;
  /** Access tier indicator - 'paid' means requires paid Google account (not free tier) */
  tier?: 'free' | 'paid';
  /** Optional description for the model */
  description?: string;
  /** Model has known issues - show warning when selected */
  broken?: boolean;
  /** Issue URL for broken models */
  issueUrl?: string;
}

/**
 * Provider catalog definition
 */
export interface ProviderCatalog {
  provider: CLIProxyProvider;
  displayName: string;
  models: ModelEntry[];
  defaultModel: string;
}

/**
 * Model catalog for providers that support interactive configuration
 *
 * Models listed in order of recommendation (top = best)
 */
export const MODEL_CATALOG: Partial<Record<CLIProxyProvider, ProviderCatalog>> = {
  agy: {
    provider: 'agy',
    displayName: 'Antigravity',
    defaultModel: 'gemini-3-pro-preview',
    models: [
      {
        id: 'gemini-claude-opus-4-5-thinking',
        name: 'Claude Opus 4.5 Thinking',
        description: 'Most capable, extended thinking',
        broken: true,
        issueUrl: 'https://github.com/router-for-me/CLIProxyAPI/issues/415',
      },
      {
        id: 'gemini-claude-sonnet-4-5-thinking',
        name: 'Claude Sonnet 4.5 Thinking',
        description: 'Balanced with extended thinking',
        broken: true,
        issueUrl: 'https://github.com/router-for-me/CLIProxyAPI/issues/415',
      },
      {
        id: 'gemini-claude-sonnet-4-5',
        name: 'Claude Sonnet 4.5',
        description: 'Fast and capable',
        broken: true,
        issueUrl: 'https://github.com/router-for-me/CLIProxyAPI/issues/415',
      },
      {
        id: 'gemini-3-pro-preview',
        name: 'Gemini 3 Pro',
        tier: 'paid',
        description: 'Google latest, requires paid Google account',
      },
    ],
  },
  gemini: {
    provider: 'gemini',
    displayName: 'Gemini',
    defaultModel: 'gemini-2.5-pro',
    models: [
      {
        id: 'gemini-3-pro-preview',
        name: 'Gemini 3 Pro',
        tier: 'paid',
        description: 'Latest model, requires paid Google account',
      },
      {
        id: 'gemini-2.5-pro',
        name: 'Gemini 2.5 Pro',
        description: 'Stable, works with free Google account',
      },
    ],
  },
};

/**
 * Check if provider supports interactive model configuration
 */
export function supportsModelConfig(provider: CLIProxyProvider): boolean {
  return provider in MODEL_CATALOG;
}

/**
 * Get catalog for provider
 */
export function getProviderCatalog(provider: CLIProxyProvider): ProviderCatalog | undefined {
  return MODEL_CATALOG[provider];
}

/**
 * Find model entry by ID
 */
export function findModel(provider: CLIProxyProvider, modelId: string): ModelEntry | undefined {
  const catalog = MODEL_CATALOG[provider];
  if (!catalog) return undefined;
  return catalog.models.find((m) => m.id === modelId);
}

/**
 * Check if model has known issues
 */
export function isModelBroken(provider: CLIProxyProvider, modelId: string): boolean {
  const model = findModel(provider, modelId);
  return model?.broken === true;
}

/**
 * Get issue URL for broken model
 */
export function getModelIssueUrl(provider: CLIProxyProvider, modelId: string): string | undefined {
  const model = findModel(provider, modelId);
  return model?.issueUrl;
}
