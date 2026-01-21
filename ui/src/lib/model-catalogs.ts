/**
 * Model Catalogs for CLIProxy providers
 * Shared data for Quick Setup Wizard and Provider Editor
 */

import type { ProviderCatalog } from '@/components/cliproxy/provider-model-selector';

/** Model catalog data - mirrors src/cliproxy/model-catalog.ts */
export const MODEL_CATALOGS: Record<string, ProviderCatalog> = {
  agy: {
    provider: 'agy',
    displayName: 'Antigravity',
    defaultModel: 'gemini-claude-opus-4-5-thinking',
    models: [
      {
        id: 'gemini-claude-opus-4-5-thinking',
        name: 'Claude Opus 4.5 Thinking',
        description: 'Most capable, extended thinking',
        presetMapping: {
          default: 'gemini-claude-opus-4-5-thinking',
          opus: 'gemini-claude-opus-4-5-thinking',
          sonnet: 'gemini-claude-sonnet-4-5-thinking',
          haiku: 'gemini-claude-sonnet-4-5',
        },
      },
      {
        id: 'gemini-claude-sonnet-4-5-thinking',
        name: 'Claude Sonnet 4.5 Thinking',
        description: 'Balanced with extended thinking',
        presetMapping: {
          default: 'gemini-claude-sonnet-4-5-thinking',
          opus: 'gemini-claude-opus-4-5-thinking',
          sonnet: 'gemini-claude-sonnet-4-5-thinking',
          haiku: 'gemini-claude-sonnet-4-5',
        },
      },
      {
        id: 'gemini-claude-sonnet-4-5',
        name: 'Claude Sonnet 4.5',
        description: 'Fast and capable',
        presetMapping: {
          default: 'gemini-claude-sonnet-4-5',
          opus: 'gemini-claude-opus-4-5-thinking',
          sonnet: 'gemini-claude-sonnet-4-5',
          haiku: 'gemini-claude-sonnet-4-5',
        },
      },
      {
        id: 'gemini-3-pro-preview',
        name: 'Gemini 3 Pro',
        description: 'Google latest model via Antigravity',
        presetMapping: {
          default: 'gemini-3-pro-preview',
          opus: 'gemini-3-pro-preview',
          sonnet: 'gemini-3-pro-preview',
          haiku: 'gemini-3-flash-preview',
        },
      },
      {
        id: 'gemini-3-flash-preview',
        name: 'Gemini 3 Flash',
        description: 'Fast Gemini model via Antigravity',
        presetMapping: {
          default: 'gemini-3-flash-preview',
          opus: 'gemini-3-pro-preview',
          sonnet: 'gemini-3-pro-preview',
          haiku: 'gemini-3-flash-preview',
        },
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
        presetMapping: {
          default: 'gemini-3-pro-preview',
          opus: 'gemini-3-pro-preview',
          sonnet: 'gemini-3-pro-preview',
          haiku: 'gemini-3-flash-preview',
        },
      },
      {
        id: 'gemini-3-flash-preview',
        name: 'Gemini 3 Flash',
        tier: 'paid',
        description: 'Fast Gemini 3 model, requires paid Google account',
        presetMapping: {
          default: 'gemini-3-flash-preview',
          opus: 'gemini-3-pro-preview',
          sonnet: 'gemini-3-pro-preview',
          haiku: 'gemini-3-flash-preview',
        },
      },
      {
        id: 'gemini-2.5-pro',
        name: 'Gemini 2.5 Pro',
        description: 'Stable, works with free Google account',
        presetMapping: {
          default: 'gemini-2.5-pro',
          opus: 'gemini-2.5-pro',
          sonnet: 'gemini-2.5-pro',
          haiku: 'gemini-2.5-flash',
        },
      },
    ],
  },
  codex: {
    provider: 'codex',
    displayName: 'Codex',
    defaultModel: 'gpt-5.2-codex',
    models: [
      {
        id: 'gpt-5.2-codex',
        name: 'GPT-5.2 Codex',
        description: 'Full reasoning support (xhigh)',
        presetMapping: {
          default: 'gpt-5.2-codex',
          opus: 'gpt-5.2-codex',
          sonnet: 'gpt-5.2-codex',
          haiku: 'gpt-5-mini',
        },
      },
      {
        id: 'gpt-5-mini',
        name: 'GPT-5 Mini',
        description: 'Fast, capped at high reasoning (no xhigh)',
        presetMapping: {
          default: 'gpt-5-mini',
          opus: 'gpt-5.2-codex',
          sonnet: 'gpt-5-mini',
          haiku: 'gpt-5-mini',
        },
      },
      {
        id: 'gpt-5.1-codex-max',
        name: 'Codex Max (5.1)',
        description: 'Legacy most capable Codex model',
        presetMapping: {
          default: 'gpt-5.1-codex-max',
          opus: 'gpt-5.1-codex-max-high',
          sonnet: 'gpt-5.1-codex-max',
          haiku: 'gpt-5.1-codex-mini-high',
        },
      },
      {
        id: 'gpt-5.2',
        name: 'GPT 5.2',
        description: 'Latest GPT model',
        presetMapping: {
          default: 'gpt-5.2',
          opus: 'gpt-5.2',
          sonnet: 'gpt-5.2',
          haiku: 'gpt-5.2',
        },
      },
      {
        id: 'gpt-5.1-codex-mini',
        name: 'Codex Mini',
        description: 'Fast and efficient Codex model',
      },
    ],
  },
  qwen: {
    provider: 'qwen',
    displayName: 'Qwen',
    defaultModel: 'qwen-coder-plus',
    models: [
      {
        id: 'qwen-coder-plus',
        name: 'Qwen Coder Plus',
        description: 'Alibaba code-focused model',
      },
      {
        id: 'qwen-max',
        name: 'Qwen Max',
        description: 'Most capable Qwen model',
      },
    ],
  },
  iflow: {
    provider: 'iflow',
    displayName: 'iFlow',
    defaultModel: 'iflow-default',
    models: [
      {
        id: 'iflow-default',
        name: 'iFlow Default',
        description: 'Default iFlow model',
      },
    ],
  },
  kiro: {
    provider: 'kiro',
    displayName: 'Kiro (AWS)',
    defaultModel: 'kiro-claude-sonnet-4-5',
    models: [
      {
        id: 'kiro-claude-opus-4-5',
        name: 'Kiro Claude Opus 4.5',
        description: 'Claude Opus 4.5 via Kiro (2.2x credit)',
        presetMapping: {
          default: 'kiro-claude-opus-4-5',
          opus: 'kiro-claude-opus-4-5',
          sonnet: 'kiro-claude-sonnet-4-5',
          haiku: 'kiro-claude-haiku-4-5',
        },
      },
      {
        id: 'kiro-claude-sonnet-4-5',
        name: 'Kiro Claude Sonnet 4.5',
        description: 'Claude Sonnet 4.5 via Kiro (1.3x credit)',
        presetMapping: {
          default: 'kiro-claude-sonnet-4-5',
          opus: 'kiro-claude-opus-4-5',
          sonnet: 'kiro-claude-sonnet-4-5',
          haiku: 'kiro-claude-haiku-4-5',
        },
      },
      {
        id: 'kiro-claude-sonnet-4',
        name: 'Kiro Claude Sonnet 4',
        description: 'Claude Sonnet 4 via Kiro (1.3x credit)',
        presetMapping: {
          default: 'kiro-claude-sonnet-4',
          opus: 'kiro-claude-opus-4-5',
          sonnet: 'kiro-claude-sonnet-4',
          haiku: 'kiro-claude-haiku-4-5',
        },
      },
      {
        id: 'kiro-claude-haiku-4-5',
        name: 'Kiro Claude Haiku 4.5',
        description: 'Claude Haiku 4.5 via Kiro (0.4x credit)',
      },
    ],
  },
  ghcp: {
    provider: 'ghcp',
    displayName: 'GitHub Copilot (OAuth)',
    defaultModel: 'claude-sonnet-4.5',
    models: [
      {
        id: 'claude-opus-4.5',
        name: 'Claude Opus 4.5',
        description: 'Anthropic Claude Opus 4.5 via GitHub Copilot',
        presetMapping: {
          default: 'claude-opus-4.5',
          opus: 'claude-opus-4.5',
          sonnet: 'claude-sonnet-4.5',
          haiku: 'claude-haiku-4.5',
        },
      },
      {
        id: 'claude-sonnet-4.5',
        name: 'Claude Sonnet 4.5',
        description: 'Anthropic Claude Sonnet 4.5 via GitHub Copilot',
        presetMapping: {
          default: 'claude-sonnet-4.5',
          opus: 'claude-opus-4.5',
          sonnet: 'claude-sonnet-4.5',
          haiku: 'claude-haiku-4.5',
        },
      },
      {
        id: 'claude-sonnet-4',
        name: 'Claude Sonnet 4',
        description: 'Anthropic Claude Sonnet 4 via GitHub Copilot',
      },
      {
        id: 'claude-haiku-4.5',
        name: 'Claude Haiku 4.5',
        description: 'Anthropic Claude Haiku 4.5 via GitHub Copilot',
      },
      {
        id: 'gpt-5.2',
        name: 'GPT-5.2',
        description: 'OpenAI GPT-5.2 via GitHub Copilot',
        presetMapping: {
          default: 'gpt-5.2',
          opus: 'gpt-5.2',
          sonnet: 'gpt-5.1',
          haiku: 'gpt-5-mini',
        },
      },
      {
        id: 'gpt-5.1',
        name: 'GPT-5.1',
        description: 'OpenAI GPT-5.1 via GitHub Copilot',
      },
      {
        id: 'gpt-5',
        name: 'GPT-5',
        description: 'OpenAI GPT-5 via GitHub Copilot',
      },
      {
        id: 'gpt-5-mini',
        name: 'GPT-5 Mini',
        description: 'OpenAI GPT-5 Mini via GitHub Copilot',
      },
      {
        id: 'gemini-3-pro',
        name: 'Gemini 3 Pro',
        description: 'Google Gemini 3 Pro via GitHub Copilot',
      },
    ],
  },
};
