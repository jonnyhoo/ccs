/**
 * OAuth Process Execution for CLIProxyAPI
 *
 * Handles the spawning and monitoring of CLIProxy OAuth process.
 * Separated from oauth-handler.ts for modularity.
 */

import { spawn, ChildProcess } from 'child_process';
import { ok, fail, info } from '../../utils/ui';
import { CLIProxyProvider } from '../types';
import { AccountInfo } from '../account-manager';
import {
  parseProjectList,
  parseDefaultProject,
  isProjectSelectionPrompt,
  isProjectList,
  generateSessionId,
  requestProjectSelection,
  type GCloudProject,
  type ProjectSelectionPrompt,
} from '../project-selection-handler';
import { ProviderOAuthConfig } from './auth-types';
import { getTimeoutTroubleshooting, showStep } from './environment-detector';
import { isAuthenticated, registerAccountFromToken } from './token-manager';
import { deviceCodeEvents, type DeviceCodePrompt } from '../device-code-handler';
import { OAUTH_FLOW_TYPES } from '../../management';

/** Options for OAuth process execution */
export interface OAuthProcessOptions {
  provider: CLIProxyProvider;
  binaryPath: string;
  args: string[];
  tokenDir: string;
  oauthConfig: ProviderOAuthConfig;
  callbackPort: number | null;
  headless: boolean;
  verbose: boolean;
  isCLI: boolean;
  nickname?: string;
}

/** Internal state for OAuth process */
interface ProcessState {
  stderrData: string;
  urlDisplayed: boolean;
  browserOpened: boolean;
  projectPromptHandled: boolean;
  accumulatedOutput: string;
  parsedProjects: GCloudProject[];
  sessionId: string;
  /** Device code displayed to user (for Device Code Flow) */
  deviceCodeDisplayed: boolean;
  /** The user code to enter at verification URL */
  userCode: string | null;
}

/**
 * Handle project selection prompt
 */
async function handleProjectSelection(
  output: string,
  state: ProcessState,
  options: OAuthProcessOptions,
  authProcess: ChildProcess,
  log: (msg: string) => void
): Promise<void> {
  const defaultProjectId = parseDefaultProject(output) || '';

  if (state.parsedProjects.length > 0 && !options.isCLI) {
    log(`Requesting project selection from UI (session: ${state.sessionId})`);

    const prompt: ProjectSelectionPrompt = {
      sessionId: state.sessionId,
      provider: options.provider,
      projects: state.parsedProjects,
      defaultProjectId,
      supportsAll: output.includes('ALL'),
    };

    try {
      const selectedId = await requestProjectSelection(prompt);
      const response = selectedId || '';
      log(`User selected: ${response || '(default)'}`);
      authProcess.stdin?.write(response + '\n');
    } catch {
      log('Project selection failed, using default');
      authProcess.stdin?.write('\n');
    }
  } else {
    log('CLI mode or no projects, auto-selecting default');
    authProcess.stdin?.write('\n');
  }
}

/**
 * Handle stdout data from OAuth process
 */
async function handleStdout(
  output: string,
  state: ProcessState,
  options: OAuthProcessOptions,
  authProcess: ChildProcess,
  log: (msg: string) => void
): Promise<void> {
  log(`stdout: ${output.trim()}`);
  state.accumulatedOutput += output;

  // H4: Use explicit flow type from OAUTH_FLOW_TYPES instead of null port check
  const flowType = OAUTH_FLOW_TYPES[options.provider] || 'authorization_code';
  const isDeviceCodeFlow = flowType === 'device_code';

  // Parse project list when available
  if (isProjectList(state.accumulatedOutput) && state.parsedProjects.length === 0) {
    state.parsedProjects = parseProjectList(state.accumulatedOutput);
    log(`Parsed ${state.parsedProjects.length} projects`);
  }

  // Handle project selection prompt (Authorization Code flows only - Device Code has no stdin pipe)
  if (!isDeviceCodeFlow && !state.projectPromptHandled && isProjectSelectionPrompt(output)) {
    state.projectPromptHandled = true;
    await handleProjectSelection(output, state, options, authProcess, log);
  }

  // Handle Device Code Flow: parse and display user code
  if (isDeviceCodeFlow && !state.deviceCodeDisplayed) {
    // Parse device/user code from various formats:
    // "Enter code: XXXX-YYYY" or "code XXXX-YYYY" or "user code: XXXX-YYYY"
    const codeMatch = state.accumulatedOutput.match(
      /(?:enter\s+)?(?:user\s+)?code[:\s]+["']?([A-Z0-9]{4,8}[-\s]?[A-Z0-9]{4,8})["']?/i
    );
    const urlMatch = state.accumulatedOutput.match(/(https?:\/\/[^\s]+device[^\s]*)/i);

    if (codeMatch) {
      state.userCode = codeMatch[1].toUpperCase();
      state.deviceCodeDisplayed = true;
      log(`Parsed device code: ${state.userCode}`);

      const verificationUrl = urlMatch?.[1] || 'https://github.com/login/device';

      // Emit device code event for WebSocket broadcast to UI
      const deviceCodePrompt: DeviceCodePrompt = {
        sessionId: state.sessionId,
        provider: options.provider,
        userCode: state.userCode,
        verificationUrl,
        expiresAt: Date.now() + 900000, // 15 minutes
      };
      deviceCodeEvents.emit('deviceCode:received', deviceCodePrompt);

      // Display device code prominently in CLI
      console.log('');
      console.log('  ╔══════════════════════════════════════════════════════╗');
      console.log(`  ║  Enter this code: ${state.userCode.padEnd(35)}║`);
      console.log('  ╚══════════════════════════════════════════════════════╝');
      console.log('');
      console.log(info(`Open: ${verificationUrl}`));
      console.log('');

      // Update step display for device code flow
      process.stdout.write('\x1b[1A\x1b[2K');
      showStep(2, 4, 'ok', 'Device code received');
      showStep(3, 4, 'progress', 'Waiting for authorization...');
    }
  }

  // Detect callback server / browser (for Authorization Code flows only)
  if (
    !isDeviceCodeFlow &&
    !state.browserOpened &&
    (output.includes('listening') || output.includes('http'))
  ) {
    process.stdout.write('\x1b[1A\x1b[2K');
    showStep(2, 4, 'ok', `Callback server listening on port ${options.callbackPort}`);
    showStep(3, 4, 'progress', 'Opening browser...');
    state.browserOpened = true;
  }

  // Display OAuth URLs in headless mode (for non-device-code flows)
  if (!isDeviceCodeFlow && options.headless && !state.urlDisplayed) {
    const urlMatch = output.match(/https?:\/\/[^\s]+/);
    if (urlMatch) {
      console.log('');
      console.log(info(`${options.oauthConfig.displayName} OAuth URL:`));
      console.log(`    ${urlMatch[0]}`);
      console.log('');
      state.urlDisplayed = true;
    }
  }
}

/** Display OAuth URL from stderr if in headless mode */
function displayUrlFromStderr(
  output: string,
  state: ProcessState,
  oauthConfig: ProviderOAuthConfig
): void {
  const urlMatch = output.match(/https?:\/\/[^\s]+/);
  if (urlMatch) {
    console.log('');
    console.log(info(`${oauthConfig.displayName} OAuth URL:`));
    console.log(`    ${urlMatch[0]}`);
    console.log('');
    state.urlDisplayed = true;
  }
}

/** Handle token not found after successful process exit */
function handleTokenNotFound(provider: CLIProxyProvider, callbackPort: number | null): void {
  console.log('');
  console.log(fail('Token not found after authentication'));
  console.log('');
  console.log('The browser showed success but callback was not received.');

  if (process.platform === 'win32') {
    console.log('');
    console.log('On Windows, this usually means:');
    console.log('  1. Windows Firewall blocked the callback');
    console.log('  2. Antivirus software blocked the connection');
    console.log('');
    console.log('Try running as Administrator:');
    console.log(
      `  netsh advfirewall firewall add rule name="CCS OAuth" dir=in action=allow protocol=TCP localport=${callbackPort}`
    );
  }

  console.log('');
  console.log(`Try: ccs ${provider} --auth --verbose`);
}

/** Handle process exit with error */
function handleProcessError(code: number | null, state: ProcessState, headless: boolean): void {
  console.log('');
  console.log(fail(`CLIProxy Plus auth exited with code ${code}`));
  if (state.stderrData && !state.urlDisplayed) {
    console.log(`    ${state.stderrData.trim().split('\n')[0]}`);
  }
  if (headless && !state.urlDisplayed) {
    console.log('');
    console.log(info('No OAuth URL was displayed. Try with --verbose for details.'));
  }
}

/**
 * Execute OAuth process and wait for completion
 */
export function executeOAuthProcess(options: OAuthProcessOptions): Promise<AccountInfo | null> {
  const {
    provider,
    binaryPath,
    args,
    tokenDir,
    oauthConfig,
    callbackPort,
    headless,
    verbose,
    nickname,
  } = options;

  const log = (msg: string) => {
    if (verbose) console.error(`[auth] ${msg}`);
  };

  return new Promise<AccountInfo | null>((resolve) => {
    // H4: Use explicit flow type from OAUTH_FLOW_TYPES instead of null port check
    const flowType = OAUTH_FLOW_TYPES[provider] || 'authorization_code';
    const isDeviceCodeFlow = flowType === 'device_code';

    // H6: TTY detection - only inherit stdin if TTY available (prevents issues in CI/piped scripts)
    // Device Code flows may need interactive stdin for email/prompts
    // Authorization Code flows need piped stdin for project selection
    const stdinMode = isDeviceCodeFlow && process.stdin.isTTY ? 'inherit' : 'pipe';

    const authProcess = spawn(binaryPath, args, {
      stdio: [stdinMode, 'pipe', 'pipe'],
      env: { ...process.env, CLI_PROXY_AUTH_DIR: tokenDir },
    });

    // H5: Signal handling - properly kill child process on SIGINT/SIGTERM
    const cleanup = () => {
      if (authProcess && !authProcess.killed) {
        authProcess.kill('SIGTERM');
      }
    };
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);

    const state: ProcessState = {
      stderrData: '',
      urlDisplayed: false,
      browserOpened: false,
      projectPromptHandled: false,
      accumulatedOutput: '',
      parsedProjects: [],
      sessionId: generateSessionId(),
      deviceCodeDisplayed: false,
      userCode: null,
    };

    const startTime = Date.now();

    authProcess.stdout?.on('data', async (data: Buffer) => {
      await handleStdout(data.toString(), state, options, authProcess, log);
    });

    authProcess.stderr?.on('data', (data: Buffer) => {
      const output = data.toString();
      state.stderrData += output;
      log(`stderr: ${output.trim()}`);
      if (headless && !state.urlDisplayed) {
        displayUrlFromStderr(output, state, oauthConfig);
      }
    });

    // Show waiting message after delay
    setTimeout(() => {
      if (isDeviceCodeFlow) {
        // Device Code Flow: show polling message
        if (!state.deviceCodeDisplayed) {
          // Code not yet displayed, show generic waiting message
          showStep(3, 4, 'progress', 'Waiting for device code...');
        }
        showStep(4, 4, 'progress', 'Polling for authorization...');
        console.log('');
        console.log(
          info('Complete the login in your browser. This page will update automatically.')
        );
      } else {
        // Authorization Code Flow: show callback server message
        if (!state.browserOpened) {
          process.stdout.write('\x1b[1A\x1b[2K');
          showStep(2, 4, 'ok', `Callback server ready (port ${callbackPort})`);
          showStep(3, 4, 'ok', 'Browser opened');
          state.browserOpened = true;
        }
        showStep(4, 4, 'progress', 'Waiting for OAuth callback...');
        console.log('');
        console.log(
          info('Complete the login in your browser. This page will update automatically.')
        );
      }
      if (!verbose) console.log(info('If stuck, try: ccs ' + provider + ' --auth --verbose'));
    }, 2000);

    // Timeout handling
    const timeoutMs = headless ? 300000 : 120000;
    const timeout = setTimeout(() => {
      // H5: Remove signal handlers before killing process
      process.removeListener('SIGINT', cleanup);
      process.removeListener('SIGTERM', cleanup);
      authProcess.kill();
      console.log('');
      console.log(fail(`OAuth timed out after ${headless ? 5 : 2} minutes`));
      for (const line of getTimeoutTroubleshooting(provider, callbackPort ?? null)) {
        console.log(line);
      }
      resolve(null);
    }, timeoutMs);

    authProcess.on('exit', (code) => {
      clearTimeout(timeout);
      // H5: Remove signal handlers to prevent memory leaks
      process.removeListener('SIGINT', cleanup);
      process.removeListener('SIGTERM', cleanup);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

      if (code === 0) {
        if (isAuthenticated(provider)) {
          console.log('');
          console.log(ok(`Authentication successful (${elapsed}s)`));

          // Emit device code completion event for UI
          if (isDeviceCodeFlow && state.deviceCodeDisplayed) {
            deviceCodeEvents.emit('deviceCode:completed', state.sessionId);
          }

          resolve(registerAccountFromToken(provider, tokenDir, nickname));
        } else {
          // Emit device code failure event for UI
          if (isDeviceCodeFlow && state.deviceCodeDisplayed) {
            deviceCodeEvents.emit('deviceCode:failed', {
              sessionId: state.sessionId,
              error: 'Token not found after authentication',
            });
          }

          handleTokenNotFound(provider, callbackPort);
          resolve(null);
        }
      } else {
        // Emit device code failure event for UI
        if (isDeviceCodeFlow && state.deviceCodeDisplayed) {
          deviceCodeEvents.emit('deviceCode:failed', {
            sessionId: state.sessionId,
            error: `Auth process exited with code ${code}`,
          });
        }

        handleProcessError(code, state, headless);
        resolve(null);
      }
    });

    authProcess.on('error', (error) => {
      clearTimeout(timeout);
      // H5: Remove signal handlers to prevent memory leaks
      process.removeListener('SIGINT', cleanup);
      process.removeListener('SIGTERM', cleanup);
      console.log('');
      console.log(fail(`Failed to start auth process: ${error.message}`));
      resolve(null);
    });
  });
}
