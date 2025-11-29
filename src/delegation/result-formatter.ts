#!/usr/bin/env node

/**
 * Formats delegation execution results for display
 * Creates ASCII box output with file change tracking
 */

import * as path from 'path';
import { execSync } from 'child_process';
import * as fs from 'fs';

interface ExecutionResult {
  profile: string;
  cwd: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  duration: number;
  success: boolean;
  content?: string;
  sessionId?: string;
  totalCost?: number;
  numTurns?: number;
  subtype?: string;
  permissionDenials?: PermissionDenial[];
  errors?: ErrorInfo[];
  // json?: any; // Removed: unused parameter
  timedOut?: boolean;
}

interface PermissionDenial {
  tool_name?: string;
  tool_input?: {
    command?: string;
    description?: string;
    [key: string]: unknown;
  };
}

interface ErrorInfo {
  message?: string;
  error?: string;
  [key: string]: unknown;
}

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
  static format(result: ExecutionResult): string {
    const {
      profile,
      cwd,
      exitCode,
      stdout,
      stderr,
      duration,
      success,
      content,
      sessionId,
      totalCost,
      numTurns,
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

    // Header
    output += this.formatHeader(profile, success);

    // Info box (file detection handled by delegated session itself)
    output += this.formatInfoBox(cwd, profile, duration, exitCode, sessionId, totalCost, numTurns);

    // Task output
    output += '\n';
    output += this.formatOutput(displayOutput);

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
      output += this.formatStderr(stderr);
    }

    // Footer
    output += '\n';
    output += this.formatFooter(success, duration);

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
   * Format header with delegation indicator
   */
  private static formatHeader(profile: string, success: boolean): string {
    const modelName = this.getModelDisplayName(profile);
    const icon = success ? '[i]' : '[X]';
    return `${icon} Delegated to ${modelName} (ccs:${profile})\n`;
  }

  /**
   * Format info box with delegation details
   */
  private static formatInfoBox(
    cwd: string,
    profile: string,
    duration: number,
    exitCode: number,
    sessionId?: string,
    totalCost?: number,
    numTurns?: number
  ): string {
    const modelName = this.getModelDisplayName(profile);
    const durationSec = (duration / 1000).toFixed(1);

    // Calculate box width (fit longest line + padding)
    const maxWidth = 70;
    const cwdLine = `Working Directory: ${cwd}`;
    const boxWidth = Math.min(Math.max(cwdLine.length + 4, 50), maxWidth);

    const lines: string[] = [
      `Working Directory: ${this.truncate(cwd, boxWidth - 22)}`,
      `Model: ${modelName}`,
      `Duration: ${durationSec}s`,
      `Exit Code: ${exitCode}`,
    ];

    // Add JSON-specific fields if available
    if (sessionId) {
      // Abbreviate session ID (Git-style first 8 chars) to prevent wrapping
      const shortId = sessionId.length > 8 ? sessionId.substring(0, 8) : sessionId;
      lines.push(`Session ID: ${shortId}`);
    }
    if (totalCost !== undefined && totalCost !== null) {
      lines.push(`Cost: $${totalCost.toFixed(4)}`);
    }
    if (numTurns) {
      lines.push(`Turns: ${numTurns}`);
    }

    let box = '';
    box += '╔' + '═'.repeat(boxWidth - 2) + '╗\n';

    for (const line of lines) {
      const padding = boxWidth - line.length - 4;
      box += '║ ' + line + ' '.repeat(Math.max(0, padding)) + ' ║\n';
    }

    box += '╚' + '═'.repeat(boxWidth - 2) + '╝';

    return box;
  }

  /**
   * Format task output
   */
  private static formatOutput(output: string): string {
    if (!output || !output.trim()) {
      return '[i] No output from delegated task\n';
    }

    return output.trim() + '\n';
  }

  /**
   * Format stderr output
   */
  private static formatStderr(stderr: string): string {
    return `[!] Stderr:\n${stderr.trim()}\n\n`;
  }

  /**
   * Format file list (created or modified) - Currently unused
   */
  /*
  private static formatFileList(label: string, files: string[]): string {
    let output = `[i] ${label} Files:\n`;

    for (const file of files) {
      output += `  - ${file}\n`;
    }

    return output;
  }
  */

  /**
   * Format footer with completion status
   */
  private static formatFooter(success: boolean, _duration: number): string {
    const icon = success ? '[OK]' : '[X]';
    const status = success ? 'Delegation completed' : 'Delegation failed';
    return `${icon} ${status}\n`;
  }

  /**
   * Get display name for model profile
   */
  private static getModelDisplayName(profile: string): string {
    const displayNames: Record<string, string> = {
      glm: 'GLM-4.6',
      glmt: 'GLM-4.6 (Thinking)',
      kimi: 'Kimi',
      default: 'Claude',
    };

    return displayNames[profile] || profile.toUpperCase();
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
  static formatMinimal(result: ExecutionResult): string {
    const { profile, success, duration } = result;
    const modelName = this.getModelDisplayName(profile);
    const icon = success ? '[OK]' : '[X]';
    const durationSec = (duration / 1000).toFixed(1);

    return `${icon} ${modelName} delegation ${success ? 'completed' : 'failed'} (${durationSec}s)\n`;
  }

  /**
   * Format verbose result (with full details)
   */
  static formatVerbose(result: ExecutionResult): string {
    const basic = this.format(result);

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
  private static formatTimeoutError(result: ExecutionResult): string {
    const { profile, cwd, duration, sessionId, totalCost, numTurns, permissionDenials } = result;

    let output = '';

    // Header
    output += this.formatHeader(profile, false);

    // Info box
    output += this.formatInfoBox(cwd, profile, duration, 0, sessionId, totalCost, numTurns);

    // Timeout message
    output += '\n';
    const timeoutMin = (duration / 60000).toFixed(1);
    output += `[!] Execution timed out after ${timeoutMin} minutes\n\n`;
    output += 'The delegated session exceeded its time limit before completing the task.\n';
    output += 'Session was gracefully terminated and saved for continuation.\n';

    // Permission denials if present
    if (permissionDenials && permissionDenials.length > 0) {
      output += '\n';
      output += this.formatPermissionDenials(permissionDenials);
      output += '\n';
      output += 'The task may require permissions that were denied.\n';
      output += 'Consider running with --permission-mode bypassPermissions or execute manually.\n';
    }

    // Suggestions
    output += '\n';
    output += 'Suggestions:\n';
    output += `  - Continue session: ccs ${profile}:continue -p "finish the task"\n`;
    output += `  - Increase timeout: ccs ${profile} -p "task" --timeout ${duration * 2}\n`;
    output += '  - Break task into smaller steps\n';
    output += '  - Run task manually in main Claude session\n';

    output += '\n';
    // Abbreviate session ID (Git-style first 8 chars)
    const shortId = sessionId && sessionId.length > 8 ? sessionId.substring(0, 8) : sessionId;
    output += `[i] Session persisted with ID: ${shortId}\n`;
    if (totalCost !== undefined && totalCost !== null) {
      output += `[i] Cost: $${totalCost.toFixed(4)}\n`;
    }

    return output;
  }

  /**
   * Format permission denials
   */
  private static formatPermissionDenials(denials: PermissionDenial[]): string {
    let output = '[!] Permission Denials:\n';

    for (const denial of denials) {
      const tool = denial.tool_name || 'Unknown';
      const input = denial.tool_input || {};
      const command = input.command || input.description || JSON.stringify(input);

      output += `  - ${tool}: ${command}\n`;
    }

    return output;
  }

  /**
   * Format errors array
   */
  private static formatErrors(errors: ErrorInfo[]): string {
    let output = '[X] Errors:\n';

    for (const error of errors) {
      const message = error.message || error.error || JSON.stringify(error);
      output += `  - ${message}\n`;
    }

    return output;
  }
}

export { ResultFormatter };
