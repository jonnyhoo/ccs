#!/usr/bin/env node

/**
 * Formats delegation execution results for display
 * Creates styled box output with file change tracking
 */

import * as path from 'path';
import { execSync } from 'child_process';
import * as fs from 'fs';
import { ui } from '../utils/ui';
import { getModelDisplayName } from '../utils/config-manager';
import type { ExecutionResult, ExecutionError, PermissionDenial } from './executor/types';

// Alias for backward compatibility
type ErrorInfo = ExecutionError;

interface FileChanges {
  created: string[];
  modified: string[];
}

/**
 * Result Formatter Class
 */
class ResultFormatter {
  /**
   * Format execution result with complete source-of-truth
   */
  static async format(result: ExecutionResult): Promise<string> {
    await ui.init();

    const {
      profile,
      stdout,
      stderr,
      success,
      content,
      subtype,
      permissionDenials,
      errors,
      timedOut,
    } = result;

    // Handle timeout (graceful termination)
    if (timedOut) {
      return this.formatTimeoutError(result);
    }

    // Handle legacy max_turns error (Claude CLI might still return this)
    if (subtype === 'error_max_turns') {
      return this.formatTimeoutError(result);
    }

    // Use content field for output (JSON result or fallback stdout)
    const displayOutput = content || stdout;

    // Build formatted output
    let output = '';

    // Header box
    const modelName = getModelDisplayName(profile);
    const headerIcon = success ? '[i]' : '[X]';
    output += ui.box(`${headerIcon} Delegated to ${modelName} (ccs:${profile})`, {
      borderStyle: 'round',
      padding: 0,
    });
    output += '\n\n';

    // Info table
    output += this.formatInfoTable(result);
    output += '\n';

    // Task output
    if (displayOutput?.trim()) {
      output += displayOutput.trim() + '\n';
    } else {
      output += ui.info('No output from delegated task') + '\n';
    }

    // Permission denials if present
    if (permissionDenials && permissionDenials.length > 0) {
      output += '\n';
      output += this.formatPermissionDenials(permissionDenials);
    }

    // Errors if present
    if (errors && errors.length > 0) {
      output += '\n';
      output += this.formatErrors(errors);
    }

    // Stderr if present
    if (stderr && stderr.trim()) {
      output += '\n';
      output += ui.warn('Stderr:') + '\n';
      output += stderr.trim() + '\n';
    }

    // Footer
    output += '\n';
    output += success ? ui.ok('Delegation completed') : ui.fail('Delegation failed');
    output += '\n';

    return output;
  }

  /**
   * Extract file changes from output
   */
  static extractFileChanges(output: string, cwd: string): FileChanges {
    const created: string[] = [];
    const modified: string[] = [];

    // Patterns to match file operations (case-insensitive)
    const createdPatterns = [
      /created:\s*([^\n\r]+)/gi,
      /create:\s*([^\n\r]+)/gi,
      /wrote:\s*([^\n\r]+)/gi,
      /write:\s*([^\n\r]+)/gi,
      /new file:\s*([^\n\r]+)/gi,
      /generated:\s*([^\n\r]+)/gi,
      /added:\s*([^\n\r]+)/gi,
    ];

    const modifiedPatterns = [
      /modified:\s*([^\n\r]+)/gi,
      /update:\s*([^\n\r]+)/gi,
      /updated:\s*([^\n\r]+)/gi,
      /edit:\s*([^\n\r]+)/gi,
      /edited:\s*([^\n\r]+)/gi,
      /changed:\s*([^\n\r]+)/gi,
    ];

    // Helper to check if file is infrastructure (should be ignored)
    const isInfrastructure = (filePath: string): boolean => {
      return filePath.includes('/.claude/') || filePath.startsWith('.claude/');
    };

    // Extract created files
    for (const pattern of createdPatterns) {
      let match;
      while ((match = pattern.exec(output)) !== null) {
        const filePath = match[1].trim();
        if (filePath && !created.includes(filePath) && !isInfrastructure(filePath)) {
          created.push(filePath);
        }
      }
    }

    // Extract modified files
    for (const pattern of modifiedPatterns) {
      let match;
      while ((match = pattern.exec(output)) !== null) {
        const filePath = match[1].trim();
        // Don't include if already in created list or is infrastructure
        if (
          filePath &&
          !modified.includes(filePath) &&
          !created.includes(filePath) &&
          !isInfrastructure(filePath)
        ) {
          modified.push(filePath);
        }
      }
    }

    // Fallback: Scan filesystem for recently modified files (last 5 minutes)
    if (created.length === 0 && modified.length === 0 && cwd) {
      try {
        // Use find command to get recently modified files (excluding infrastructure)
        const findCmd = `find . -type f -mmin -5 -not -path "./.git/*" -not -path "./node_modules/*" -not -path "./.claude/*" 2>/dev/null | head -20`;
        const result = execSync(findCmd, { cwd, encoding: 'utf8', timeout: 5000 });

        const files = result.split('\n').filter((f) => f.trim());
        files.forEach((file) => {
          const fullPath = path.join(cwd, file);

          // Double-check not infrastructure
          if (isInfrastructure(fullPath)) {
            return;
          }

          try {
            const stats = fs.statSync(fullPath);
            const now = Date.now();
            const mtime = stats.mtimeMs;
            const ctime = stats.ctimeMs;

            // If both mtime and ctime are very recent (within 10 minutes), likely created
            // ctime = inode change time, for new files this is close to creation time
            const isVeryRecent = now - mtime < 600000 && now - ctime < 600000;
            const timeDiff = Math.abs(mtime - ctime);

            // If mtime and ctime are very close (< 1 second apart) and both recent, it's created
            if (isVeryRecent && timeDiff < 1000) {
              if (!created.includes(fullPath)) {
                created.push(fullPath);
              }
            } else {
              // Otherwise, it's modified
              if (!modified.includes(fullPath)) {
                modified.push(fullPath);
              }
            }
          } catch (_statError) {
            // If stat fails, default to created (since we're in fallback mode)
            if (!created.includes(fullPath) && !modified.includes(fullPath)) {
              created.push(fullPath);
            }
          }
        });
      } catch (scanError) {
        // Silently fail if filesystem scan doesn't work
        if (process.env.CCS_DEBUG) {
          console.error(`[!] Filesystem scan failed: ${(scanError as Error).message}`);
        }
      }
    }

    return { created, modified };
  }

  /**
   * Format info as table
   */
  private static formatInfoTable(result: ExecutionResult): string {
    const { cwd, profile, duration, exitCode, sessionId, totalCost, numTurns } = result;
    const modelName = getModelDisplayName(profile);
    const durationSec = (duration / 1000).toFixed(1);

    const rows: string[][] = [
      ['Working Dir', this.truncate(cwd, 40)],
      ['Model', modelName],
      ['Duration', `${durationSec}s`],
      ['Exit Code', `${exitCode}`],
    ];

    if (sessionId) {
      const shortId = sessionId.length > 8 ? sessionId.substring(0, 8) : sessionId;
      rows.push(['Session', shortId]);
    }

    if (totalCost !== undefined && totalCost !== null) {
      rows.push(['Cost', `$${totalCost.toFixed(4)}`]);
    }

    if (numTurns) {
      rows.push(['Turns', `${numTurns}`]);
    }

    return ui.table(rows, {
      colWidths: [15, 45],
    });
  }

  /**
   * Truncate string to max length
   */
  private static truncate(str: string, maxLength: number): string {
    if (str.length <= maxLength) {
      return str;
    }
    return str.substring(0, maxLength - 3) + '...';
  }

  /**
   * Format minimal result (for quick tasks)
   */
  static async formatMinimal(result: ExecutionResult): Promise<string> {
    await ui.init();
    const { profile, success, duration } = result;
    const modelName = getModelDisplayName(profile);
    const icon = success ? ui.ok('') : ui.fail('');
    const durationSec = (duration / 1000).toFixed(1);

    return `${icon} ${modelName} delegation ${success ? 'completed' : 'failed'} (${durationSec}s)\n`;
  }

  /**
   * Format verbose result (with full details)
   */
  static async formatVerbose(result: ExecutionResult): Promise<string> {
    const basic = await this.format(result);

    // Add additional debug info
    let verbose = basic;
    verbose += '\n=== Debug Information ===\n';
    verbose += `CWD: ${result.cwd}\n`;
    verbose += `Profile: ${result.profile}\n`;
    verbose += `Exit Code: ${result.exitCode}\n`;
    verbose += `Duration: ${result.duration}ms\n`;
    verbose += `Success: ${result.success}\n`;
    verbose += `Stdout Length: ${result.stdout.length} chars\n`;
    verbose += `Stderr Length: ${result.stderr.length} chars\n`;

    return verbose;
  }

  /**
   * Check if NO_COLOR environment variable is set - Currently unused
   */
  /*
  private static shouldDisableColors(): boolean {
    return process.env.NO_COLOR !== undefined;
  }
  */

  /**
   * Format timeout error (session exceeded time limit)
   */
  private static async formatTimeoutError(result: ExecutionResult): Promise<string> {
    await ui.init();

    const { profile, duration, sessionId, totalCost, permissionDenials } = result;
    const modelName = getModelDisplayName(profile);
    const timeoutMin = (duration / 60000).toFixed(1);

    let output = '';

    // Error header
    output += ui.errorBox(
      `Execution Timeout\n\n` +
        `Delegation to ${modelName} exceeded time limit.\n` +
        `Session was gracefully terminated after ${timeoutMin} minutes.`,
      'TIMEOUT'
    );
    output += '\n';

    // Info table
    output += this.formatInfoTable(result);
    output += '\n';

    // Permission denials
    if (permissionDenials && permissionDenials.length > 0) {
      output += ui.warn('Permission denials may have caused delays:') + '\n';
      output += this.formatPermissionDenials(permissionDenials);
      output += '\n';
    }

    // Suggestions
    output += ui.header('SUGGESTIONS') + '\n';
    output += `  Continue session:\n`;
    output += `    ${ui.color(`ccs ${profile}:continue "finish the task"`, 'command')}\n\n`;
    output += `  Increase timeout:\n`;
    output += `    ${ui.color(`ccs ${profile} --timeout ${Math.round((duration * 2) / 1000)}`, 'command')}\n\n`;
    output += `  Break into smaller tasks\n\n`;

    // Session info
    if (sessionId) {
      const shortId = sessionId.length > 8 ? sessionId.substring(0, 8) : sessionId;
      output += ui.dim(`Session persisted: ${shortId}`) + '\n';
    }
    if (totalCost !== undefined && totalCost !== null) {
      output += ui.dim(`Cost: $${totalCost.toFixed(4)}`) + '\n';
    }

    return output;
  }

  /**
   * Format permission denials
   */
  private static formatPermissionDenials(denials: PermissionDenial[]): string {
    let output = ui.warn('Permission Denials:') + '\n';

    for (const denial of denials) {
      const tool = denial.tool_name || 'Unknown';
      const input = denial.tool_input || {};
      const cmd = input.command || input.description || JSON.stringify(input);
      output += `  - ${tool}: ${this.truncate(cmd, 50)}\n`;
    }

    return output;
  }

  /**
   * Format errors array
   */
  private static formatErrors(errors: ErrorInfo[]): string {
    let output = ui.fail('Errors:') + '\n';

    for (const error of errors) {
      const msg = error.message || error.error || JSON.stringify(error);
      output += `  - ${msg}\n`;
    }

    return output;
  }
}

export { ResultFormatter };
