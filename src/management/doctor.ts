/**
 * CCS Health Check and Diagnostics - Main Orchestrator
 */

import { initUI, header, box, table, color, ok, fail, warn } from '../utils/ui';
import packageJson from '../../package.json';
import {
  HealthCheck,
  runSystemChecks,
  runEnvironmentCheck,
  runConfigChecks,
  runProfileChecks,
  runSymlinkChecks,
  runCLIProxyChecks,
  runOAuthChecks,
} from './checks';
import { runAutoRepair } from './repair';

/**
 * Doctor Class - Orchestrates health checks
 */
class Doctor {
  private readonly results: HealthCheck;
  private readonly ccsVersion: string;

  constructor() {
    this.results = new HealthCheck();
    this.ccsVersion = packageJson.version;
  }

  /**
   * Run all health checks
   */
  async runAllChecks(): Promise<HealthCheck> {
    await initUI();

    // Hero header box
    console.log(box(`CCS Health Check v${this.ccsVersion}`, { borderStyle: 'round', padding: 0 }));
    console.log('');

    // Store CCS version in details
    this.results.details['CCS Version'] = { status: 'OK', info: `v${this.ccsVersion}` };

    // Group 1: System
    console.log(header('SYSTEM'));
    await runSystemChecks(this.results);
    console.log('');

    // Group 2: Environment (OAuth readiness diagnostics)
    console.log(header('ENVIRONMENT'));
    runEnvironmentCheck(this.results);
    console.log('');

    // Group 3: Configuration
    console.log(header('CONFIGURATION'));
    runConfigChecks(this.results);
    console.log('');

    // Group 4: Profiles & Delegation
    console.log(header('PROFILES & DELEGATION'));
    runProfileChecks(this.results);
    console.log('');

    // Group 5: System Health
    console.log(header('SYSTEM HEALTH'));
    runSymlinkChecks(this.results);
    console.log('');

    // Group 6: CLIProxy (OAuth profiles)
    console.log(header('CLIPROXY (OAUTH PROFILES)'));
    await runCLIProxyChecks(this.results);
    console.log('');

    // Group 7: OAuth Readiness (port availability)
    console.log(header('OAUTH READINESS'));
    await runOAuthChecks(this.results);
    console.log('');

    this.showReport();
    return this.results;
  }

  /**
   * Show health check report
   */
  private showReport(): void {
    console.log('');
    console.log(header('HEALTH CHECK SUMMARY'));
    console.log('');

    // Build summary table rows
    const rows: string[][] = Object.entries(this.results.details).map(([component, detail]) => {
      const statusIndicator =
        detail.status === 'OK'
          ? color('[OK]', 'success')
          : detail.status === 'ERROR'
            ? color('[X]', 'error')
            : color('[!]', 'warning');

      return [component, statusIndicator, detail.info || ''];
    });

    console.log(
      table(rows, {
        head: ['Component', 'Status', 'Details'],
        colWidths: [20, 12, 35],
      })
    );
    console.log('');

    // Show errors if present
    if (this.results.hasErrors()) {
      console.log(header('ERRORS'));
      this.results.errors.forEach((err) => {
        console.log(`  ${fail(err.name)}: ${err.message}`);
        if (err.fix) {
          console.log(`    Fix: ${color(err.fix, 'command')}`);
        }
      });
      console.log('');
    }

    // Show warnings if present
    if (this.results.hasWarnings()) {
      console.log(header('WARNINGS'));
      this.results.warnings.forEach((w) => {
        console.log(`  ${warn(w.name)}: ${w.message}`);
        if (w.fix) {
          console.log(`    Fix: ${color(w.fix, 'command')}`);
        }
      });
      console.log('');
    }

    // Final status
    if (this.results.isHealthy() && !this.results.hasWarnings()) {
      console.log(ok('All checks passed! Installation is healthy.'));
    } else if (this.results.hasErrors()) {
      console.log(fail('Installation has errors. Run suggested fixes above.'));
    } else {
      console.log(
        ok(
          `Installation healthy (${this.results.warnings.length} warning${this.results.warnings.length !== 1 ? 's' : ''})`
        )
      );
    }

    console.log('');
  }

  /**
   * Generate JSON report
   */
  generateJsonReport(): string {
    return JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        platform: process.platform,
        nodeVersion: process.version,
        ccsVersion: packageJson.version,
        checks: this.results.checks,
        errors: this.results.errors,
        warnings: this.results.warnings,
        healthy: this.results.isHealthy(),
      },
      null,
      2
    );
  }

  /**
   * Fix detected issues (--fix flag)
   */
  async fixIssues(): Promise<void> {
    await runAutoRepair();
  }

  /**
   * Check if the health check results are healthy
   */
  isHealthy(): boolean {
    return this.results.isHealthy();
  }
}

export default Doctor;
