/**
 * Auth Commands (Simplified)
 *
 * CLI interface for CCS multi-account management.
 * Commands: create, list, show, remove, default
 *
 * Login-per-profile model: Each profile is an isolated Claude instance.
 * Users login directly in each instance (no credential copying).
 *
 * Supports dual-mode configuration:
 * - Unified YAML format (config.yaml) when CCS_UNIFIED_CONFIG=1 or config.yaml exists
 * - Legacy JSON format (profiles.json) as fallback
 */

import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import ProfileRegistry from './profile-registry';
import { ProfileMetadata } from '../types';
import { InstanceManager } from '../management/instance-manager';
import {
  initUI,
  header,
  subheader,
  color,
  dim,
  ok,
  fail,
  warn,
  info,
  table,
  infoBox,
  warnBox,
} from '../utils/ui';
import { getClaudeCliInfo } from '../utils/claude-detector';
import { escapeShellArg } from '../utils/shell-executor';
import { InteractivePrompt } from '../utils/prompt';
import packageJson from '../../package.json';
import { hasUnifiedConfig } from '../config/unified-config-loader';
import { isUnifiedConfigEnabled } from '../config/feature-flags';

interface AuthCommandArgs {
  profileName?: string;
  force?: boolean;
  verbose?: boolean;
  json?: boolean;
  yes?: boolean;
}

interface ProfileOutput {
  name: string;
  type: string;
  is_default: boolean;
  created: string;
  last_used: string | null;
  instance_path?: string;
  session_count?: number;
}

interface ListOutput {
  version: string;
  profiles: ProfileOutput[];
}

/**
 * Auth Commands Class
 */
class AuthCommands {
  private registry: ProfileRegistry;
  private instanceMgr: InstanceManager;
  private readonly version: string = packageJson.version;

  constructor() {
    this.registry = new ProfileRegistry();
    this.instanceMgr = new InstanceManager();
  }

  /**
   * Check if unified config mode is active
   */
  private isUnifiedMode(): boolean {
    return hasUnifiedConfig() || isUnifiedConfigEnabled();
  }

  /**
   * Show help for auth commands
   */
  async showHelp(): Promise<void> {
    await initUI();

    console.log(header('CCS Concurrent Account Management'));
    console.log('');
    console.log(subheader('Usage'));
    console.log(`  ${color('ccs auth', 'command')} <command> [options]`);
    console.log('');
    console.log(subheader('Commands'));
    console.log(`  ${color('create <profile>', 'command')}        Create new profile and login`);
    console.log(`  ${color('list', 'command')}                   List all saved profiles`);
    console.log(`  ${color('show <profile>', 'command')}         Show profile details`);
    console.log(`  ${color('remove <profile>', 'command')}       Remove saved profile`);
    console.log(`  ${color('default <profile>', 'command')}      Set default profile`);
    console.log(
      `  ${color('reset-default', 'command')}          Clear default (restore original CCS)`
    );
    console.log('');
    console.log(subheader('Examples'));
    console.log(`  ${dim('# Create & login to work profile')}`);
    console.log(`  ${color('ccs auth create work', 'command')}`);
    console.log('');
    console.log(`  ${dim('# Set work as default')}`);
    console.log(`  ${color('ccs auth default work', 'command')}`);
    console.log('');
    console.log(`  ${dim('# Restore original CCS behavior')}`);
    console.log(`  ${color('ccs auth reset-default', 'command')}`);
    console.log('');
    console.log(`  ${dim('# List all profiles')}`);
    console.log(`  ${color('ccs auth list', 'command')}`);
    console.log('');
    console.log(`  ${dim('# Use work profile')}`);
    console.log(`  ${color('ccs work "review code"', 'command')}`);
    console.log('');
    console.log(subheader('Options'));
    console.log(
      `  ${color('--force', 'command')}                   Allow overwriting existing profile (create)`
    );
    console.log(
      `  ${color('--yes, -y', 'command')}                 Skip confirmation prompts (remove)`
    );
    console.log(
      `  ${color('--json', 'command')}                    Output in JSON format (list, show)`
    );
    console.log(
      `  ${color('--verbose', 'command')}                 Show additional details (list)`
    );
    console.log('');
    console.log(subheader('Note'));
    console.log(
      `  By default, ${color('ccs', 'command')} uses Claude CLI defaults from ~/.claude/`
    );
    console.log(
      `  Use ${color('ccs auth default <profile>', 'command')} to change the default profile.`
    );
    console.log('');
  }

  /**
   * Parse command arguments
   */
  private parseArgs(args: string[]): AuthCommandArgs {
    const profileName = args.find((arg) => !arg.startsWith('--'));
    return {
      profileName,
      force: args.includes('--force'),
      verbose: args.includes('--verbose'),
      json: args.includes('--json'),
      yes: args.includes('--yes') || args.includes('-y'),
    };
  }

  /**
   * Create new profile and prompt for login
   */
  async handleCreate(args: string[]): Promise<void> {
    await initUI();
    const { profileName, force } = this.parseArgs(args);

    if (!profileName) {
      console.log(fail('Profile name is required'));
      console.log('');
      console.log(`Usage: ${color('ccs auth create <profile> [--force]', 'command')}`);
      console.log('');
      console.log('Example:');
      console.log(`  ${color('ccs auth create work', 'command')}`);
      process.exit(1);
    }

    // Check if profile already exists (check both legacy and unified)
    const existsLegacy = this.registry.hasProfile(profileName);
    const existsUnified = this.registry.hasAccountUnified(profileName);
    if (!force && (existsLegacy || existsUnified)) {
      console.log(fail(`Profile already exists: ${profileName}`));
      console.log(`    Use ${color('--force', 'command')} to overwrite`);
      process.exit(1);
    }

    try {
      // Create instance directory
      console.log(info(`Creating profile: ${profileName}`));
      const instancePath = this.instanceMgr.ensureInstance(profileName);

      // Create/update profile entry based on config mode
      if (this.isUnifiedMode()) {
        // Use unified config (config.yaml)
        if (existsUnified) {
          this.registry.touchAccountUnified(profileName);
        } else {
          this.registry.createAccountUnified(profileName);
        }
      } else {
        // Use legacy profiles.json
        if (existsLegacy) {
          this.registry.updateProfile(profileName, {
            type: 'account',
          });
        } else {
          this.registry.createProfile(profileName, {
            type: 'account',
          });
        }
      }

      console.log(info(`Instance directory: ${instancePath}`));
      console.log('');
      console.log(warn('Starting Claude in isolated instance...'));
      console.log(warn('You will be prompted to login with your account.'));
      console.log('');

      // Detect Claude CLI
      const claudeInfo = getClaudeCliInfo();
      if (!claudeInfo) {
        console.log(fail('Claude CLI not found'));
        console.log('');
        console.log('Please install Claude CLI first:');
        console.log(`  ${color('https://claude.ai/download', 'path')}`);
        process.exit(1);
      }

      const { path: claudeCli, needsShell } = claudeInfo;

      // Execute Claude in isolated instance (will auto-prompt for login if no credentials)
      // On Windows, .cmd/.bat/.ps1 files need shell: true to execute properly
      let child: ChildProcess;
      if (needsShell) {
        const cmdString = escapeShellArg(claudeCli);
        child = spawn(cmdString, {
          stdio: 'inherit',
          windowsHide: true,
          shell: true,
          env: { ...process.env, CLAUDE_CONFIG_DIR: instancePath },
        });
      } else {
        child = spawn(claudeCli, [], {
          stdio: 'inherit',
          windowsHide: true,
          env: { ...process.env, CLAUDE_CONFIG_DIR: instancePath },
        });
      }

      child.on('exit', (code: number | null) => {
        if (code === 0) {
          console.log('');
          console.log(
            infoBox(
              `Profile:  ${profileName}\n` + `Instance: ${instancePath}\n` + `Type:     account`,
              'Profile Created'
            )
          );
          console.log('');
          console.log(header('Usage'));
          console.log(`  ${color(`ccs ${profileName} "your prompt here"`, 'command')}`);
          console.log('');
          console.log(
            warnBox(
              `Running the command below will SWITCH your default\n` +
                `CCS account to "${profileName}". After this, running\n` +
                `"ccs" without a profile name will use this account.\n\n` +
                `  ${color(`ccs auth default ${profileName}`, 'command')}\n\n` +
                `To restore the original default, run:\n` +
                `  ${color('ccs auth reset-default', 'command')}`,
              'Set as Default?'
            )
          );
          console.log('');
          process.exit(0);
        } else {
          console.log('');
          console.log(fail('Login failed or cancelled'));
          console.log('');
          console.log('To retry:');
          console.log(`  ${color(`ccs auth create ${profileName} --force`, 'command')}`);
          console.log('');
          process.exit(1);
        }
      });

      child.on('error', (err: Error) => {
        console.log(fail(`Failed to execute Claude CLI: ${err.message}`));
        process.exit(1);
      });
    } catch (error) {
      console.log(fail(`Failed to create profile: ${(error as Error).message}`));
      process.exit(1);
    }
  }

  /**
   * Format relative time (e.g., "2h ago", "1d ago")
   */
  private formatRelativeTime(date: Date): string {
    const now = Date.now();
    const diff = now - date.getTime();

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'just now';
  }

  /**
   * List all saved profiles
   */
  async handleList(args: string[]): Promise<void> {
    await initUI();
    const { verbose, json } = this.parseArgs(args);

    try {
      // Get profiles from both legacy (profiles.json) and unified config (config.yaml)
      const legacyProfiles = this.registry.getAllProfiles();
      const unifiedAccounts = this.registry.getAllAccountsUnified();

      // Merge profiles: unified config takes precedence
      const profiles: Record<string, ProfileMetadata> = { ...legacyProfiles };
      for (const [name, account] of Object.entries(unifiedAccounts)) {
        profiles[name] = {
          type: 'account',
          created: account.created,
          last_used: account.last_used,
        };
      }

      const defaultProfile = this.registry.getDefaultUnified() ?? this.registry.getDefaultProfile();
      const profileNames = Object.keys(profiles);

      // JSON output mode
      if (json) {
        const output: ListOutput = {
          version: this.version,
          profiles: profileNames.map((name) => {
            const profile = profiles[name];
            const isDefault = name === defaultProfile;
            const instancePath = this.instanceMgr.getInstancePath(name);

            return {
              name: name,
              type: profile.type || 'account',
              is_default: isDefault,
              created: profile.created,
              last_used: profile.last_used || null,
              instance_path: instancePath,
            };
          }),
        };
        console.log(JSON.stringify(output, null, 2));
        return;
      }

      // Human-readable output
      if (profileNames.length === 0) {
        console.log(warn('No account profiles found'));
        console.log('');
        console.log('To create your first profile:');
        console.log(`  ${color('ccs auth create <profile>', 'command')}`);
        console.log('');
        console.log('Example:');
        console.log(`  ${color('ccs auth create work', 'command')}`);
        console.log('');
        return;
      }

      console.log(header('Saved Account Profiles'));
      console.log('');

      // Sort by last_used (descending), then alphabetically
      const sorted = profileNames.sort((a, b) => {
        const aProfile = profiles[a];
        const bProfile = profiles[b];

        // Default first
        if (a === defaultProfile) return -1;
        if (b === defaultProfile) return 1;

        // Then by last_used
        if (aProfile.last_used && bProfile.last_used) {
          return new Date(bProfile.last_used).getTime() - new Date(aProfile.last_used).getTime();
        }
        if (aProfile.last_used) return -1;
        if (bProfile.last_used) return 1;

        // Then alphabetically
        return a.localeCompare(b);
      });

      // Build table rows
      const rows: string[][] = sorted.map((name) => {
        const profile = profiles[name];
        const isDefault = name === defaultProfile;

        // Status column
        const status = isDefault ? color('[OK] default', 'success') : color('[OK]', 'success');

        // Last used column
        let lastUsed = '-';
        if (profile.last_used) {
          lastUsed = this.formatRelativeTime(new Date(profile.last_used));
        }

        const row = [
          color(name, isDefault ? 'primary' : 'info'),
          profile.type || 'account',
          status,
        ];

        if (verbose) {
          row.push(lastUsed);
        }

        return row;
      });

      // Headers
      const headers = verbose
        ? ['Profile', 'Type', 'Status', 'Last Used']
        : ['Profile', 'Type', 'Status'];

      // Print table
      console.log(
        table(rows, {
          head: headers,
          colWidths: verbose ? [15, 12, 15, 12] : [15, 12, 15],
        })
      );
      console.log('');
      console.log(dim(`Total: ${profileNames.length} profile(s)`));
      console.log('');
    } catch (error) {
      console.log(fail(`Failed to list profiles: ${(error as Error).message}`));
      process.exit(1);
    }
  }

  /**
   * Show details for a specific profile
   */
  async handleShow(args: string[]): Promise<void> {
    await initUI();
    const { profileName, json } = this.parseArgs(args);

    if (!profileName) {
      console.log(fail('Profile name is required'));
      console.log('');
      console.log(`Usage: ${color('ccs auth show <profile> [--json]', 'command')}`);
      process.exit(1);
    }

    try {
      const profile = this.registry.getProfile(profileName);
      const defaultProfile = this.registry.getDefaultProfile();
      const isDefault = profileName === defaultProfile;
      const instancePath = this.instanceMgr.getInstancePath(profileName);

      // Count sessions
      let sessionCount = 0;
      try {
        const sessionsDir = path.join(instancePath, 'session-env');
        if (fs.existsSync(sessionsDir)) {
          const files = fs.readdirSync(sessionsDir);
          sessionCount = files.filter((f) => f.endsWith('.json')).length;
        }
      } catch (_e) {
        // Ignore errors counting sessions
      }

      // JSON output mode
      if (json) {
        const output: ProfileOutput = {
          name: profileName,
          type: profile.type || 'account',
          is_default: isDefault,
          created: profile.created,
          last_used: profile.last_used || null,
          instance_path: instancePath,
          session_count: sessionCount,
        };
        console.log(JSON.stringify(output, null, 2));
        return;
      }

      // Human-readable output
      const defaultBadge = isDefault ? color(' (default)', 'success') : '';
      console.log(header(`Profile: ${profileName}${defaultBadge}`));
      console.log('');

      // Details table
      const details = [
        ['Type', profile.type || 'account'],
        ['Instance', instancePath],
        ['Created', new Date(profile.created).toLocaleString()],
        ['Last Used', profile.last_used ? new Date(profile.last_used).toLocaleString() : 'Never'],
        ['Sessions', `${sessionCount}`],
      ];

      console.log(
        table(details, {
          colWidths: [15, 45],
        })
      );
      console.log('');
    } catch (error) {
      console.log(fail((error as Error).message));
      process.exit(1);
    }
  }

  /**
   * Remove a saved profile
   */
  async handleRemove(args: string[]): Promise<void> {
    await initUI();
    const { profileName, yes } = this.parseArgs(args);

    if (!profileName) {
      console.log(fail('Profile name is required'));
      console.log('');
      console.log(`Usage: ${color('ccs auth remove <profile> [--yes]', 'command')}`);
      process.exit(1);
    }

    // Check existence in both legacy and unified
    const existsLegacy = this.registry.hasProfile(profileName);
    const existsUnified = this.registry.hasAccountUnified(profileName);

    if (!existsLegacy && !existsUnified) {
      console.log(fail(`Profile not found: ${profileName}`));
      process.exit(1);
    }

    try {
      // Get instance path and session count for impact display
      const instancePath = this.instanceMgr.getInstancePath(profileName);
      let sessionCount = 0;

      try {
        const sessionsDir = path.join(instancePath, 'session-env');
        if (fs.existsSync(sessionsDir)) {
          const files = fs.readdirSync(sessionsDir);
          sessionCount = files.filter((f) => f.endsWith('.json')).length;
        }
      } catch (_e) {
        // Ignore errors counting sessions
      }

      // Display impact
      console.log('');
      console.log(`Profile '${color(profileName, 'command')}' will be permanently deleted.`);
      console.log(`  Instance path: ${instancePath}`);
      console.log(`  Sessions: ${sessionCount} conversation${sessionCount !== 1 ? 's' : ''}`);
      console.log('');

      // Interactive confirmation (or --yes flag)
      const confirmed =
        yes ||
        (await InteractivePrompt.confirm(
          'Delete this profile?',
          { default: false } // Default to NO (safe)
        ));

      if (!confirmed) {
        console.log(info('Cancelled'));
        process.exit(0);
      }

      // Delete instance
      this.instanceMgr.deleteInstance(profileName);

      // Delete profile from appropriate config
      if (this.isUnifiedMode() && existsUnified) {
        this.registry.removeAccountUnified(profileName);
      }
      if (existsLegacy) {
        this.registry.deleteProfile(profileName);
      }

      console.log(ok(`Profile removed: ${profileName}`));
      console.log('');
    } catch (error) {
      console.log(fail(`Failed to remove profile: ${(error as Error).message}`));
      process.exit(1);
    }
  }

  /**
   * Set default profile
   */
  async handleDefault(args: string[]): Promise<void> {
    await initUI();
    const { profileName } = this.parseArgs(args);

    if (!profileName) {
      console.log(fail('Profile name is required'));
      console.log('');
      console.log(`Usage: ${color('ccs auth default <profile>', 'command')}`);
      process.exit(1);
    }

    try {
      // Use unified or legacy based on config mode
      if (this.isUnifiedMode()) {
        this.registry.setDefaultUnified(profileName);
      } else {
        this.registry.setDefaultProfile(profileName);
      }

      console.log(ok(`Default profile set: ${profileName}`));
      console.log('');
      console.log('Now you can use:');
      console.log(
        `  ${color('ccs "your prompt"', 'command')}  ${dim(`# Uses ${profileName} profile`)}`
      );
      console.log('');
    } catch (error) {
      console.log(fail((error as Error).message));
      process.exit(1);
    }
  }

  /**
   * Reset default profile (clear the custom default, restore original CCS behavior)
   */
  async handleResetDefault(): Promise<void> {
    await initUI();

    try {
      // Use unified or legacy based on config mode
      if (this.isUnifiedMode()) {
        this.registry.clearDefaultUnified();
      } else {
        this.registry.clearDefaultProfile();
      }

      console.log(ok('Default profile cleared'));
      console.log('');
      console.log('CCS will now use the original behavior:');
      console.log(`  ${dim('# Uses your primary Claude account')}`);
      console.log(`  ${color('ccs "your prompt"', 'command')}`);
      console.log('');
    } catch (error) {
      console.log(fail((error as Error).message));
      process.exit(1);
    }
  }

  /**
   * Route auth command to appropriate handler
   */
  async route(args: string[]): Promise<void> {
    if (args.length === 0 || args[0] === '--help' || args[0] === '-h' || args[0] === 'help') {
      await this.showHelp();
      return;
    }

    const command = args[0];
    const commandArgs = args.slice(1);

    switch (command) {
      case 'create':
        await this.handleCreate(commandArgs);
        break;

      case 'save':
        // Deprecated - redirect to create
        await initUI();
        console.log(warn('Command "save" is deprecated'));
        console.log(`    Use: ${color('ccs auth create <profile>', 'command')} instead`);
        console.log('');
        await this.handleCreate(commandArgs);
        break;

      case 'list':
        await this.handleList(commandArgs);
        break;

      case 'show':
        await this.handleShow(commandArgs);
        break;

      case 'remove':
        await this.handleRemove(commandArgs);
        break;

      case 'default':
        await this.handleDefault(commandArgs);
        break;

      case 'reset-default':
        await this.handleResetDefault();
        break;

      case 'current':
        await initUI();
        console.log(warn('Command "current" has been removed'));
        console.log('');
        console.log('Each profile has its own login in an isolated instance.');
        console.log(`Use ${color('ccs auth list', 'command')} to see all profiles.`);
        console.log('');
        break;

      case 'cleanup':
        await initUI();
        console.log(warn('Command "cleanup" has been removed'));
        console.log('');
        console.log('No cleanup needed - no separate vault files.');
        console.log(`Use ${color('ccs auth list', 'command')} to see all profiles.`);
        console.log('');
        break;

      default:
        await initUI();
        console.log(fail(`Unknown command: ${command}`));
        console.log('');
        console.log('Run for help:');
        console.log(`  ${color('ccs auth --help', 'command')}`);
        process.exit(1);
    }
  }
}

export default AuthCommands;
