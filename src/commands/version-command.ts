/**
 * Version Command Handler
 *
 * Handle --version command for CCS.
 */

import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { colored } from '../utils/helpers';
import { getConfigPath } from '../utils/config-manager';

// Get version from package.json
const CCS_VERSION = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf8')
).version;

/**
 * Handle version command
 */
export function handleVersionCommand(): void {
  console.log(colored(`CCS (Claude Code Switch) v${CCS_VERSION}`, 'bold'));
  console.log('');

  console.log(colored('Installation:', 'cyan'));
  const installLocation = process.argv[1] || '(not found)';
  console.log(`  ${colored('Location:'.padEnd(17), 'cyan')} ${installLocation}`);

  const ccsDir = path.join(os.homedir(), '.ccs');
  console.log(`  ${colored('CCS Directory:'.padEnd(17), 'cyan')} ${ccsDir}`);

  const configPath = getConfigPath();
  console.log(`  ${colored('Config:'.padEnd(17), 'cyan')} ${configPath}`);

  const profilesJson = path.join(os.homedir(), '.ccs', 'profiles.json');
  console.log(`  ${colored('Profiles:'.padEnd(17), 'cyan')} ${profilesJson}`);

  // Delegation status
  const delegationSessionsPath = path.join(os.homedir(), '.ccs', 'delegation-sessions.json');
  const delegationConfigured = fs.existsSync(delegationSessionsPath);

  const readyProfiles: string[] = [];

  // Check for profiles with valid API keys
  for (const profile of ['glm', 'kimi']) {
    const settingsPath = path.join(os.homedir(), '.ccs', `${profile}.settings.json`);
    if (fs.existsSync(settingsPath)) {
      try {
        const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
        const apiKey = settings.env?.ANTHROPIC_AUTH_TOKEN;
        if (apiKey && !apiKey.match(/YOUR_.*_API_KEY_HERE/) && !apiKey.match(/sk-test.*/)) {
          readyProfiles.push(profile);
        }
      } catch (_error) {
        // Invalid JSON, skip
      }
    }
  }

  const hasValidApiKeys = readyProfiles.length > 0;
  const delegationEnabled = delegationConfigured || hasValidApiKeys;

  if (delegationEnabled) {
    console.log(`  ${colored('Delegation:'.padEnd(17), 'cyan')} Enabled`);
  } else {
    console.log(`  ${colored('Delegation:'.padEnd(17), 'cyan')} Not configured`);
  }

  console.log('');

  if (readyProfiles.length > 0) {
    console.log(colored('Delegation Ready:', 'cyan'));
    console.log(
      `  ${colored('[OK]', 'yellow')} ${readyProfiles.join(', ')} profiles are ready for delegation`
    );
    console.log('');
  } else if (delegationEnabled) {
    console.log(colored('Delegation Ready:', 'cyan'));
    console.log(`  ${colored('[!]', 'yellow')} Delegation configured but no valid API keys found`);
    console.log('');
  }

  console.log(`${colored('Documentation:', 'cyan')} https://github.com/kaitranntt/ccs`);
  console.log(`${colored('License:', 'cyan')} MIT`);
  console.log('');
  console.log(colored("Run 'ccs --help' for usage information", 'yellow'));

  process.exit(0);
}
