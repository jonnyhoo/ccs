/**
 * Provider Presets for CLI
 *
 * Pre-configured templates for common API providers.
 * Mirrors the UI presets in ui/src/lib/provider-presets.ts
 */

export interface ProviderPreset {
  id: string;
  name: string;
  description: string;
  baseUrl: string;
  defaultProfileName: string;
  defaultModel: string;
  apiKeyPlaceholder: string;
  apiKeyHint: string;
  /** Additional env vars for thinking mode, etc. */
  extraEnv?: Record<string, string>;
  /** Enable always thinking mode */
  alwaysThinkingEnabled?: boolean;
}

export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

/**
 * Provider presets available via CLI and UI
 *
 * NOTE: Keep in sync with ui/src/lib/provider-presets.ts
 */
export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: 'openrouter',
    name: 'OpenRouter',
    description: '349+ models from OpenAI, Anthropic, Google, Meta',
    baseUrl: OPENROUTER_BASE_URL,
    defaultProfileName: 'openrouter',
    defaultModel: 'anthropic/claude-sonnet-4',
    apiKeyPlaceholder: 'sk-or-...',
    apiKeyHint: 'Get your API key at openrouter.ai/keys',
  },
  {
    id: 'glm',
    name: 'GLM',
    description: 'Claude via Z.AI (GitHub Copilot)',
    baseUrl: 'https://api.z.ai/api/anthropic',
    defaultProfileName: 'glm',
    defaultModel: 'glm-4.6',
    apiKeyPlaceholder: 'ghp_...',
    apiKeyHint: 'Get your API key from Z.AI',
  },
  {
    id: 'glmt',
    name: 'GLMT',
    description: 'GLM with Thinking mode support',
    baseUrl: 'https://api.z.ai/api/coding/paas/v4/chat/completions',
    defaultProfileName: 'glmt',
    defaultModel: 'glm-4.6',
    apiKeyPlaceholder: 'ghp_...',
    apiKeyHint: 'Same API key as GLM',
    extraEnv: {
      ANTHROPIC_TEMPERATURE: '0.2',
      ANTHROPIC_MAX_TOKENS: '65536',
      MAX_THINKING_TOKENS: '32768',
      ENABLE_STREAMING: 'true',
      ANTHROPIC_SAFE_MODE: 'false',
      API_TIMEOUT_MS: '3000000',
    },
    alwaysThinkingEnabled: true,
  },
  {
    id: 'kimi',
    name: 'Kimi',
    description: 'Moonshot AI - Fast reasoning model',
    baseUrl: 'https://api.kimi.com/coding/',
    defaultProfileName: 'kimi',
    defaultModel: 'kimi-k2-thinking-turbo',
    apiKeyPlaceholder: 'sk-...',
    apiKeyHint: 'Get your API key from Moonshot AI',
    alwaysThinkingEnabled: true,
  },
];

/** Get preset by ID */
export function getPresetById(id: string): ProviderPreset | undefined {
  return PROVIDER_PRESETS.find((p) => p.id === id.toLowerCase());
}

/** Get all preset IDs */
export function getPresetIds(): string[] {
  return PROVIDER_PRESETS.map((p) => p.id);
}

/** Check if preset ID is valid */
export function isValidPresetId(id: string): boolean {
  return getPresetById(id) !== undefined;
}
