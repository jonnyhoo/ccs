/**
 * WebSearch CLI Health Checks
 *
 * Check WebSearch CLI providers (Gemini CLI, Grok CLI).
 */

import { getWebSearchCliProviders, hasAnyWebSearchCli } from '../../utils/websearch-manager';
import type { HealthCheck } from './types';

/**
 * Check WebSearch CLI providers
 */
export function checkWebSearchClis(): HealthCheck[] {
  const providers = getWebSearchCliProviders();
  const checks: HealthCheck[] = [];

  for (const provider of providers) {
    if (provider.installed) {
      const freeTag = provider.freeTier ? ' (FREE)' : '';
      checks.push({
        id: `websearch-${provider.id}`,
        name: provider.name,
        status: 'ok',
        message: `v${provider.version || 'unknown'}${freeTag}`,
        details: provider.description,
      });
    } else {
      const keyNote = provider.requiresApiKey ? ` (needs ${provider.apiKeyEnvVar})` : ' (FREE)';
      checks.push({
        id: `websearch-${provider.id}`,
        name: provider.name,
        status: 'info',
        message: `Not installed${keyNote}`,
        fix: provider.installCommand,
        details: provider.description,
      });
    }
  }

  // Add summary check if no providers installed
  if (!hasAnyWebSearchCli()) {
    checks.push({
      id: 'websearch-summary',
      name: 'WebSearch Status',
      status: 'warning',
      message: 'No CLI tools installed',
      fix: 'npm install -g @google/gemini-cli (FREE)',
      details: 'Install a WebSearch CLI for real-time web access',
    });
  }

  return checks;
}
