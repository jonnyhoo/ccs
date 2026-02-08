#!/usr/bin/env node

/**
 * Headless executor for Claude CLI delegation
 * Spawns claude with -p flag for single-turn execution
 */

import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as net from 'net';
import * as tls from 'tls';
import { SessionManager } from './session-manager';
import { SettingsParser } from './settings-parser';
import { ui, warn, info } from '../utils/ui';
import { type ExecutionOptions, type ExecutionResult, type StreamMessage } from './executor/types';
import { StreamBuffer, formatToolVerbose } from './executor/stream-parser';
import { buildExecutionResult } from './executor/result-aggregator';
import { getCcsDir, getModelDisplayName } from '../utils/config-manager';

// Re-export types for consumers
export type { ExecutionOptions, ExecutionResult, StreamMessage } from './executor/types';

/**
 * Headless executor for Claude CLI delegation
 */
export class HeadlessExecutor {
  /**
   * Execute task via headless Claude CLI
   * @param profile - Profile name (glm, kimi, custom)
   * @param enhancedPrompt - Enhanced prompt with context
   * @param options - Execution options
   * @returns execution result
   */
  static async execute(
    profile: string,
    enhancedPrompt: string,
    options: ExecutionOptions = {}
  ): Promise<ExecutionResult> {
    const {
      cwd = process.cwd(),
      timeout = 600000, // 10 minutes default
      permissionMode = 'acceptEdits',
      resumeSession = false,
      sessionId = null,
      maxTurns,
      fallbackModel,
      agents,
      betas,
      extraArgs = [],
      runInBackground = false,
    } = options;

    // Validate permission mode
    this._validatePermissionMode(permissionMode);

    // Initialize session manager
    const sessionMgr = new SessionManager();

    // Detect Claude CLI path
    const claudeCli = this._detectClaudeCli();
    if (!claudeCli) {
      throw new Error(
        'Claude CLI not found in PATH. Install from: https://docs.claude.com/en/docs/claude-code/installation'
      );
    }

    // Get settings path for profile
    const settingsPath = path.join(getCcsDir(), `${profile}.settings.json`);

    // Validate settings file exists
    if (!fs.existsSync(settingsPath)) {
      throw new Error(
        `Settings file not found: ${settingsPath}\nProfile "${profile}" may not be configured.`
      );
    }

    // Smart slash command detection and preservation
    const processedPrompt = this._processSlashCommand(enhancedPrompt);

    // Prepare arguments
    const args: string[] = [processedPrompt, '--settings', settingsPath];

    // Always use stream-json for real-time progress visibility
    args.push('--output-format', 'stream-json', '--verbose');

    // Add permission mode
    if (permissionMode && permissionMode !== 'default') {
      if (permissionMode === 'bypassPermissions') {
        args.push('--dangerously-skip-permissions');
        if (process.env.CCS_DEBUG) {
          console.warn(warn('WARNING: Using --dangerously-skip-permissions mode'));
        }
      } else {
        args.push('--permission-mode', permissionMode);
      }
    }

    // Add resume flag for multi-turn sessions
    if (resumeSession) {
      const lastSession = sessionMgr.getLastSession(profile);
      if (lastSession) {
        args.push('--resume', lastSession.sessionId);
        if (process.env.CCS_DEBUG) {
          const cost = lastSession.totalCost?.toFixed(4) || '0.0000';
          console.error(info(`Resuming session: ${lastSession.sessionId} ($${cost})`));
        }
      } else if (sessionId) {
        args.push('--resume', sessionId);
      } else {
        console.warn(warn('No previous session found, starting new session'));
      }
    } else if (sessionId) {
      args.push('--resume', sessionId);
    }

    // Add tool restrictions from settings
    const toolRestrictions = SettingsParser.parseToolRestrictions(cwd);
    if (toolRestrictions.allowedTools.length > 0) {
      args.push('--allowedTools', ...toolRestrictions.allowedTools);
    }
    if (toolRestrictions.disallowedTools.length > 0) {
      args.push('--disallowedTools', ...toolRestrictions.disallowedTools);
    }

    // Claude Code CLI passthrough flags (explicit, validated)
    // Use undefined checks (not truthy) to allow empty strings if ever valid
    if (maxTurns !== undefined && maxTurns > 0) {
      args.push('--max-turns', String(maxTurns));
    }
    if (fallbackModel !== undefined && fallbackModel) {
      args.push('--fallback-model', fallbackModel);
    }
    if (agents !== undefined && agents) {
      args.push('--agents', agents);
    }
    if (betas !== undefined && betas) {
      args.push('--betas', betas);
    }

    // Passthrough extra args (catch-all for new/unknown flags)
    // Filter out duplicates of explicitly handled flags
    if (extraArgs.length > 0) {
      const explicitFlags = new Set(['--max-turns', '--fallback-model', '--agents', '--betas']);
      const filteredExtras: string[] = [];
      for (let i = 0; i < extraArgs.length; i++) {
        if (explicitFlags.has(extraArgs[i])) {
          // Skip this flag and its value (next element)
          if (i + 1 < extraArgs.length && !extraArgs[i + 1].startsWith('-')) {
            i++; // Skip value too
          }
          continue;
        }
        filteredExtras.push(extraArgs[i]);
      }
      if (filteredExtras.length > 0) {
        args.push(...filteredExtras);
      }
    }

    if (process.env.CCS_DEBUG) {
      console.error(info(`Claude CLI args: ${args.join(' ')}`));
    }

    // Initialize UI before spawning
    await ui.init();

    // Background execution mode
    if (runInBackground) {
      return this._spawnBackground(claudeCli, args, { cwd, profile });
    }

    // Execute with spawn (blocking)
    return this._spawnAndExecute(claudeCli, args, {
      cwd,
      profile,
      timeout,
      resumeSession,
      sessionId,
      sessionMgr,
    });
  }

  /**
   * Spawn Claude CLI in background mode
   * Returns immediately with task ID and output file path
   */
  private static async _spawnBackground(
    claudeCli: string,
    args: string[],
    ctx: { cwd: string; profile: string }
  ): Promise<ExecutionResult> {
    const { cwd, profile } = ctx;
    const taskId = `ccs-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const outputDir = path.join(os.tmpdir(), 'ccs-tasks');

    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const modelName = getModelDisplayName(profile);
    console.error(ui.info(`Background task started: ${taskId}`));
    console.error(ui.info(`Delegating to ${modelName} in background...`));

    const redisUrl = await this._resolveRedisBackgroundUrl();
    if (redisUrl) {
      return this._spawnBackgroundRedis(claudeCli, args, { cwd, profile, taskId, redisUrl });
    }

    const outputFile = path.join(outputDir, `${taskId}.output`);
    console.error(ui.info(`Output file: ${outputFile}`));

    const isWindows = process.platform === 'win32';

    if (isWindows) {
      // Windows: create temp .ps1 script for reliable background execution with Unicode support.
      // Use PowerShell native argument array to avoid quote mangling for values containing " and $.
      const scriptFile = path.join(outputDir, `${taskId}.ps1`);
      const escapePsSingle = (s: string) => s.replace(/'/g, "''");
      const psArgs = args.map((a) => `  '${escapePsSingle(a)}'`).join(',\n');
      const psContent = `
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Set-Location -LiteralPath '${escapePsSingle(cwd)}'
$claudeCli = '${escapePsSingle(claudeCli)}'
$claudeArgs = @(
${psArgs}
)
& $claudeCli @claudeArgs 2>&1 | Out-File -FilePath '${escapePsSingle(outputFile)}' -Encoding UTF8
`;
      // Write with UTF-8 BOM so PowerShell reads Unicode correctly
      const bom = Buffer.from([0xef, 0xbb, 0xbf]);
      fs.writeFileSync(scriptFile, Buffer.concat([bom, Buffer.from(psContent, 'utf8')]));

      // Use wscript.exe + VBS to create truly independent background process
      // This escapes Job Object restrictions that kill children on parent exit
      const vbsFile = path.join(outputDir, `${taskId}.vbs`);
      const ps = `${process.env.SystemRoot}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe`;
      const vbsContent = `
Set WshShell = CreateObject("WScript.Shell")
WshShell.Run """${ps}"" -NoProfile -ExecutionPolicy Bypass -File ""${scriptFile}""", 0, False
`;
      fs.writeFileSync(vbsFile, vbsContent);

      spawn('wscript.exe', [vbsFile], {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
      }).unref();
    } else {
      // Unix: use standard detached spawn with file descriptors
      const outFd = fs.openSync(outputFile, 'a');
      const proc = spawn(claudeCli, args, {
        cwd,
        stdio: ['ignore', outFd, outFd],
        detached: true,
      });
      proc.unref();
      fs.closeSync(outFd);
    }

    // Return immediately with background task info
    const monitorCmd = isWindows ? `Get-Content -Wait "${outputFile}"` : `tail -f ${outputFile}`;

    return Promise.resolve({
      exitCode: 0,
      stdout: '',
      stderr: '',
      cwd,
      profile,
      duration: 0,
      timedOut: false,
      success: true,
      messages: [],
      isBackground: true,
      taskId,
      outputFile,
      monitorCommand: monitorCmd,
      content: `Background task started.\nTask ID: ${taskId}\nOutput: ${outputFile}\n\nUse '${monitorCmd}' to monitor progress.`,
    });
  }

  private static async _resolveRedisBackgroundUrl(): Promise<string | undefined> {
    const backend = (process.env.CCS_BG_BACKEND || '').trim().toLowerCase();
    if (backend === 'file') {
      return undefined;
    }

    const explicitUrl = process.env.CCS_REDIS_URL?.trim();
    if (explicitUrl) {
      if (await this._canConnectRedis(explicitUrl)) {
        return explicitUrl;
      }
      if (backend === 'redis') {
        throw new Error(`Redis is configured but unreachable: ${explicitUrl}`);
      }
      return undefined;
    }

    const candidates = ['redis://127.0.0.1:6379/0', 'redis://localhost:6379/0'];
    for (const candidate of candidates) {
      if (await this._canConnectRedis(candidate)) {
        return candidate;
      }
    }

    if (backend === 'redis') {
      throw new Error('CCS_BG_BACKEND=redis but no reachable Redis found on localhost:6379');
    }

    return undefined;
  }

  private static _canConnectRedis(redisUrl: string): Promise<boolean> {
    return new Promise((resolve) => {
      let socket: net.Socket | tls.TLSSocket;
      let settled = false;

      const done = (ok: boolean) => {
        if (settled) return;
        settled = true;
        try {
          socket.end();
          socket.destroy();
        } catch {
          // ignore
        }
        resolve(ok);
      };

      try {
        const parsed = new URL(redisUrl);
        const host = parsed.hostname || '127.0.0.1';
        const port = parsed.port ? parseInt(parsed.port, 10) : 6379;
        const secure = parsed.protocol === 'rediss:';

        const onConnect = () => {
          socket.write('*1\r\n$4\r\nPING\r\n');
        };

        socket = secure
          ? tls.connect({ host, port, servername: host }, onConnect)
          : net.createConnection({ host, port }, onConnect);

        socket.setTimeout(400);
        socket.once('timeout', () => done(false));
        socket.once('error', () => done(false));
        socket.once('data', (chunk: Buffer | string) => {
          const txt = chunk.toString();
          done(txt.startsWith('+PONG') || txt.startsWith('-NOAUTH') || txt.startsWith('-ERR'));
        });
      } catch {
        done(false);
      }
    });
  }

  private static _spawnBackgroundRedis(
    claudeCli: string,
    args: string[],
    ctx: { cwd: string; profile: string; taskId: string; redisUrl: string }
  ): Promise<ExecutionResult> {
    const { cwd, profile, taskId, redisUrl } = ctx;

    if (!redisUrl) {
      throw new Error('Redis URL is required for Redis background mode');
    }

    const streamKey = `ccs:task:${taskId}:events`;
    const runnerScript = path.resolve(__dirname, '..', '..', 'scripts', 'background-redis-bridge.js');

    if (!fs.existsSync(runnerScript)) {
      throw new Error(`Redis bridge script not found: ${runnerScript}`);
    }

    const child = spawn(process.execPath, [runnerScript], {
      cwd,
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
      env: {
        ...process.env,
        CCS_BG_TASK_ID: taskId,
        CCS_BG_REDIS_URL: redisUrl,
        CCS_BG_STREAM_KEY: streamKey,
        CCS_BG_CWD: cwd,
        CCS_BG_CLAUDE_CLI: claudeCli,
        CCS_BG_CLAUDE_ARGS_B64: Buffer.from(JSON.stringify(args), 'utf8').toString('base64'),
      },
    });
    child.unref();

    const monitorCmd = `redis-cli XREAD BLOCK 0 STREAMS ${streamKey} $`;

    return Promise.resolve({
      exitCode: 0,
      stdout: '',
      stderr: '',
      cwd,
      profile,
      duration: 0,
      timedOut: false,
      success: true,
      messages: [],
      isBackground: true,
      taskId,
      streamKey,
      monitorCommand: monitorCmd,
      content:
        `Background task started (Redis).\n` +
        `Task ID: ${taskId}\n` +
        `Stream: ${streamKey}\n\n` +
        `Use '${monitorCmd}' to monitor progress.`,
    });
  }

  /**
   * Spawn Claude CLI and handle execution
   */
  private static _spawnAndExecute(
    claudeCli: string,
    args: string[],
    ctx: {
      cwd: string;
      profile: string;
      timeout: number;
      resumeSession: boolean;
      sessionId: string | null;
      sessionMgr: SessionManager;
    }
  ): Promise<ExecutionResult> {
    const { cwd, profile, timeout, resumeSession, sessionId, sessionMgr } = ctx;

    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const showProgress = !process.env.CCS_QUIET;
      const streamBuffer = new StreamBuffer();

      if (showProgress) {
        const modelName = getModelDisplayName(profile);
        console.error(ui.info(`Delegating to ${modelName}...`));
      }

      const isWindows = process.platform === 'win32';
      let launchCmd = claudeCli;

      // where claude may return path without extension on Windows; prefer .cmd/.exe if present.
      if (isWindows && !/\.(cmd|bat|ps1|exe)$/i.test(launchCmd)) {
        if (fs.existsSync(`${launchCmd}.cmd`)) {
          launchCmd = `${launchCmd}.cmd`;
        } else if (fs.existsSync(`${launchCmd}.exe`)) {
          launchCmd = `${launchCmd}.exe`;
        }
      }

      const needsShell = isWindows && /\.(cmd|bat|ps1)$/i.test(launchCmd);

      const proc = needsShell
        ? spawn([launchCmd, ...args].map((a) => `"${a.replace(/"/g, '\\"')}"`).join(' '), {
            cwd,
            stdio: ['ignore', 'pipe', 'pipe'],
            timeout,
            shell: true,
            windowsHide: true,
          })
        : spawn(launchCmd, args, {
            cwd,
            stdio: ['ignore', 'pipe', 'pipe'],
            timeout,
            windowsHide: true,
          });

      // Avoid cmd.exe argument mangling for values like "-like" on Windows.
      // Only use shell mode when launching a script wrapper (.cmd/.bat/.ps1). and keep direct spawn for .exe.

      let stdout = '';
      let stderr = '';
      let progressInterval: NodeJS.Timeout | undefined;
      const messages: StreamMessage[] = [];
      let timedOut = false;

      // Setup signal handlers for cleanup
      const cleanupHandler = () => {
        if (!proc.killed) {
          proc.kill('SIGTERM');
          setTimeout(() => {
            if (!proc.killed) proc.kill('SIGKILL');
          }, 2000);
        }
      };
      process.once('SIGINT', cleanupHandler);
      process.once('SIGTERM', cleanupHandler);
      const removeSignalHandlers = () => {
        process.removeListener('SIGINT', cleanupHandler);
        process.removeListener('SIGTERM', cleanupHandler);
      };
      proc.on('close', removeSignalHandlers);
      proc.on('error', removeSignalHandlers);

      // Progress indicator
      if (showProgress) {
        progressInterval = setInterval(() => {
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
          process.stderr.write(`${ui.info(`Still running... ${elapsed}s elapsed`)}\r`);
        }, 5000);
      }

      // Capture stdout (stream-json format)
      proc.stdout?.on('data', (data: Buffer) => {
        const dataStr = data.toString();
        stdout += dataStr;

        const parsedMessages = streamBuffer.parseChunk(dataStr);
        for (const msg of parsedMessages) {
          messages.push(msg);

          // Show real-time tool use
          if (showProgress && msg.type === 'assistant') {
            const toolUses = msg.message?.content?.filter((c) => c.type === 'tool_use') || [];
            for (const tool of toolUses) {
              process.stderr.write('\r\x1b[K');
              const toolInput = tool.input || {};
              const verboseMsg = formatToolVerbose(tool.name || 'Unknown', toolInput);
              process.stderr.write(`${verboseMsg}\n`);
            }
          }
        }
      });

      // Stream stderr in real-time
      proc.stderr?.on('data', (data: Buffer) => {
        const stderrText = data.toString();
        stderr += stderrText;
        if (showProgress) {
          if (progressInterval) process.stderr.write('\r\x1b[K');
          process.stderr.write(stderrText);
        }
      });

      // Handle completion
      proc.on('close', (exitCode: number | null) => {
        const duration = Date.now() - startTime;

        if (progressInterval) {
          clearInterval(progressInterval);
          process.stderr.write('\r\x1b[K');
        }

        if (showProgress) {
          const durationSec = (duration / 1000).toFixed(1);
          console.error(
            timedOut
              ? ui.warn(`Timed out after ${durationSec}s`)
              : ui.info(`Completed in ${durationSec}s`)
          );
          console.error('');
        }

        const result = buildExecutionResult({
          exitCode: exitCode || 0,
          stdout,
          stderr,
          cwd,
          profile,
          duration,
          timedOut,
          messages,
        });

        // Store session
        if (result.sessionId) {
          if (resumeSession || sessionId) {
            sessionMgr.updateSession(profile, result.sessionId, { totalCost: result.totalCost });
          } else {
            sessionMgr.storeSession(profile, {
              sessionId: result.sessionId,
              totalCost: result.totalCost,
              cwd,
            });
          }
          if (Math.random() < 0.1) sessionMgr.cleanupExpired();
        }

        resolve(result);
      });

      // Handle errors
      proc.on('error', (error: Error) => {
        if (progressInterval) clearInterval(progressInterval);
        reject(new Error(`Failed to execute Claude CLI: ${error.message}`));
      });

      // Handle timeout
      if (timeout > 0) {
        const timeoutHandle = setTimeout(() => {
          if (!proc.killed) {
            timedOut = true;
            if (progressInterval) {
              clearInterval(progressInterval);
              process.stderr.write('\r\x1b[K');
            }
            proc.kill('SIGTERM');
            setTimeout(() => {
              if (!proc.killed) proc.kill('SIGKILL');
            }, 10000);
          }
        }, timeout);
        proc.on('close', () => clearTimeout(timeoutHandle));
      }
    });
  }

  /** Validate permission mode */
  private static _validatePermissionMode(mode: string): void {
    const VALID_MODES = ['default', 'plan', 'acceptEdits', 'bypassPermissions'];
    if (!VALID_MODES.includes(mode)) {
      throw new Error(`Invalid permission mode: "${mode}". Valid modes: ${VALID_MODES.join(', ')}`);
    }
  }

  /** Detect Claude CLI executable */
  private static _detectClaudeCli(): string | null {
    if (process.env.CCS_CLAUDE_PATH) return process.env.CCS_CLAUDE_PATH;
    const { execSync } = require('child_process');
    const isWindows = process.platform === 'win32';
    try {
      if (isWindows) {
        // Windows: use 'where' command, returns multiple lines if found in multiple locations
        const result = execSync('where claude', { encoding: 'utf8' }).trim();
        return result.split('\n')[0].trim(); // Return first match
      } else {
        return execSync('command -v claude', { encoding: 'utf8' }).trim();
      }
    } catch {
      return null;
    }
  }

  /** Execute with retry logic */
  static async executeWithRetry(
    profile: string,
    enhancedPrompt: string,
    options: ExecutionOptions = {}
  ): Promise<ExecutionResult> {
    const { maxRetries = 2, ...execOptions } = options;
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.execute(profile, enhancedPrompt, execOptions);
        if (result.success) return result;
        if (attempt < maxRetries) {
          console.error(warn(`Attempt ${attempt + 1} failed, retrying...`));
          await this._sleep(1000 * (attempt + 1));
          continue;
        }
        return result;
      } catch (error) {
        lastError = error as Error;
        if (attempt < maxRetries) {
          console.error(warn(`Attempt ${attempt + 1} errored, retrying...`));
          await this._sleep(1000 * (attempt + 1));
        }
      }
    }
    throw lastError || new Error('Execution failed after all retry attempts');
  }

  /** Sleep utility for retry backoff */
  private static _sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /** Process prompt to detect and preserve slash commands */
  private static _processSlashCommand(prompt: string): string {
    const trimmed = prompt.trim();

    // Case 1: Already starts with slash command
    if (trimmed.match(/^\/[\w:-]+(\s|$)/)) return prompt;

    // Case 2: Find slash command embedded in text
    const embeddedSlash = trimmed.match(/(?:^|[^\w/])(\/[\w:-]+)(\s+[\s\S]*)?$/);
    if (embeddedSlash) {
      const command = embeddedSlash[1];
      const args = (embeddedSlash[2] || '').trim();
      const matchIndex = embeddedSlash.index || 0;
      const matchStart = matchIndex + (embeddedSlash[0][0] === '/' ? 0 : 1);
      const beforeCommand = trimmed.substring(0, matchStart).trim();

      if (beforeCommand && args) return `${command} ${args}\n\nContext: ${beforeCommand}`;
      if (beforeCommand) return `${command}\n\nContext: ${beforeCommand}`;
      return args ? `${command} ${args}` : command;
    }

    return prompt;
  }

  /** Test if profile is executable */
  static async testProfile(profile: string): Promise<boolean> {
    try {
      const result = await this.execute(profile, 'Say "test successful"', { timeout: 10000 });
      return result.success;
    } catch {
      return false;
    }
  }
}
