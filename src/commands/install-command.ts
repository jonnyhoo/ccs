/**
 * Install/Uninstall Command Handlers
 *
 * Handle --install and --uninstall commands for CCS.
 */

import { info, ok, color, box, initUI } from '../utils/ui';
import { ClaudeSymlinkManager } from '../utils/claude-symlink-manager';

/**
 * Handle install command
 */
export async function handleInstallCommand(): Promise<void> {
  await initUI();
  console.log('');
  console.log(info('Feature not available'));
  console.log('');
  console.log('The --install flag is currently under development.');
  console.log('.claude/ integration testing is not complete.');
  console.log('');
  console.log(`For updates: ${color('https://github.com/kaitranntt/ccs/issues', 'path')}`);
  console.log('');
  process.exit(0);
}

/**
 * Handle uninstall command
 */
export async function handleUninstallCommand(): Promise<void> {
  await initUI();
  console.log('');
  console.log(box('Uninstalling CCS', { borderColor: 'cyan' }));
  console.log('');

  let removed = 0;

  // Remove symlinks from ~/.claude/
  const symlinkManager = new ClaudeSymlinkManager();
  const symlinksRemoved = symlinkManager.uninstall();
  removed += symlinksRemoved; // Add actual count of symlinks removed

  // Summary
  console.log('');
  if (removed > 0) {
    console.log(ok('Uninstall complete!'));
    console.log('');
    console.log(info('~/.ccs/ directory preserved'));
    console.log(info('To reinstall: ccs --install'));
  } else {
    console.log(info('Nothing to uninstall'));
  }
  console.log('');

  process.exit(0);
}
