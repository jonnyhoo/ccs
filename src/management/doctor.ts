/**
 * CCS Health Check and Diagnostics
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { spawn } from 'child_process';
import { getClaudeCliInfo } from '../utils/claude-detector';
import { escapeShellArg } from '../utils/shell-executor';
import { initUI, header, box, table, color, ok, fail, warn, info } from '../utils/ui';
import packageJson from '../../package.json';
import {
  isCLIProxyInstalled,
  getCLIProxyPath,
  getAllAuthStatus,
  getConfigPath,
  getInstalledCliproxyVersion,
  CLIPROXY_DEFAULT_PORT,
} from '../cliproxy';
import { getPortProcess, isCLIProxyProcess } from '../utils/port-utils';

// Make ora optional (might not be available during npm install postinstall)
// ora v9+ is an ES module, need to use .default for CommonJS
interface Spinner {
  start(): {
    succeed(msg?: string): void;
    fail(msg?: string): void;
    warn(msg?: string): void;
    info(msg?: string): void;
    text: string;
  };
}

let ora: (text: string) => Spinner;
try {
  const oraModule = require('ora');
  ora = oraModule.default || oraModule;
} catch (_e) {
  // ora not available, create fallback spinner that uses console.log
  ora = function (text: string): Spinner {
    return {
      start: () => ({
        succeed: (msg?: string) => console.log(msg || `[OK] ${text}`),
        fail: (msg?: string) => console.log(msg || `[X] ${text}`),
        warn: (msg?: string) => console.log(msg || `[!] ${text}`),
        info: (msg?: string) => console.log(msg || `[i] ${text}`),
        text: '',
      }),
    };
  };
}

interface HealthCheckDetails {
  status: 'OK' | 'ERROR' | 'WARN';
  info: string;
}

interface HealthCheckItem {
  name: string;
  status: 'success' | 'error' | 'warning';
  message?: string;
  fix?: string;
}

interface HealthIssue {
  name: string;
  message: string;
  fix?: string;
}

/**
 * Health check results
 */
class HealthCheck {
  public checks: HealthCheckItem[] = [];
  public warnings: HealthIssue[] = [];
  public errors: HealthIssue[] = [];
  public details: Record<string, HealthCheckDetails> = {};

  addCheck(
    name: string,
    status: 'success' | 'error' | 'warning',
    message = '',
    fix: string | undefined = undefined,
    details: HealthCheckDetails | undefined = undefined
  ): void {
    this.checks.push({ name, status, message, fix });

    if (status === 'error') this.errors.push({ name, message, fix });
    if (status === 'warning') this.warnings.push({ name, message, fix });

    // Store details for summary table
    if (details) {
      this.details[name] = details;
    }
  }

  hasErrors(): boolean {
    return this.errors.length > 0;
  }

  hasWarnings(): boolean {
    return this.warnings.length > 0;
  }

  isHealthy(): boolean {
    return !this.hasErrors();
  }
}

/**
 * Doctor Class
 */
class Doctor {
  private readonly homedir: string;
  private readonly ccsDir: string;
  private readonly claudeDir: string;
  private readonly results: HealthCheck;
  private readonly ccsVersion: string;

  constructor() {
    this.homedir = os.homedir();
    this.ccsDir = path.join(this.homedir, '.ccs');
    this.claudeDir = path.join(this.homedir, '.claude');
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
    await this.checkClaudeCli();
    this.checkCcsDirectory();
    console.log('');

    // Group 2: Configuration
    console.log(header('CONFIGURATION'));
    this.checkConfigFiles();
    this.checkClaudeSettings();
    console.log('');

    // Group 3: Profiles & Delegation
    console.log(header('PROFILES & DELEGATION'));
    this.checkProfiles();
    this.checkInstances();
    this.checkDelegation();
    console.log('');

    // Group 4: System Health
    console.log(header('SYSTEM HEALTH'));
    this.checkPermissions();
    this.checkCcsSymlinks();
    this.checkSettingsSymlinks();
    console.log('');

    // Group 5: CLIProxy (OAuth profiles)
    console.log(header('CLIPROXY (OAUTH PROFILES)'));
    await this.checkCLIProxy();
    console.log('');

    this.showReport();
    return this.results;
  }

  /**
   * Check 1: Claude CLI availability
   */
  private async checkClaudeCli(): Promise<void> {
    const spinner = ora('Checking Claude CLI').start();

    const cliInfo = getClaudeCliInfo();

    if (!cliInfo) {
      spinner.fail();
      console.log(`  ${fail('Claude CLI'.padEnd(22))}  Not found in PATH`);
      this.results.addCheck(
        'Claude CLI',
        'error',
        'Claude CLI not found in PATH',
        'Install from: https://docs.claude.com/en/docs/claude-code/installation',
        { status: 'ERROR', info: 'Not installed' }
      );
      return;
    }

    const { path: claudeCli, needsShell } = cliInfo;

    // Try to execute claude --version
    try {
      const result = await new Promise<string>((resolve, reject) => {
        // When shell is needed (Windows .cmd/.bat files), concatenate into string
        // to avoid DEP0190 warning about passing args with shell: true
        const child = needsShell
          ? spawn([claudeCli, '--version'].map(escapeShellArg).join(' '), {
              stdio: 'pipe',
              timeout: 5000,
              shell: true,
            })
          : spawn(claudeCli, ['--version'], {
              stdio: 'pipe',
              timeout: 5000,
            });

        let output = '';
        child.stdout?.on('data', (data: Buffer) => (output += data));
        child.stderr?.on('data', (data: Buffer) => (output += data));

        child.on('close', (code: number | null) => {
          if (code === 0) resolve(output);
          else reject(new Error('Exit code ' + code));
        });

        child.on('error', reject);
      });

      // Extract version from output
      const versionMatch = result.match(/(\d+\.\d+\.\d+)/);
      const version = versionMatch ? versionMatch[1] : 'unknown';

      spinner.succeed();
      console.log(`  ${ok('Claude CLI'.padEnd(22))}  v${version} (${claudeCli})`);
      this.results.addCheck('Claude CLI', 'success', `Found: ${claudeCli}`, undefined, {
        status: 'OK',
        info: `v${version} (${claudeCli})`,
      });
    } catch (_err) {
      spinner.fail();
      console.log(`  ${fail('Claude CLI'.padEnd(22))}  Not found or not working`);
      this.results.addCheck(
        'Claude CLI',
        'error',
        'Claude CLI not found or not working',
        'Install from: https://docs.claude.com/en/docs/claude-code/installation',
        { status: 'ERROR', info: 'Not installed' }
      );
    }
  }

  /**
   * Check 2: ~/.ccs/ directory
   */
  private checkCcsDirectory(): void {
    const spinner = ora('Checking ~/.ccs/ directory').start();

    if (fs.existsSync(this.ccsDir)) {
      spinner.succeed();
      console.log(`  ${ok('CCS Directory'.padEnd(22))}  ~/.ccs/`);
      this.results.addCheck('CCS Directory', 'success', undefined, undefined, {
        status: 'OK',
        info: '~/.ccs/',
      });
    } else {
      spinner.fail();
      console.log(`  ${fail('CCS Directory'.padEnd(22))}  Not found`);
      this.results.addCheck(
        'CCS Directory',
        'error',
        '~/.ccs/ directory not found',
        'Run: npm install -g @kaitranntt/ccs --force',
        { status: 'ERROR', info: 'Not found' }
      );
    }
  }

  /**
   * Check 3: Config files
   */
  private checkConfigFiles(): void {
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

    const { DelegationValidator } = require('../utils/delegation-validator');

    for (const file of files) {
      const spinner = ora(`Checking ${file.name}`).start();

      if (!fs.existsSync(file.path)) {
        spinner.fail();
        console.log(`  ${fail(file.name.padEnd(22))}  Not found`);
        this.results.addCheck(
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

        this.results.addCheck(
          file.name,
          status === 'OK' ? 'success' : 'warning',
          undefined,
          undefined,
          {
            status: status,
            info: fileInfo,
          }
        );
      } catch (e) {
        spinner.fail();
        console.log(`  ${fail(file.name.padEnd(22))}  Invalid JSON`);
        this.results.addCheck(
          file.name,
          'error',
          `Invalid JSON: ${(e as Error).message}`,
          `Backup and recreate: mv ${file.path} ${file.path}.backup && npm install -g @kaitranntt/ccs --force`,
          { status: 'ERROR', info: 'Invalid JSON' }
        );
      }
    }
  }

  /**
   * Check 4: Claude settings
   */
  private checkClaudeSettings(): void {
    const spinner = ora('Checking ~/.claude/settings.json').start();
    const settingsPath = path.join(this.claudeDir, 'settings.json');
    const settingsName = '~/.claude/settings.json';

    if (!fs.existsSync(settingsPath)) {
      spinner.warn();
      console.log(`  ${warn(settingsName.padEnd(22))}  Not found`);
      this.results.addCheck(
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
      this.results.addCheck('Claude Settings', 'success');
    } catch (e) {
      spinner.warn();
      console.log(`  ${warn(settingsName.padEnd(22))}  Invalid JSON`);
      this.results.addCheck(
        'Claude Settings',
        'warning',
        `Invalid JSON: ${(e as Error).message}`,
        'Run: claude /login'
      );
    }
  }

  /**
   * Check 5: Profile configurations
   */
  private checkProfiles(): void {
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
        this.results.addCheck(
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
      this.results.addCheck(
        'Profiles',
        'success',
        `${profileCount} profiles configured`,
        undefined,
        {
          status: 'OK',
          info: `${profileCount} configured (${profileNames.length > 30 ? profileNames.substring(0, 27) + '...' : profileNames})`,
        }
      );
    } catch (e) {
      spinner.fail();
      console.log(`  ${fail('Profiles'.padEnd(22))}  ${(e as Error).message}`);
      this.results.addCheck('Profiles', 'error', (e as Error).message, undefined, {
        status: 'ERROR',
        info: (e as Error).message,
      });
    }
  }

  /**
   * Check 6: Instance directories (account-based profiles)
   */
  private checkInstances(): void {
    const spinner = ora('Checking instances').start();
    const instancesDir = path.join(this.ccsDir, 'instances');

    if (!fs.existsSync(instancesDir)) {
      spinner.info();
      console.log(`  ${info('Instances'.padEnd(22))}  No account profiles`);
      this.results.addCheck('Instances', 'success', 'No account profiles configured');
      return;
    }

    const instances = fs.readdirSync(instancesDir).filter((name) => {
      return fs.statSync(path.join(instancesDir, name)).isDirectory();
    });

    if (instances.length === 0) {
      spinner.info();
      console.log(`  ${info('Instances'.padEnd(22))}  No account profiles`);
      this.results.addCheck('Instances', 'success', 'No account profiles');
      return;
    }

    spinner.succeed();
    console.log(`  ${ok('Instances'.padEnd(22))}  ${instances.length} account profiles`);
    this.results.addCheck('Instances', 'success', `${instances.length} account profiles`);
  }

  /**
   * Check 7: Delegation system
   */
  private checkDelegation(): void {
    const spinner = ora('Checking delegation').start();

    // Check if delegation commands exist in ~/.ccs/.claude/commands/
    const ccsClaudeCommandsDir = path.join(this.ccsDir, '.claude', 'commands');
    const hasCcsCommand = fs.existsSync(path.join(ccsClaudeCommandsDir, 'ccs.md'));
    const hasContinueCommand = fs.existsSync(path.join(ccsClaudeCommandsDir, 'ccs', 'continue.md'));

    if (!hasCcsCommand || !hasContinueCommand) {
      spinner.warn();
      console.log(`  ${warn('Delegation'.padEnd(22))}  Not installed`);
      this.results.addCheck(
        'Delegation',
        'warning',
        'Delegation commands not found',
        'Install with: npm install -g @kaitranntt/ccs --force',
        { status: 'WARN', info: 'Not installed' }
      );
      return;
    }

    // Check profile validity using DelegationValidator
    const { DelegationValidator } = require('../utils/delegation-validator');
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
      this.results.addCheck(
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
    this.results.addCheck(
      'Delegation',
      'success',
      `${readyProfiles.length} profile(s) ready: ${readyProfiles.join(', ')}`,
      undefined,
      { status: 'OK', info: `${readyProfiles.length} profiles ready` }
    );
  }

  /**
   * Check 8: File permissions
   */
  private checkPermissions(): void {
    const spinner = ora('Checking permissions').start();
    const testFile = path.join(this.ccsDir, '.permission-test');

    try {
      fs.writeFileSync(testFile, 'test', 'utf8');
      fs.unlinkSync(testFile);
      spinner.succeed();
      console.log(`  ${ok('Permissions'.padEnd(22))}  Write access verified`);
      this.results.addCheck('Permissions', 'success', undefined, undefined, {
        status: 'OK',
        info: 'Write access verified',
      });
    } catch (_e) {
      spinner.fail();
      console.log(`  ${fail('Permissions'.padEnd(22))}  Cannot write to ~/.ccs/`);
      this.results.addCheck(
        'Permissions',
        'error',
        'Cannot write to ~/.ccs/',
        'Fix: sudo chown -R $USER ~/.ccs ~/.claude && chmod 755 ~/.ccs ~/.claude',
        { status: 'ERROR', info: 'Cannot write to ~/.ccs/' }
      );
    }
  }

  /**
   * Check 9: CCS symlinks to ~/.claude/
   */
  private checkCcsSymlinks(): void {
    const spinner = ora('Checking CCS symlinks').start();

    try {
      const { ClaudeSymlinkManager } = require('../utils/claude-symlink-manager');
      const manager = new ClaudeSymlinkManager();
      const health = manager.checkHealth();

      if (health.healthy) {
        const itemCount = manager.ccsItems.length;
        spinner.succeed();
        console.log(`  ${ok('CCS Symlinks'.padEnd(22))}  ${itemCount}/${itemCount} items linked`);
        this.results.addCheck(
          'CCS Symlinks',
          'success',
          'All CCS items properly symlinked',
          undefined,
          {
            status: 'OK',
            info: `${itemCount}/${itemCount} items synced`,
          }
        );
      } else {
        spinner.warn();
        console.log(`  ${warn('CCS Symlinks'.padEnd(22))}  ${health.issues.length} issues found`);
        this.results.addCheck(
          'CCS Symlinks',
          'warning',
          health.issues.join(', '),
          'Run: ccs sync',
          { status: 'WARN', info: `${health.issues.length} issues` }
        );
      }
    } catch (e) {
      spinner.warn();
      console.log(`  ${warn('CCS Symlinks'.padEnd(22))}  Could not check`);
      this.results.addCheck(
        'CCS Symlinks',
        'warning',
        'Could not check CCS symlinks: ' + (e as Error).message,
        'Run: ccs sync',
        { status: 'WARN', info: 'Could not check' }
      );
    }
  }

  /**
   * Check 10: settings.json symlinks
   */
  private checkSettingsSymlinks(): void {
    const spinner = ora('Checking settings.json symlinks').start();
    const settingsLabel = 'settings.json';

    try {
      const sharedDir = path.join(this.homedir, '.ccs', 'shared');
      const sharedSettings = path.join(sharedDir, 'settings.json');
      const claudeSettings = path.join(this.claudeDir, 'settings.json');

      // Check shared settings exists and points to ~/.claude/
      if (!fs.existsSync(sharedSettings)) {
        spinner.warn();
        console.log(`  ${warn(settingsLabel.padEnd(22))}  Not found (shared)`);
        this.results.addCheck(
          'Settings Symlinks',
          'warning',
          'Shared settings.json not found',
          'Run: ccs sync'
        );
        return;
      }

      const sharedStats = fs.lstatSync(sharedSettings);
      if (!sharedStats.isSymbolicLink()) {
        spinner.warn();
        console.log(`  ${warn(settingsLabel.padEnd(22))}  Not a symlink (shared)`);
        this.results.addCheck(
          'Settings Symlinks',
          'warning',
          'Shared settings.json is not a symlink',
          'Run: ccs sync'
        );
        return;
      }

      const sharedTarget = fs.readlinkSync(sharedSettings);
      const resolvedShared = path.resolve(path.dirname(sharedSettings), sharedTarget);

      if (resolvedShared !== claudeSettings) {
        spinner.warn();
        console.log(`  ${warn(settingsLabel.padEnd(22))}  Wrong target (shared)`);
        this.results.addCheck(
          'Settings Symlinks',
          'warning',
          `Points to ${resolvedShared} instead of ${claudeSettings}`,
          'Run: ccs sync'
        );
        return;
      }

      // Check each instance
      const instancesDir = path.join(this.ccsDir, 'instances');
      if (!fs.existsSync(instancesDir)) {
        spinner.succeed();
        console.log(`  ${ok(settingsLabel.padEnd(22))}  Shared symlink valid`);
        this.results.addCheck('Settings Symlinks', 'success', 'Shared symlink valid', undefined, {
          status: 'OK',
          info: 'Shared symlink valid',
        });
        return;
      }

      const instances = fs.readdirSync(instancesDir).filter((name) => {
        return fs.statSync(path.join(instancesDir, name)).isDirectory();
      });

      let broken = 0;
      for (const instance of instances) {
        const instancePath = path.join(instancesDir, instance);
        const instanceSettings = path.join(instancePath, 'settings.json');

        if (!fs.existsSync(instanceSettings)) {
          broken++;
          continue;
        }

        try {
          const stats = fs.lstatSync(instanceSettings);
          if (!stats.isSymbolicLink()) {
            broken++;
            continue;
          }

          const target = fs.readlinkSync(instanceSettings);
          const resolved = path.resolve(path.dirname(instanceSettings), target);

          if (resolved !== sharedSettings) {
            broken++;
          }
        } catch (_err) {
          broken++;
        }
      }

      if (broken > 0) {
        spinner.warn();
        console.log(`  ${warn(settingsLabel.padEnd(22))}  ${broken} broken instance(s)`);
        this.results.addCheck(
          'Settings Symlinks',
          'warning',
          `${broken} instance(s) have broken symlinks`,
          'Run: ccs sync',
          { status: 'WARN', info: `${broken} broken instance(s)` }
        );
      } else {
        spinner.succeed();
        console.log(`  ${ok(settingsLabel.padEnd(22))}  ${instances.length} instance(s) valid`);
        this.results.addCheck(
          'Settings Symlinks',
          'success',
          'All instance symlinks valid',
          undefined,
          {
            status: 'OK',
            info: `${instances.length} instance(s) valid`,
          }
        );
      }
    } catch (err) {
      spinner.warn();
      console.log(`  ${warn(settingsLabel.padEnd(22))}  Check failed`);
      this.results.addCheck(
        'Settings Symlinks',
        'warning',
        `Failed to check: ${(err as Error).message}`,
        'Run: ccs sync',
        { status: 'WARN', info: 'Check failed' }
      );
    }
  }

  /**
   * Check 11: CLIProxy health (OAuth profiles: gemini, codex, agy, qwen)
   */
  private async checkCLIProxy(): Promise<void> {
    // 1. Binary installed?
    const binarySpinner = ora('Checking CLIProxy binary').start();

    if (isCLIProxyInstalled()) {
      const binaryPath = getCLIProxyPath();
      const installedVersion = getInstalledCliproxyVersion();
      binarySpinner.succeed();
      console.log(`  ${ok('CLIProxy Binary'.padEnd(22))}  v${installedVersion}`);
      this.results.addCheck('CLIProxy Binary', 'success', undefined, undefined, {
        status: 'OK',
        info: `v${installedVersion} (${binaryPath})`,
      });
    } else {
      binarySpinner.info();
      console.log(
        `  ${info('CLIProxy Binary'.padEnd(22))}  Not installed (downloads on first use)`
      );
      this.results.addCheck(
        'CLIProxy Binary',
        'success',
        'Not installed yet',
        'Run: ccs gemini "test" (will download automatically)',
        { status: 'OK', info: 'Not installed (downloads on first use)' }
      );
    }

    // 2. Config file exists?
    const configSpinner = ora('Checking CLIProxy config').start();
    const configPath = getConfigPath();

    if (fs.existsSync(configPath)) {
      configSpinner.succeed();
      console.log(`  ${ok('CLIProxy Config'.padEnd(22))}  cliproxy/config.yaml`);
      this.results.addCheck('CLIProxy Config', 'success', undefined, undefined, {
        status: 'OK',
        info: 'cliproxy/config.yaml',
      });
    } else {
      configSpinner.info();
      console.log(`  ${info('CLIProxy Config'.padEnd(22))}  Not created (on first use)`);
      this.results.addCheck('CLIProxy Config', 'success', 'Not created yet', undefined, {
        status: 'OK',
        info: 'Generated on first use',
      });
    }

    // 3. OAuth status for each provider
    const authStatuses = getAllAuthStatus();
    for (const status of authStatuses) {
      const authSpinner = ora(`Checking ${status.provider} auth`).start();
      const providerName = status.provider.charAt(0).toUpperCase() + status.provider.slice(1);

      if (status.authenticated) {
        const lastAuth = status.lastAuth ? ` (${status.lastAuth.toLocaleDateString()})` : '';
        authSpinner.succeed();
        console.log(`  ${ok(`${providerName} Auth`.padEnd(22))}  Authenticated${lastAuth}`);
        this.results.addCheck(`${providerName} Auth`, 'success', undefined, undefined, {
          status: 'OK',
          info: `Authenticated${lastAuth}`,
        });
      } else {
        authSpinner.info();
        console.log(`  ${info(`${providerName} Auth`.padEnd(22))}  Not authenticated`);
        this.results.addCheck(
          `${providerName} Auth`,
          'success',
          'Not authenticated',
          `Run: ccs ${status.provider} --auth`,
          { status: 'OK', info: 'Not authenticated (run ccs <profile> to login)' }
        );
      }
    }

    // 4. Port status (check if CLIProxy or other process)
    const portSpinner = ora(`Checking port ${CLIPROXY_DEFAULT_PORT}`).start();
    const portProcess = await getPortProcess(CLIPROXY_DEFAULT_PORT);

    if (!portProcess) {
      // Port is free
      portSpinner.info();
      console.log(
        `  ${info('CLIProxy Port'.padEnd(22))}  ${CLIPROXY_DEFAULT_PORT} free (proxy not running)`
      );
      this.results.addCheck('CLIProxy Port', 'success', undefined, undefined, {
        status: 'OK',
        info: `Port ${CLIPROXY_DEFAULT_PORT} free`,
      });
    } else if (isCLIProxyProcess(portProcess)) {
      // CLIProxy is running (expected)
      portSpinner.succeed();
      console.log(`  ${ok('CLIProxy Port'.padEnd(22))}  CLIProxy running (PID ${portProcess.pid})`);
      this.results.addCheck('CLIProxy Port', 'success', undefined, undefined, {
        status: 'OK',
        info: `CLIProxy running (PID ${portProcess.pid})`,
      });
    } else {
      // Port conflict - different process
      portSpinner.warn();
      console.log(
        `  ${warn('CLIProxy Port'.padEnd(22))}  ${CLIPROXY_DEFAULT_PORT} occupied by ${portProcess.processName}`
      );
      this.results.addCheck(
        'CLIProxy Port',
        'warning',
        `Port ${CLIPROXY_DEFAULT_PORT} occupied by ${portProcess.processName} (PID ${portProcess.pid})`,
        `Kill process: kill ${portProcess.pid} (or restart conflicting application)`,
        { status: 'WARN', info: `Occupied by ${portProcess.processName}` }
      );
    }
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
   * Fix detected issues
   * Currently fixes: shared symlinks broken by Claude CLI's atomic writes
   */
  async fixIssues(): Promise<void> {
    console.log('');
    console.log(header('ATTEMPTING FIXES'));
    console.log('');

    let fixed = 0;

    // Fix shared symlinks (settings.json broken by Claude CLI toggle thinking, etc.)
    const sharedSettings = path.join(this.homedir, '.ccs', 'shared', 'settings.json');
    if (fs.existsSync(sharedSettings)) {
      try {
        const stats = fs.lstatSync(sharedSettings);
        if (!stats.isSymbolicLink()) {
          const spinner = ora('Fixing shared settings.json symlink').start();
          try {
            // Import and use SharedManager to fix symlinks
            const SharedManagerModule = await import('./shared-manager');
            const SharedManager = SharedManagerModule.default;
            const sharedManager = new SharedManager();
            sharedManager.ensureSharedDirectories();
            spinner.succeed(ok('Fixed') + ' Shared settings.json symlink restored');
            fixed++;
          } catch (err) {
            spinner.fail(fail('Failed') + ` Could not fix: ${(err as Error).message}`);
          }
        }
      } catch (_err) {
        // Ignore stat errors
      }
    }

    if (fixed > 0) {
      console.log('');
      console.log(ok(`[OK] Fixed ${fixed} issue(s)`));
    } else {
      console.log(info('[i] No fixable issues detected'));
    }
  }

  /**
   * Check if the health check results are healthy
   */
  isHealthy(): boolean {
    return this.results.isHealthy();
  }
}

export default Doctor;
