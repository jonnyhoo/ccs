/**
 * OAuth Port Health Checks - Pre-flight check for OAuth authentication
 */

import { ok, warn, info } from '../../utils/ui';
import { checkAuthCodePorts } from '../oauth-port-diagnostics';
import { HealthCheck, IHealthChecker, createSpinner } from './types';

const ora = createSpinner();

/**
 * Check OAuth callback ports availability
 */
export class OAuthPortsChecker implements IHealthChecker {
  name = 'OAuth Ports';

  async run(results: HealthCheck): Promise<void> {
    const spinner = ora('Checking OAuth callback ports').start();
    const portDiagnostics = await checkAuthCodePorts();

    // Count issues
    const conflicts = portDiagnostics.filter((d) => d.status === 'occupied');

    if (conflicts.length === 0) {
      spinner.succeed();
      console.log(`  ${ok('OAuth Ports'.padEnd(22))}  All callback ports available`);
      results.addCheck('OAuth Ports', 'success', undefined, undefined, {
        status: 'OK',
        info: 'All callback ports available',
      });
    } else {
      spinner.warn();
      console.log(`  ${warn('OAuth Ports'.padEnd(22))}  ${conflicts.length} port conflict(s)`);
      results.addCheck(
        'OAuth Ports',
        'warning',
        `${conflicts.length} port conflict(s)`,
        'Close conflicting applications before OAuth',
        { status: 'WARN', info: `${conflicts.length} conflict(s)` }
      );
    }

    // Show individual port status
    for (const diag of portDiagnostics) {
      const providerName = diag.provider.charAt(0).toUpperCase() + diag.provider.slice(1);
      const portStr = diag.port !== null ? `(${diag.port})` : '';

      let statusIcon: string;
      switch (diag.status) {
        case 'free':
        case 'cliproxy':
          statusIcon = ok(`${providerName} ${portStr}`.padEnd(20));
          break;
        case 'occupied':
          statusIcon = warn(`${providerName} ${portStr}`.padEnd(20));
          break;
        default:
          statusIcon = info(`${providerName} ${portStr}`.padEnd(20));
      }

      console.log(`  ${statusIcon}  ${diag.message}`);

      if (diag.recommendation && diag.status === 'occupied') {
        console.log(`  ${''.padEnd(24)}  Fix: ${diag.recommendation}`);
      }
    }
  }
}

/**
 * Run OAuth port checks
 */
export async function runOAuthChecks(results: HealthCheck): Promise<void> {
  const checker = new OAuthPortsChecker();
  await checker.run(results);
}
