/**
 * OAuth Readiness Health Checks
 *
 * Check OAuth port availability for providers.
 */

import { checkAuthCodePorts } from '../../management/oauth-port-diagnostics';
import type { HealthCheck } from './types';

/**
 * Check OAuth ports for dashboard (Gemini, Codex, Agy)
 */
export async function checkOAuthPortsForDashboard(): Promise<HealthCheck[]> {
  const portDiagnostics = await checkAuthCodePorts();

  return portDiagnostics.map((diag) => {
    const providerName = diag.provider.charAt(0).toUpperCase() + diag.provider.slice(1);
    const portStr = diag.port ? ` (${diag.port})` : '';

    let status: 'ok' | 'warning' | 'info' = 'ok';
    if (diag.status === 'occupied') status = 'warning';
    if (diag.status === 'not_applicable') status = 'info';

    return {
      id: `oauth-port-${diag.provider}`,
      name: `${providerName}${portStr}`,
      status,
      message: diag.message,
      details: diag.process ? `PID ${diag.process.pid}` : undefined,
      fix: diag.recommendation || undefined,
    };
  });
}
