/**
 * Profile and Delegation Health Checks
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ok, fail, warn, info } from '../../utils/ui';
import { HealthCheck, IHealthChecker, createSpinner } from './types';

const ora = createSpinner();

/**
 * Check profile configurations in config.json
 */
export class ProfilesChecker implements IHealthChecker {
  name = 'Profiles';
  private readonly ccsDir: string;

  constructor() {
    this.ccsDir = path.join(os.homedir(), '.ccs');
  }

  run(results: HealthCheck): void {
    const spinner = ora('Checking profiles').start();
    const configPath = path.join(this.ccsDir, 'config.json');

    if (!fs.existsSync(configPath)) {
      spinner.info();
      console.log(`  ${info('Profiles'.padEnd(22))}  config.json not found`);
      return;
    }

    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

      if (!config.profiles || typeof config.profiles !== 'object') {
        spinner.fail();
        console.log(`  ${fail('Profiles'.padEnd(22))}  Missing profiles object`);
        results.addCheck(
          'Profiles',
          'error',
          'config.json missing profiles object',
          'Run: npm install -g @kaitranntt/ccs --force',
          { status: 'ERROR', info: 'Missing profiles object' }
        );
        return;
      }

      const profileCount = Object.keys(config.profiles).length;
      const profileNames = Object.keys(config.profiles).join(', ');

      spinner.succeed();
      console.log(`  ${ok('Profiles'.padEnd(22))}  ${profileCount} configured (${profileNames})`);
      results.addCheck('Profiles', 'success', `${profileCount} profiles configured`, undefined, {
        status: 'OK',
        info: `${profileCount} configured (${profileNames.length > 30 ? profileNames.substring(0, 27) + '...' : profileNames})`,
      });
    } catch (e) {
      spinner.fail();
      console.log(`  ${fail('Profiles'.padEnd(22))}  ${(e as Error).message}`);
      results.addCheck('Profiles', 'error', (e as Error).message, undefined, {
        status: 'ERROR',
        info: (e as Error).message,
      });
    }
  }
}

/**
 * Check instance directories (account-based profiles)
 */
export class InstancesChecker implements IHealthChecker {
  name = 'Instances';
  private readonly ccsDir: string;

  constructor() {
    this.ccsDir = path.join(os.homedir(), '.ccs');
  }

  run(results: HealthCheck): void {
    const spinner = ora('Checking instances').start();
    const instancesDir = path.join(this.ccsDir, 'instances');

    if (!fs.existsSync(instancesDir)) {
      spinner.info();
      console.log(`  ${info('Instances'.padEnd(22))}  No account profiles`);
      results.addCheck('Instances', 'success', 'No account profiles configured');
      return;
    }

    const instances = fs.readdirSync(instancesDir).filter((name) => {
      return fs.statSync(path.join(instancesDir, name)).isDirectory();
    });

    if (instances.length === 0) {
      spinner.info();
      console.log(`  ${info('Instances'.padEnd(22))}  No account profiles`);
      results.addCheck('Instances', 'success', 'No account profiles');
      return;
    }

    spinner.succeed();
    console.log(`  ${ok('Instances'.padEnd(22))}  ${instances.length} account profiles`);
    results.addCheck('Instances', 'success', `${instances.length} account profiles`);
  }
}

/**
 * Check delegation system (commands and ready profiles)
 */
export class DelegationChecker implements IHealthChecker {
  name = 'Delegation';
  private readonly ccsDir: string;

  constructor() {
    this.ccsDir = path.join(os.homedir(), '.ccs');
  }

  run(results: HealthCheck): void {
    const spinner = ora('Checking delegation').start();

    // Check if delegation commands exist in ~/.ccs/.claude/commands/
    const ccsClaudeCommandsDir = path.join(this.ccsDir, '.claude', 'commands');
    const hasCcsCommand = fs.existsSync(path.join(ccsClaudeCommandsDir, 'ccs.md'));
    const hasContinueCommand = fs.existsSync(path.join(ccsClaudeCommandsDir, 'ccs', 'continue.md'));

    if (!hasCcsCommand || !hasContinueCommand) {
      spinner.warn();
      console.log(`  ${warn('Delegation'.padEnd(22))}  Not installed`);
      results.addCheck(
        'Delegation',
        'warning',
        'Delegation commands not found',
        'Install with: npm install -g @kaitranntt/ccs --force',
        { status: 'WARN', info: 'Not installed' }
      );
      return;
    }

    // Check profile validity using DelegationValidator
    const { DelegationValidator } = require('../../utils/delegation-validator');
    const readyProfiles: string[] = [];

    for (const profile of ['glm', 'kimi']) {
      const validation = DelegationValidator.validate(profile);
      if (validation.valid) {
        readyProfiles.push(profile);
      }
    }

    if (readyProfiles.length === 0) {
      spinner.warn();
      console.log(`  ${warn('Delegation'.padEnd(22))}  No profiles ready`);
      results.addCheck(
        'Delegation',
        'warning',
        'Delegation installed but no profiles configured',
        'Configure profiles with valid API keys (not placeholders)',
        { status: 'WARN', info: 'No profiles ready' }
      );
      return;
    }

    spinner.succeed();
    console.log(
      `  ${ok('Delegation'.padEnd(22))}  ${readyProfiles.length} profiles ready (${readyProfiles.join(', ')})`
    );
    results.addCheck(
      'Delegation',
      'success',
      `${readyProfiles.length} profile(s) ready: ${readyProfiles.join(', ')}`,
      undefined,
      { status: 'OK', info: `${readyProfiles.length} profiles ready` }
    );
  }
}

/**
 * Run all profile checks
 */
export function runProfileChecks(results: HealthCheck): void {
  const profilesChecker = new ProfilesChecker();
  const instancesChecker = new InstancesChecker();
  const delegationChecker = new DelegationChecker();

  profilesChecker.run(results);
  instancesChecker.run(results);
  delegationChecker.run(results);
}
