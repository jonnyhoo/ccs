import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { detectClaudeCli } from './utils/claude-detector';
import { getSettingsPath, loadSettings } from './utils/config-manager';
import { ErrorManager } from './utils/error-manager';
import { getGlobalEnvConfig } from './config/unified-config-loader';
import { fail, info, ok, dim, bold, box, initUI } from './utils/ui';
import { ensureCliproxyIfNeeded } from './proxy/cliproxy-autostart';
import { CacheKeepaliveManager } from './proxy/cache-keepalive-manager';

// 集中错误处理
import { handleError, runCleanup } from './errors';

// Shell 执行工具
import { execClaude, escapeShellArg } from './utils/shell-executor';

interface ProxyMeta {
  profileName: string;
  upstreamUrl: string;
}

/**
 * 打印代理链仪表盘（Claude 启动前显示）
 */
function printProxyDashboard(
  meta: ProxyMeta,
  keepalivePort: number | null | undefined,
  sanitizerPort: number | null
): void {
  const lines: string[] = [];
  const label = (k: string, v: string) => `  ${dim(k.padEnd(12))}${v}`;

  lines.push(label('Profile', bold(meta.profileName)));
  lines.push(label('Upstream', meta.upstreamUrl));

  if (keepalivePort) {
    lines.push(label('Cache', `${ok(':' + keepalivePort)} keepalive`));
  }
  if (sanitizerPort) {
    lines.push(label('Sanitizer', `${ok(':' + sanitizerPort)} tool-name fix`));
  }

  console.error(box(lines.join('\n'), { title: 'CCS Proxy', padding: 0 }));
}

// ========== Profile Detection ==========

interface DetectedProfile {
  profile: string;
  remainingArgs: string[];
}

/**
 * 从命令行参数中检测 profile 名称
 */
function detectProfile(args: string[]): DetectedProfile {
  if (args.length === 0 || args[0].startsWith('-')) {
    return { profile: 'default', remainingArgs: args };
  }
  return { profile: args[0], remainingArgs: args.slice(1) };
}

// ========== GLMT Proxy Execution ==========

/**
 * 通过内嵌 GLMT 代理执行 Claude CLI（用于 glmt profile）
 */
async function execClaudeWithProxy(
  claudeCli: string,
  profileName: string,
  args: string[]
): Promise<void> {
  const settingsPath = getSettingsPath(profileName);
  const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  const envData = settings.env;
  const apiKey = envData['ANTHROPIC_AUTH_TOKEN'];

  if (!apiKey || apiKey === 'YOUR_GLM_API_KEY_HERE') {
    console.error(fail('GLMT profile requires Z.AI API key'));
    console.error('    Edit ~/.ccs/glmt.settings.json and set ANTHROPIC_AUTH_TOKEN');
    process.exit(1);
  }

  const verbose = args.includes('--verbose') || args.includes('-v');

  const proxyPath = path.join(__dirname, 'glmt', 'glmt-proxy.js');
  const proxyArgs = verbose ? ['--verbose'] : [];
  const proxy = spawn(process.execPath, [proxyPath, ...proxyArgs], {
    stdio: ['ignore', 'pipe', verbose ? 'pipe' : 'inherit'],
    env: {
      ...process.env,
      ANTHROPIC_AUTH_TOKEN: apiKey,
      ANTHROPIC_BASE_URL: envData['ANTHROPIC_BASE_URL'],
    },
  });

  const { ProgressIndicator } = await import('./utils/progress-indicator');
  const spinner = new ProgressIndicator('Starting GLMT proxy');
  spinner.start();

  let port: number;
  try {
    port = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Proxy startup timeout (5s)'));
      }, 5000);

      proxy.stdout?.on('data', (data: Buffer) => {
        const match = data.toString().match(/PROXY_READY:(\d+)/);
        if (match) {
          clearTimeout(timeout);
          resolve(parseInt(match[1]));
        }
      });

      proxy.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });

      proxy.on('exit', (code) => {
        if (code !== 0 && code !== null) {
          clearTimeout(timeout);
          reject(new Error(`Proxy exited with code ${code}`));
        }
      });
    });

    spinner.succeed(`GLMT proxy ready on port ${port}`);
  } catch (error) {
    const err = error as Error;
    spinner.fail('Failed to start GLMT proxy');
    console.error(fail(`Error: ${err.message}`));
    proxy.kill();
    process.exit(1);
  }

  const configuredModel = envData['ANTHROPIC_MODEL'] || 'glm-4.7';
  const envVars: NodeJS.ProcessEnv = {
    ANTHROPIC_BASE_URL: `http://127.0.0.1:${port}`,
    ANTHROPIC_AUTH_TOKEN: apiKey,
    ANTHROPIC_MODEL: configuredModel,
  };

  const isWindows = process.platform === 'win32';
  const needsShell = isWindows && /\.(cmd|bat|ps1)$/i.test(claudeCli);
  const env = {
    ...process.env,
    ...envVars,
    CCS_PROFILE_TYPE: 'settings',
  };

  let claude: ChildProcess;
  if (needsShell) {
    const cmdString = [claudeCli, ...args].map(escapeShellArg).join(' ');
    claude = spawn(cmdString, { stdio: 'inherit', windowsHide: true, shell: true, env });
  } else {
    claude = spawn(claudeCli, args, { stdio: 'inherit', windowsHide: true, env });
  }

  claude.on('exit', (code, signal) => {
    proxy.kill('SIGTERM');
    if (signal) process.kill(process.pid, signal as NodeJS.Signals);
    else process.exit(code || 0);
  });

  claude.on('error', (error) => {
    console.error(fail(`Claude CLI error: ${error}`));
    proxy.kill('SIGTERM');
    process.exit(1);
  });

  process.once('SIGTERM', () => {
    proxy.kill('SIGTERM');
    claude.kill('SIGTERM');
  });
  process.once('SIGINT', () => {
    proxy.kill('SIGTERM');
    claude.kill('SIGTERM');
  });
}

// ========== OpenAI Translation Proxy Execution ==========

/**
 * 通过 AnthropicToOpenAIProxy 执行 Claude CLI（用于 OpenAI 兼容端点）
 */
async function execClaudeWithOpenAIProxy(
  claudeCli: string,
  profileName: string,
  args: string[],
  useResponsesApi: boolean = false
): Promise<void> {
  const settingsPath = getSettingsPath(profileName);
  const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  const envData = settings.env || {};
  const baseUrl = envData['ANTHROPIC_BASE_URL'];
  const apiKey = envData['ANTHROPIC_AUTH_TOKEN'] || '';
  const model = envData['ANTHROPIC_MODEL'] || 'default';

  if (!baseUrl) {
    console.error(fail(`Profile '${profileName}' has no ANTHROPIC_BASE_URL configured`));
    process.exit(1);
  }

  const verbose = args.includes('--verbose') || args.includes('-v');

  const { AnthropicToOpenAIProxy } = await import('./proxy/anthropic-to-openai-proxy');
  const proxy = new AnthropicToOpenAIProxy({
    targetBaseUrl: baseUrl,
    apiKey,
    verbose,
    timeoutMs: 120000,
    useResponsesApi,
  });

  let proxyPort: number;
  try {
    proxyPort = await proxy.start();
    if (verbose) {
      const modeName = useResponsesApi ? 'Responses API mode' : 'Chat Completions mode';
      console.error(`[openai-proxy] Translation proxy active on port ${proxyPort}`);
      console.error(`[openai-proxy] Target: ${baseUrl} (${modeName})`);
    }
  } catch (error) {
    const err = error as Error;
    console.error(fail(`Failed to start OpenAI translation proxy: ${err.message}`));
    process.exit(1);
  }

  const globalEnvConfig = getGlobalEnvConfig();
  const globalEnv = globalEnvConfig.enabled ? globalEnvConfig.env : {};

  const effectiveBaseUrl = `http://127.0.0.1:${proxyPort}`;
  const effectiveOpusModel = envData['ANTHROPIC_DEFAULT_OPUS_MODEL'] || model;
  const effectiveSonnetModel = envData['ANTHROPIC_DEFAULT_SONNET_MODEL'] || model;
  const effectiveHaikuModel = envData['ANTHROPIC_DEFAULT_HAIKU_MODEL'] || model;

  const sessionSettingsPath = path.join(
    os.tmpdir(),
    `ccs-openai-${profileName}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.settings.json`
  );

  const sessionSettings = {
    ...settings,
    env: {
      ...(settings.env || {}),
      ANTHROPIC_BASE_URL: effectiveBaseUrl,
      ANTHROPIC_AUTH_TOKEN: apiKey,
      ANTHROPIC_MODEL: model,
      ANTHROPIC_DEFAULT_OPUS_MODEL: effectiveOpusModel,
      ANTHROPIC_DEFAULT_SONNET_MODEL: effectiveSonnetModel,
      ANTHROPIC_DEFAULT_HAIKU_MODEL: effectiveHaikuModel,
    },
  };

  fs.writeFileSync(sessionSettingsPath, JSON.stringify(sessionSettings, null, 2) + '\n', 'utf8');

  const envVars: NodeJS.ProcessEnv = {
    ...globalEnv,
    ANTHROPIC_BASE_URL: effectiveBaseUrl,
    ANTHROPIC_AUTH_TOKEN: apiKey,
    ANTHROPIC_MODEL: model,
    ANTHROPIC_DEFAULT_OPUS_MODEL: effectiveOpusModel,
    ANTHROPIC_DEFAULT_SONNET_MODEL: effectiveSonnetModel,
    ANTHROPIC_DEFAULT_HAIKU_MODEL: effectiveHaikuModel,
    CCS_PROFILE_TYPE: 'settings',
  };

  const cleanupSessionSettings = (): void => {
    try {
      if (fs.existsSync(sessionSettingsPath)) fs.unlinkSync(sessionSettingsPath);
    } catch {
      /* ignore */
    }
  };

  const isWindows = process.platform === 'win32';
  const needsShell = isWindows && /\.(cmd|bat|ps1)$/i.test(claudeCli);
  const env = { ...process.env, ...envVars };

  let claude: ChildProcess;
  if (needsShell) {
    const cmdString = [claudeCli, '--settings', sessionSettingsPath, ...args]
      .map(escapeShellArg)
      .join(' ');
    claude = spawn(cmdString, { stdio: 'inherit', windowsHide: true, shell: true, env });
  } else {
    claude = spawn(claudeCli, ['--settings', sessionSettingsPath, ...args], {
      stdio: 'inherit',
      windowsHide: true,
      env,
    });
  }

  claude.on('exit', (code, signal) => {
    proxy.stop();
    cleanupSessionSettings();
    if (signal) process.kill(process.pid, signal as NodeJS.Signals);
    else process.exit(code || 0);
  });

  claude.on('error', (error) => {
    console.error(fail(`Claude CLI error: ${error}`));
    proxy.stop();
    cleanupSessionSettings();
    process.exit(1);
  });

  process.once('SIGTERM', () => {
    proxy.stop();
    cleanupSessionSettings();
    claude.kill('SIGTERM');
  });
  process.once('SIGINT', () => {
    proxy.stop();
    cleanupSessionSettings();
    claude.kill('SIGTERM');
  });
}

// ========== Tool Sanitization Proxy Execution ==========

/**
 * 通过工具名清洗代理执行 Claude CLI（用于普通 settings profile）
 */
async function execClaudeWithToolSanitizationProxy(
  claudeCli: string,
  settingsPath: string,
  args: string[],
  envVars: NodeJS.ProcessEnv,
  keepalivePort?: number | null,
  meta?: ProxyMeta
): Promise<void> {
  const verbose = args.includes('--verbose') || args.includes('-v');

  let toolSanitizationProxy: { start: () => Promise<number>; stop: () => void } | null = null;
  let effectiveBaseUrl = envVars.ANTHROPIC_BASE_URL;
  let sanitizerPort: number | null = null;

  if (effectiveBaseUrl) {
    try {
      const { ToolSanitizationProxy } = await import('./proxy/tool-sanitization-proxy');
      toolSanitizationProxy = new ToolSanitizationProxy({
        upstreamBaseUrl: effectiveBaseUrl,
        verbose,
        warnOnSanitize: true,
      });
      sanitizerPort = await toolSanitizationProxy.start();
      effectiveBaseUrl = `http://127.0.0.1:${sanitizerPort}`;
    } catch (error) {
      const err = error as Error;
      if (verbose) {
        console.error(info(`Tool sanitization proxy disabled: ${err.message}`));
      }
    }
  }

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    ...envVars,
    ...(effectiveBaseUrl ? { ANTHROPIC_BASE_URL: effectiveBaseUrl } : {}),
  };

  if (process.env.CCS_DEBUG === '1') {
    console.error(info(`Settings flow ANTHROPIC_BASE_URL=${env.ANTHROPIC_BASE_URL || ''}`));
  }

  let sessionSettingsPath = settingsPath;

  const anthropicOverrides = Object.fromEntries(
    Object.entries(envVars).filter(
      ([key, value]) => key.startsWith('ANTHROPIC_') && typeof value === 'string'
    )
  ) as Record<string, string>;
  if (effectiveBaseUrl) {
    anthropicOverrides.ANTHROPIC_BASE_URL = effectiveBaseUrl;
  }

  try {
    const rawSettings = fs.readFileSync(settingsPath, 'utf8');
    const parsedSettings = JSON.parse(rawSettings) as { env?: Record<string, string> };

    const sessionSettings = {
      ...parsedSettings,
      env: { ...(parsedSettings.env || {}), ...anthropicOverrides },
    };

    sessionSettingsPath = path.join(
      os.tmpdir(),
      `ccs-tool-sanitize-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.settings.json`
    );

    fs.writeFileSync(sessionSettingsPath, JSON.stringify(sessionSettings, null, 2) + '\n', 'utf8');
  } catch (error) {
    sessionSettingsPath = settingsPath;
    if (verbose) {
      const err = error as Error;
      console.error(info(`Session settings fallback to original file: ${err.message}`));
    }
  }

  const cleanupSessionSettings = (): void => {
    if (sessionSettingsPath === settingsPath) return;
    try {
      if (fs.existsSync(sessionSettingsPath)) fs.unlinkSync(sessionSettingsPath);
    } catch {
      /* ignore */
    }
  };

  // 代理仪表盘
  if (meta) {
    printProxyDashboard(meta, keepalivePort, sanitizerPort);
  }

  const isWindows = process.platform === 'win32';
  const needsShell = isWindows && /\.(cmd|bat|ps1)$/i.test(claudeCli);

  let claude: ChildProcess;
  if (needsShell) {
    const cmdString = [claudeCli, '--settings', sessionSettingsPath, ...args]
      .map(escapeShellArg)
      .join(' ');
    claude = spawn(cmdString, { stdio: 'inherit', windowsHide: true, shell: true, env });
  } else {
    claude = spawn(claudeCli, ['--settings', sessionSettingsPath, ...args], {
      stdio: 'inherit',
      windowsHide: true,
      env,
    });
  }

  const stopProxy = (): void => {
    if (toolSanitizationProxy) toolSanitizationProxy.stop();
    // keepalive daemon 设计为跨会话存活，不在 Claude 退出时停止
  };

  claude.on('exit', (code, signal) => {
    stopProxy();
    cleanupSessionSettings();
    if (signal) process.kill(process.pid, signal as NodeJS.Signals);
    else process.exit(code || 0);
  });

  claude.on('error', (error) => {
    console.error(fail(`Claude CLI error: ${error}`));
    stopProxy();
    cleanupSessionSettings();
    process.exit(1);
  });

  process.once('SIGTERM', () => {
    stopProxy();
    cleanupSessionSettings();
    claude.kill('SIGTERM');
  });
  process.once('SIGINT', () => {
    stopProxy();
    cleanupSessionSettings();
    claude.kill('SIGTERM');
  });
}

// ========== Main ==========

interface ProfileError extends Error {
  profileName?: string;
  availableProfiles?: string;
  suggestions?: string[];
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const firstArg = args[0];

  // 初始化 UI
  if (process.stdout.isTTY && !process.env['CI']) {
    await initUI();
  }

  // 子命令路由：只保留 api
  if (firstArg === 'api') {
    const { handleApiCommand } = await import('./commands/api-command');
    await handleApiCommand(args.slice(1));
    return;
  }

  // 检测 profile
  const { profile, remainingArgs } = detectProfile(args);

  // 自动委托：profile + prompt → DelegationHandler
  if (remainingArgs.length > 0 && !remainingArgs[0].startsWith('-') && profile !== 'default') {
    const { DelegationHandler } = await import('./delegation/delegation-handler');
    const handler = new DelegationHandler();
    const delegationArgs = [profile, remainingArgs[0], ...remainingArgs.slice(1)];
    await handler.route(delegationArgs);
    return;
  }

  // 检测 Claude CLI
  const claudeCli = detectClaudeCli();
  if (!claudeCli) {
    await ErrorManager.showClaudeNotFound();
    process.exit(1);
  }

  // Profile 类型检测
  const ProfileDetectorModule = await import('./config/profile-detector');
  const ProfileDetector = ProfileDetectorModule.default;
  const detector = new ProfileDetector();

  try {
    const profileInfo = detector.detectProfileType(profile);

    if (profileInfo.type === 'settings') {
      // GLMT: 内嵌代理
      if (profileInfo.name === 'glmt') {
        await execClaudeWithProxy(claudeCli, profileInfo.name, remainingArgs);
      } else if (profileInfo.protocol === 'openai') {
        await execClaudeWithOpenAIProxy(claudeCli, profileInfo.name, remainingArgs, false);
      } else if (profileInfo.protocol === 'openai-responses') {
        await execClaudeWithOpenAIProxy(claudeCli, profileInfo.name, remainingArgs, true);
      } else {
        // 普通 settings profile: 工具名清洗代理
        const expandedSettingsPath = getSettingsPath(profileInfo.name);
        const globalEnvConfig = getGlobalEnvConfig();
        const globalEnv = globalEnvConfig.enabled ? globalEnvConfig.env : {};

        const settings = loadSettings(expandedSettingsPath);
        const settingsEnv = settings.env || {};

        // 缓存保活：确保 daemon 以正确 upstream 运行，重写 BASE_URL 到本地代理
        const verbose = remainingArgs.includes('--verbose') || remainingArgs.includes('-v');
        const upstreamUrl = settingsEnv.ANTHROPIC_BASE_URL || '';
        let keepalivePort: number | null = null;
        if (profileInfo.cacheKeepalive && settingsEnv.ANTHROPIC_BASE_URL) {
          const keepaliveManager = new CacheKeepaliveManager();
          keepalivePort = await keepaliveManager.ensureRunning(
            settingsEnv.ANTHROPIC_BASE_URL,
            verbose
          );
          if (keepalivePort) {
            settingsEnv.ANTHROPIC_BASE_URL = `http://127.0.0.1:${keepalivePort}`;
          }
        }

        // 如果 BASE_URL 指向本地 cliproxy，确保它在运行
        await ensureCliproxyIfNeeded(settingsEnv, verbose);

        const envVars: NodeJS.ProcessEnv = {
          ...globalEnv,
          ...settingsEnv,
          CCS_PROFILE_TYPE: 'settings',
        };
        await execClaudeWithToolSanitizationProxy(
          claudeCli,
          expandedSettingsPath,
          remainingArgs,
          envVars,
          keepalivePort,
          { profileName: profileInfo.name, upstreamUrl }
        );
      }
    } else {
      // DEFAULT: 使用 Claude 原生认证
      execClaude(claudeCli, remainingArgs, { CCS_PROFILE_TYPE: 'default' });
    }
  } catch (error) {
    const err = error as ProfileError;
    if (err.profileName && err.availableProfiles !== undefined) {
      // Profile 未找到 — 简单报错
      await ErrorManager.showProfileNotFound(
        err.profileName,
        (err.availableProfiles || '').split('\n'),
        err.suggestions
      );
      process.exit(1);
    } else {
      console.error(fail(err.message));
      process.exit(1);
    }
  }
}

// ========== Global Error Handlers ==========

process.on('uncaughtException', (error: Error) => {
  handleError(error);
});
process.on('unhandledRejection', (reason: unknown) => {
  handleError(reason);
});
process.on('SIGTERM', () => {
  runCleanup();
  process.exit(0);
});
process.on('SIGINT', () => {
  runCleanup();
  process.exit(130);
});

main().catch(handleError);
