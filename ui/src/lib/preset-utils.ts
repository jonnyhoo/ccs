/**
 * Preset Utilities
 * Shared functions for applying default presets to provider settings
 */

import { MODEL_CATALOGS } from './model-catalogs';

/** CLIProxy port - should match the backend configuration */
export const CLIPROXY_PORT = 8317;

/**
 * Apply default preset for a provider to its settings
 * Uses the first model's presetMapping or falls back to using defaultModel for all tiers
 *
 * @param provider - The provider ID (e.g., 'gemini', 'codex', 'agy')
 * @param port - Optional custom port (defaults to CLIPROXY_PORT)
 * @returns Object with success status and applied preset name
 */
export async function applyDefaultPreset(
  provider: string,
  port?: number
): Promise<{ success: boolean; presetName?: string }> {
  const catalog = MODEL_CATALOGS[provider];
  if (!catalog) return { success: false };

  // Get the first (recommended) model's preset mapping
  const firstModel = catalog.models[0];
  const mapping = firstModel?.presetMapping || {
    default: catalog.defaultModel,
    opus: catalog.defaultModel,
    sonnet: catalog.defaultModel,
    haiku: catalog.defaultModel,
  };

  const effectivePort = port ?? CLIPROXY_PORT;
  const settings = {
    env: {
      ANTHROPIC_BASE_URL: `http://127.0.0.1:${effectivePort}/api/provider/${provider}`,
      ANTHROPIC_AUTH_TOKEN: 'ccs-internal-managed',
      ANTHROPIC_MODEL: mapping.default,
      ANTHROPIC_DEFAULT_OPUS_MODEL: mapping.opus,
      ANTHROPIC_DEFAULT_SONNET_MODEL: mapping.sonnet,
      ANTHROPIC_DEFAULT_HAIKU_MODEL: mapping.haiku,
    },
  };

  try {
    const res = await fetch(`/api/settings/${provider}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings }),
    });
    return {
      success: res.ok,
      presetName: firstModel?.name || catalog.defaultModel,
    };
  } catch {
    return { success: false };
  }
}
