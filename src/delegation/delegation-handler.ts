#!/usr/bin/env node

import { HeadlessExecutor } from './headless-executor';
import { SessionManager } from './session-manager';
import { ResultFormatter } from './result-formatter';
import { DelegationValidator } from '../utils/delegation-validator';
import { SettingsParser } from './settings-parser';
import { startBackgroundMonitor } from './background-monitor';
import { fail, warn } from '../utils/ui';

/**
 * Parse and validate a string flag value
 * @returns value if valid, undefined if invalid/missing
 */
function parseStringFlag(
  args: string[],
  flagName: string,
  options?: { allowDashPrefix?: boolean }
): string | undefined {
  const index = args.indexOf(flagName);
  if (index === -1 || index >= args.length - 1) return undefined;

  const value = args[index + 1];

  // Reject dash-prefixed values (likely another flag)
  if (!options?.allowDashPrefix && value.startsWith('-')) {
    console.error(warn(`${flagName} value "${value}" looks like a flag. Ignoring.`));
    return undefined;
  }

  // Reject empty/whitespace-only
  if (!value.trim()) {
    console.error(warn(`${flagName} value is empty. Ignoring.`));
    return undefined;
  }

  return value;
}

interface ParsedArgs {
  profile: string;
  prompt: string;
  options: {
    cwd: string;
    outputFormat: string;
    permissionMode: string;
    timeout?: number;
    resumeSession?: boolean;
    sessionId?: string;
    // Claude Code CLI passthrough flags (explicit)
    maxTurns?: number;
    fallbackModel?: string;
    agents?: string;
    betas?: string;
    extraArgs?: string[]; // Catch-all for new/unknown flags
    // Background execution
    runInBackground?: boolean;
    enableMonitor?: boolean; // Enable background task monitoring
  };
}

/**
 * Delegation command handler
 * Routes -p flag commands to HeadlessExecutor with enhanced features
 */
export class DelegationHandler {
  /**
   * Route delegation command
   * @param args - Full args array from ccs.js
   */
  async route(args: string[]): Promise<void> {
    try {
      // 1. Parse args into { profile, prompt, options }
      const parsed = this._parseArgs(args);

      // 2. Detect special profiles (glm:continue, kimi:continue)
      if (parsed.profile.includes(':continue')) {
        return await this._handleContinue(parsed);
      }

      // 3. Validate profile
      this._validateProfile(parsed.profile);

      // 4. Execute via HeadlessExecutor
      const result = await HeadlessExecutor.execute(parsed.profile, parsed.prompt, parsed.options);

      // 5. If background task, start monitor and exit immediately
      if (result.isBackground && result.taskId && result.outputFile) {
        // Start background monitor if enabled (non-blocking)
        if (parsed.options.enableMonitor) {
          startBackgroundMonitor(result.taskId, result.outputFile, {
            silent: false,
            onComplete: () => {
              // Monitor will log completion info
            },
            onError: () => {
              // Monitor will log error info
            },
          });
        }

        // Display task info and exit immediately
        const formatted = await ResultFormatter.format(result);
        console.log(formatted);
        process.exit(0);
      }

      // 6. Format and display results (foreground execution)
      const formatted = await ResultFormatter.format(result);
      console.log(formatted);

      // 7. Exit with proper code
      process.exit(result.exitCode || 0);
    } catch (error) {
      console.error(fail(`Delegation error: ${(error as Error).message}`));
      if (process.env.CCS_DEBUG) {
        console.error((error as Error).stack);
      }
      process.exit(1);
    }
  }

  /**
   * Handle continue command (resume last session)
   * @param parsed - Parsed args
   */
  async _handleContinue(parsed: ParsedArgs): Promise<void> {
    const baseProfile = parsed.profile.replace(':continue', '');

    // Get last session from SessionManager
    const sessionMgr = new SessionManager();
    const lastSession = sessionMgr.getLastSession(baseProfile);

    if (!lastSession) {
      console.error(fail(`No previous session found for ${baseProfile}`));
      console.error(`    Start a new session first with: ccs ${baseProfile} "task"`);
      process.exit(1);
    }

    // Execute with resume flag
    const result = await HeadlessExecutor.execute(baseProfile, parsed.prompt, {
      ...parsed.options,
      resumeSession: true,
      sessionId: lastSession.sessionId,
    });

    const formatted = await ResultFormatter.format(result);
    console.log(formatted);

    process.exit(result.exitCode || 0);
  }

  /**
   * Parse args into structured format
   * @param args - Raw args
   * @returns { profile, prompt, options }
   */
  _parseArgs(args: string[]): ParsedArgs {
    // Extract profile (first non-flag arg or 'default')
    const profile = this._extractProfile(args);

    // Extract prompt (first non-flag arg after profile)
    const prompt = this._extractPrompt(args);

    // Extract options (--timeout, --permission-mode, etc.)
    const options = this._extractOptions(args);

    return { profile, prompt, options };
  }

  /**
   * Extract profile from args (first non-flag arg)
   * @param args - Args array
   * @returns profile name
   */
  _extractProfile(args: string[]): string {
    // Find first non-flag arg, skipping flag values (e.g. -p <value>)
    for (let i = 0; i < args.length; i++) {
      if (args[i].startsWith('-')) {
        // If flag doesn't embed its value (no '='), the next arg is the flag value — skip it
        if (!args[i].includes('=')) {
          i++; // skip flag value
        }
      } else {
        return args[i];
      }
    }

    // No profile specified, return empty string (will error in validation)
    return '';
  }

  /**
   * Extract prompt (second non-flag arg after profile)
   * @param args - Args array
   * @returns prompt text
   */
  _extractPrompt(args: string[]): string {
    // Find second non-flag arg (first is profile, second is prompt)
    let nonFlagCount = 0;
    for (let i = 0; i < args.length; i++) {
      if (!args[i].startsWith('-')) {
        nonFlagCount++;
        if (nonFlagCount === 2) {
          return args[i];
        }
      }
    }

    console.error(fail('Missing prompt'));
    console.error('    Usage: ccs <profile> "task description"');
    console.error('    Examples: ccs zhipu "写一个排序函数", ccs kimi "解释这段代码"');
    process.exit(1);
  }

  /**
   * Extract options from remaining args
   * @param args - Args array
   * @returns options for HeadlessExecutor
   */
  _extractOptions(args: string[]): ParsedArgs['options'] {
    const cwd = process.cwd();

    // Read default permission mode from .claude/settings.local.json
    // Falls back to 'acceptEdits' if file doesn't exist
    const defaultPermissionMode = SettingsParser.parseDefaultPermissionMode(cwd);

    const options: ParsedArgs['options'] = {
      cwd,
      outputFormat: 'stream-json',
      permissionMode: defaultPermissionMode,
    };

    // Parse permission-mode (CLI flag overrides settings file)
    const permModeIndex = args.indexOf('--permission-mode');
    if (permModeIndex !== -1 && permModeIndex < args.length - 1) {
      options.permissionMode = args[permModeIndex + 1];
    }

    // Parse timeout (validated: positive integer, max 10 minutes)
    const timeoutIndex = args.indexOf('--timeout');
    if (timeoutIndex !== -1 && timeoutIndex < args.length - 1) {
      const rawVal = args[timeoutIndex + 1];
      const val = parseInt(rawVal, 10);
      if (!isNaN(val) && val > 0 && val <= 600000) {
        options.timeout = val;
      } else if (isNaN(val)) {
        console.error(warn(`--timeout "${rawVal}" is not a number. Using default.`));
      } else if (val <= 0) {
        console.error(warn(`--timeout ${val} must be positive. Using default.`));
      } else if (val > 600000) {
        console.error(warn(`--timeout ${val} exceeds max (600000ms). Using default.`));
      }
    }

    // Parse --max-turns (limit agentic turns, max 100)
    const maxTurnsIndex = args.indexOf('--max-turns');
    if (maxTurnsIndex !== -1 && maxTurnsIndex < args.length - 1) {
      const rawVal = args[maxTurnsIndex + 1];
      const val = parseInt(rawVal, 10);
      if (!isNaN(val) && val > 0 && val <= 100) {
        options.maxTurns = val;
      } else if (isNaN(val)) {
        console.error(warn(`--max-turns "${rawVal}" is not a number. Ignoring.`));
      } else if (val <= 0) {
        console.error(warn(`--max-turns ${val} must be positive. Ignoring.`));
      } else if (val > 100) {
        console.error(warn(`--max-turns ${val} exceeds max (100). Using 100.`));
        options.maxTurns = 100;
      }
    }

    // Parse --fallback-model (auto-fallback on overload)
    options.fallbackModel = parseStringFlag(args, '--fallback-model');

    // Parse --agents (dynamic subagent JSON)
    const agentsValue = parseStringFlag(args, '--agents');
    if (agentsValue) {
      // Validate JSON structure
      try {
        JSON.parse(agentsValue);
        options.agents = agentsValue;
      } catch {
        console.error(warn('--agents must be valid JSON. Ignoring.'));
      }
    }

    // Parse --betas (experimental features)
    options.betas = parseStringFlag(args, '--betas');

    // Default: run in background
    // Use --wait / -w to run in foreground (blocking)
    options.runInBackground = !(args.includes('--wait') || args.includes('-w'));

    // Enable background monitoring (default: true for background tasks)
    // Use --no-monitor to disable monitoring
    options.enableMonitor = !args.includes('--no-monitor');

    // Collect extra args to pass through to Claude CLI
    // CCS-handled flags with values (skip these and their values):
    const ccsFlagsWithValue = new Set([
      '--timeout',
      '--permission-mode',
      '--max-turns',
      '--fallback-model',
      '--agents',
      '--betas',
    ]);
    // CCS-handled flags without values (skip these):
    const ccsFlagsNoValue = new Set(['--wait', '-w', '--no-monitor']);
    const extraArgs: string[] = [];
    const profile = this._extractProfile(args);
    const prompt = this._extractPrompt(args);

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      // Skip profile name and prompt (first two non-flag args)
      if (arg === profile || arg === prompt) continue;

      // Skip CCS-handled flags and their values
      if (ccsFlagsWithValue.has(arg)) {
        i++; // Skip next arg (the value)
        continue;
      }

      // Skip CCS-handled flags without values
      if (ccsFlagsNoValue.has(arg)) {
        continue;
      }

      // Collect flags and their values as passthrough
      if (arg.startsWith('-')) {
        extraArgs.push(arg);
        // If next arg exists and doesn't start with '-', it's likely a value
        if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
          extraArgs.push(args[i + 1]);
          i++; // Skip the value we just added
        }
      }
    }

    if (extraArgs.length > 0) {
      options.extraArgs = extraArgs;
    }

    return options;
  }

  /**
   * Validate profile exists and is configured
   * @param profile - Profile name
   */
  _validateProfile(profile: string): void {
    if (!profile) {
      console.error(fail('No profile specified'));
      console.error('    Usage: ccs <profile> "task"');
      console.error('    Examples: ccs zhipu "写一个排序函数", ccs kimi "解释这段代码"');
      process.exit(1);
    }

    // Use DelegationValidator to check profile
    const validation = DelegationValidator.validate(profile);
    if (!validation.valid) {
      console.error(fail(`Profile '${profile}' is not configured for delegation`));
      console.error(`    ${validation.error}`);
      console.error('');
      console.error('    Run: ccs doctor');
      console.error(`    Or configure: ~/.ccs/${profile}.settings.json`);
      process.exit(1);
    }
  }
}
