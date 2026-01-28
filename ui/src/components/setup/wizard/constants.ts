/**
 * Constants for Quick Setup Wizard
 */

import type { ProviderOption } from './types';

export const PROVIDERS: ProviderOption[] = [
  { id: 'agy', name: 'Antigravity', description: 'Antigravity AI models' },
  { id: 'claude', name: 'Claude (Anthropic)', description: 'Claude Opus/Sonnet models' },
  { id: 'gemini', name: 'Google Gemini', description: 'Gemini Pro/Flash models' },
  { id: 'codex', name: 'OpenAI Codex', description: 'GPT-4 and codex models' },
  { id: 'qwen', name: 'Alibaba Qwen', description: 'Qwen Code models' },
  { id: 'iflow', name: 'iFlow', description: 'iFlow AI models' },
  { id: 'kiro', name: 'Kiro (AWS)', description: 'AWS CodeWhisperer models' },
  { id: 'ghcp', name: 'GitHub Copilot (OAuth)', description: 'GitHub Copilot via OAuth' },
];

export const ALL_STEPS = ['provider', 'auth', 'variant', 'success'];

export function getStepProgress(step: string): number {
  if (step === 'account') return 1; // Same as auth
  return ALL_STEPS.indexOf(step);
}
