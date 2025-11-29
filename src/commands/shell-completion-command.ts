/**
 * Shell Completion Command Handler
 *
 * Handle --shell-completion command for CCS.
 */

import { colored } from '../utils/helpers';

/**
 * Handle shell completion command
 */
export async function handleShellCompletionCommand(args: string[]): Promise<void> {
  const { ShellCompletionInstaller } = await import('../utils/shell-completion');

  console.log(colored('Shell Completion Installer', 'bold'));
  console.log('');

  // Parse flags
  let targetShell: string | null = null;
  if (args.includes('--bash')) targetShell = 'bash';
  else if (args.includes('--zsh')) targetShell = 'zsh';
  else if (args.includes('--fish')) targetShell = 'fish';
  else if (args.includes('--powershell')) targetShell = 'powershell';

  try {
    const installer = new ShellCompletionInstaller();
    const result = installer.install(targetShell as 'bash' | 'zsh' | 'fish' | 'powershell' | null);

    if (result.alreadyInstalled) {
      console.log(colored('[OK] Shell completion already installed', 'green'));
      console.log('');
      return;
    }

    console.log(colored('[OK] Shell completion installed successfully!', 'green'));
    console.log('');
    console.log(result.message);
    console.log('');
    console.log(colored('To activate:', 'cyan'));
    console.log(`  ${result.reload}`);
    console.log('');
    console.log(colored('Then test:', 'cyan'));
    console.log('  ccs <TAB>        # See available profiles');
    console.log('  ccs auth <TAB>   # See auth subcommands');
    console.log('');
  } catch (error) {
    const err = error as Error;
    console.error(colored('[X] Error:', 'red'), err.message);
    console.error('');
    console.error(colored('Usage:', 'yellow'));
    console.error('  ccs --shell-completion           # Auto-detect shell');
    console.error('  ccs --shell-completion --bash    # Install for bash');
    console.error('  ccs --shell-completion --zsh     # Install for zsh');
    console.error('  ccs --shell-completion --fish    # Install for fish');
    console.error('  ccs --shell-completion --powershell  # Install for PowerShell');
    console.error('');
    process.exit(1);
  }
}
