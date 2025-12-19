/**
 * Configuration Health Checks - Config files and Claude settings
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ok, fail, warn } from '../../utils/ui';
import { HealthCheck, IHealthChecker, createSpinner } from './types';

const ora = createSpinner();

/**
 * Check CCS config files exist and are valid JSON
 */
export class ConfigFilesChecker implements IHealthChecker {
  name = 'Config Files';
  private readonly ccsDir: string;

  constructor() {
    this.ccsDir = path.join(os.homedir(), '.ccs');
  }

  run(results: HealthCheck): void {
    const files = [
      { path: path.join(this.ccsDir, 'config.json'), name: 'config.json', key: 'config.json' },
      {
        path: path.join(this.ccsDir, 'glm.settings.json'),
        name: 'glm.settings.json',
        key: 'GLM Settings',
        profile: 'glm',
      },
      {
        path: path.join(this.ccsDir, 'kimi.settings.json'),
        name: 'kimi.settings.json',
        key: 'Kimi Settings',
        profile: 'kimi',
      },
    ];

    const { DelegationValidator } = require('../../utils/delegation-validator');

    for (const file of files) {
      const spinner = ora(`Checking ${file.name}`).start();

      if (!fs.existsSync(file.path)) {
        spinner.fail();
        console.log(`  ${fail(file.name.padEnd(22))}  Not found`);
        results.addCheck(
          file.name,
          'error',
          `${file.name} not found`,
          'Run: npm install -g @kaitranntt/ccs --force',
          { status: 'ERROR', info: 'Not found' }
        );
        continue;
      }

      // Validate JSON
      try {
        const content = fs.readFileSync(file.path, 'utf8');
        JSON.parse(content);

        // Extract useful info based on file type
        let fileInfo = 'Valid';
        let status: 'OK' | 'WARN' = 'OK';

        if (file.profile) {
          // For settings files, check if API key is configured
          const validation = DelegationValidator.validate(file.profile);

          if (validation.valid) {
            fileInfo = 'Key configured';
            status = 'OK';
          } else if (validation.error && validation.error.includes('placeholder')) {
            fileInfo = 'Placeholder key';
            status = 'WARN';
          } else {
            fileInfo = 'Valid JSON';
            status = 'OK';
          }
        }

        if (status === 'WARN') {
          spinner.warn();
          console.log(`  ${warn(file.name.padEnd(22))}  ${fileInfo}`);
        } else {
          spinner.succeed();
          console.log(`  ${ok(file.name.padEnd(22))}  ${fileInfo}`);
        }

        results.addCheck(file.name, status === 'OK' ? 'success' : 'warning', undefined, undefined, {
          status: status,
          info: fileInfo,
        });
      } catch (e) {
        spinner.fail();
        console.log(`  ${fail(file.name.padEnd(22))}  Invalid JSON`);
        results.addCheck(
          file.name,
          'error',
          `Invalid JSON: ${(e as Error).message}`,
          `Backup and recreate: mv ${file.path} ${file.path}.backup && npm install -g @kaitranntt/ccs --force`,
          { status: 'ERROR', info: 'Invalid JSON' }
        );
      }
    }
  }
}

/**
 * Check Claude settings.json
 */
export class ClaudeSettingsChecker implements IHealthChecker {
  name = 'Claude Settings';
  private readonly claudeDir: string;

  constructor() {
    this.claudeDir = path.join(os.homedir(), '.claude');
  }

  run(results: HealthCheck): void {
    const spinner = ora('Checking ~/.claude/settings.json').start();
    const settingsPath = path.join(this.claudeDir, 'settings.json');
    const settingsName = '~/.claude/settings.json';

    if (!fs.existsSync(settingsPath)) {
      spinner.warn();
      console.log(`  ${warn(settingsName.padEnd(22))}  Not found`);
      results.addCheck(
        'Claude Settings',
        'warning',
        '~/.claude/settings.json not found',
        'Run: claude /login'
      );
      return;
    }

    // Validate JSON
    try {
      const content = fs.readFileSync(settingsPath, 'utf8');
      JSON.parse(content);
      spinner.succeed();
      console.log(`  ${ok(settingsName.padEnd(22))}  Valid`);
      results.addCheck('Claude Settings', 'success');
    } catch (e) {
      spinner.warn();
      console.log(`  ${warn(settingsName.padEnd(22))}  Invalid JSON`);
      results.addCheck(
        'Claude Settings',
        'warning',
        `Invalid JSON: ${(e as Error).message}`,
        'Run: claude /login'
      );
    }
  }
}

/**
 * Run all config checks
 */
export function runConfigChecks(results: HealthCheck): void {
  const configChecker = new ConfigFilesChecker();
  const claudeChecker = new ClaudeSettingsChecker();

  configChecker.run(results);
  claudeChecker.run(results);
}
