#!/usr/bin/env node

/**
 * Formats delegation execution results for display
 * Creates styled box output
 */

import { ui } from '../utils/ui';
import { getModelDisplayName } from '../utils/config-manager';
import type { ExecutionResult, ExecutionError, PermissionDenial } from './executor/types';

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
    if (timedOut || subtype === 'error_max_turns') {
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

  private static truncate(str: string, maxLength: number): string {
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength - 3) + '...';
  }

  /**
   * Format timeout error (session exceeded time limit)
   */
  private static async formatTimeoutError(result: ExecutionResult): Promise<string> {
    await ui.init();

    const { profile, duration, sessionId, totalCost, permissionDenials } = result;
    const modelName = getModelDisplayName(profile);
    const timeoutMin = (duration / 60000).toFixed(1);

    let output = '';

    output += ui.errorBox(
      `Execution Timeout\n\n` +
        `Delegation to ${modelName} exceeded time limit.\n` +
        `Session was gracefully terminated after ${timeoutMin} minutes.`,
      'TIMEOUT'
    );
    output += '\n';

    output += this.formatInfoTable(result);
    output += '\n';

    if (permissionDenials && permissionDenials.length > 0) {
      output += ui.warn('Permission denials may have caused delays:') + '\n';
      output += this.formatPermissionDenials(permissionDenials);
      output += '\n';
    }

    output += ui.header('SUGGESTIONS') + '\n';
    output += `  Continue session:\n`;
    output += `    ${ui.color(`ccs ${profile}:continue "finish the task"`, 'command')}\n\n`;
    output += `  Increase timeout:\n`;
    output += `    ${ui.color(`ccs ${profile} --timeout ${Math.round((duration * 2) / 1000)}`, 'command')}\n\n`;
    output += `  Break into smaller tasks\n\n`;

    if (sessionId) {
      const shortId = sessionId.length > 8 ? sessionId.substring(0, 8) : sessionId;
      output += ui.dim(`Session persisted: ${shortId}`) + '\n';
    }
    if (totalCost !== undefined && totalCost !== null) {
      output += ui.dim(`Cost: $${totalCost.toFixed(4)}`) + '\n';
    }

    return output;
  }

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

  private static formatErrors(errors: ExecutionError[]): string {
    let output = ui.fail('Errors:') + '\n';

    for (const error of errors) {
      const msg = error.message || error.error || JSON.stringify(error);
      output += `  - ${msg}\n`;
    }

    return output;
  }
}

export { ResultFormatter };
