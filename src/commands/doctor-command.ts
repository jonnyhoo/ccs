/**
 * Doctor Command Handler
 *
 * Handle doctor command for CCS.
 */

import { initUI, header, dim, color, subheader } from '../utils/ui';

/**
 * Show help for doctor command
 */
function showHelp(): void {
  console.log('');
  console.log(header('ccs doctor'));
  console.log('');
  console.log('  Run health diagnostics on CCS installation.');
  console.log('');

  console.log(subheader('Usage:'));
  console.log(`  ${color('ccs doctor', 'command')} [options]`);
  console.log('');

  console.log(subheader('Options:'));
  console.log(`  ${color('--fix, -f', 'command')}     Attempt to auto-fix detected issues`);
  console.log(`  ${color('--help, -h', 'command')}    Show this help message`);
  console.log('');

  console.log(subheader('Checks performed:'));
  console.log(`  ${dim('-')} Config files (config.yaml, config.json)`);
  console.log(`  ${dim('-')} CLIProxy installation and process status`);
  console.log(`  ${dim('-')} OAuth port availability (8085, 1455, 51121)`);
  console.log(`  ${dim('-')} Symlink integrity (shared settings)`);
  console.log(`  ${dim('-')} Profile configuration validity`);
  console.log('');

  console.log(subheader('Auto-fix capabilities:'));
  console.log(`  ${dim('-')} Kill zombie CLIProxy processes`);
  console.log(`  ${dim('-')} Free blocked OAuth callback ports`);
  console.log(`  ${dim('-')} Regenerate outdated CLIProxy config`);
  console.log(`  ${dim('-')} Restore broken shared settings symlinks`);
  console.log('');

  console.log(subheader('Examples:'));
  console.log(
    `  $ ${color('ccs doctor', 'command')}          ${dim('# Run diagnostics (read-only)')}`
  );
  console.log(
    `  $ ${color('ccs doctor --fix', 'command')}    ${dim('# Run diagnostics and fix issues')}`
  );
  console.log('');

  console.log(subheader('Exit codes:'));
  console.log(`  ${color('0', 'command')}  All checks passed`);
  console.log(`  ${color('1', 'command')}  One or more checks failed`);
  console.log('');
}

/**
 * Handle doctor command
 * @param args - Command line arguments
 */
export async function handleDoctorCommand(args: string[]): Promise<void> {
  await initUI();

  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    return;
  }

  const shouldFix = args.includes('--fix') || args.includes('-f');

  const DoctorModule = await import('../management/doctor');
  const Doctor = DoctorModule.default;
  const doctor = new Doctor();

  await doctor.runAllChecks();

  if (shouldFix) {
    await doctor.fixIssues();
  }

  process.exit(doctor.isHealthy() ? 0 : 1);
}
