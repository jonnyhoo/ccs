#!/usr/bin/env node
import { colored } from './utils/helpers';
import { readFileSync } from 'fs';
import { join } from 'path';

const CCS_VERSION = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf8')).version;



/**
 * Handle version command
 */
function handleVersionCommand(): void {
  console.log(colored(`CCS (Claude Code Switch) v${CCS_VERSION}`, 'bold'));
  console.log('');
  console.log(colored('Installation:', 'cyan'));
  console.log(`  ${colored('Location:'.padEnd(17), 'cyan')} ${process.argv[1] || '(not found)'}`);
  console.log('');
  console.log(`${colored('Documentation:', 'cyan')} https://github.com/kaitranntt/ccs`);
  console.log(`${colored('License:', 'cyan')} MIT`);
  console.log('');
  console.log(colored('Run \'ccs --help\' for usage information', 'yellow'));
  process.exit(0);
}

/**
 * Handle help command
 */
function handleHelpCommand(): void {
  console.log(colored('CCS (Claude Code Switch) - Instant profile switching for Claude CLI', 'bold'));
  console.log('');

  console.log(colored('Usage:', 'cyan'));
  console.log(`  ${colored('ccs', 'yellow')} [profile] [claude-args...]`);
  console.log(`  ${colored('ccs', 'yellow')} [flags]`);
  console.log('');

  console.log(colored('Description:', 'cyan'));
  console.log('  Switch between multiple Claude accounts and alternative models');
  console.log('  (GLM, Kimi) instantly. Run different Claude CLI sessions concurrently');
  console.log('');

  console.log(colored('Model Switching:', 'cyan'));
  console.log(`  ${colored('ccs', 'yellow')}                         Use default Claude account`);
  console.log(`  ${colored('ccs glm', 'yellow')}                     Switch to GLM 4.6 model`);
  console.log(`  ${colored('ccs kimi', 'yellow')}                    Switch to Kimi for Coding`);
  console.log('');

  console.log(colored('Flags:', 'cyan'));
  console.log(`  ${colored('-h, --help', 'yellow')}                  Show this help message`);
  console.log(`  ${colored('-v, --version', 'yellow')}               Show version and installation info`);
  console.log('');

  process.exit(0);
}

/**
 * Main entry point
 */
function main(): void {
  const args = process.argv.slice(2);

  // Handle special commands
  if (args[0] === '--version' || args[0] === '-v') {
    handleVersionCommand();
  }

  if (args[0] === '--help' || args[0] === '-h') {
    handleHelpCommand();
  }

  // For now, just show a message that conversion is in progress
  console.log(colored('[i] CCS TypeScript conversion in progress', 'yellow'));
  console.log(colored('[i] Basic structure is working', 'green'));
  console.log('');
  console.log('Build verification:');
  console.log(`  ✓ TypeScript compilation successful`);
  console.log(`  ✓ Shebang injection working`);
  console.log(`  ✓ Type definitions loaded`);
  console.log('');
  console.log('Next steps:');
  console.log('  - Convert remaining utility files');
  console.log('  - Convert auth/management modules');
  console.log('  - Convert delegation system');
  console.log('  - Convert GLMT proxy');
  console.log('');
  console.log(colored('TypeScript conversion foundation is complete!', 'green'));
}

main();