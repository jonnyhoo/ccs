/**
 * Environment Health Checks
 *
 * Check platform, SSH, TTY, and browser capability.
 */

import { getEnvironmentDiagnostics } from '../../management/environment-diagnostics';
import type { HealthCheck } from './types';

/**
 * Check environment (platform, SSH, TTY, browser capability)
 */
export function checkEnvironment(): HealthCheck {
  const diag = getEnvironmentDiagnostics();

  let status: 'ok' | 'warning' | 'info' = 'ok';
  let message = 'Browser available';

  if (diag.detectedHeadless) {
    if (diag.platform === 'win32' && diag.ttyStatus === 'undefined') {
      status = 'warning';
      message = 'Possible headless false positive (Windows)';
    } else if (diag.sshSession) {
      status = 'info';
      message = 'SSH session (headless mode)';
    } else {
      status = 'info';
      message = 'Headless environment';
    }
  }

  return {
    id: 'environment',
    name: 'Environment',
    status,
    message,
    details: `${diag.platformName} | SSH: ${diag.sshSession ? 'Yes' : 'No'} | Browser: ${diag.browserReason}`,
  };
}
