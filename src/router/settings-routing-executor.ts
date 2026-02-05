/**
 * Settings-based Profile Executor with Scenario Routing
 *
 * Executes a settings-based profile through the ScenarioRoutingProxy,
 * enabling automatic routing of Claude's sub-agents to different profiles.
 *
 * Flow:
 * Claude CLI → ScenarioRoutingProxy → Target Profile Endpoint
 */

import { spawn, ChildProcess } from 'child_process';
import { ScenarioRoutingProxy, buildSettingsUpstreams, ScenarioUpstream } from './scenario-routing-proxy';
import { loadOrCreateUnifiedConfig } from '../config/unified-config-loader';
import { ScenarioRouterConfig } from './types';
import { escapeShellArg } from '../utils/shell-executor';

/**
 * Execute a settings-based profile with scenario routing enabled.
 *
 * @param claudeCli - Path to Claude CLI
 * @param profileName - The entry profile name
 * @param args - Additional CLI arguments
 * @param envOverrides - Environment variable overrides
 * @returns Exit code
 */
export async function execWithScenarioRouting(
  claudeCli: string,
  profileName: string,
  args: string[],
  envOverrides: NodeJS.ProcessEnv = {}
): Promise<number> {
  const config = loadOrCreateUnifiedConfig();
  const routerConfig = config.router as ScenarioRouterConfig;

  // Build upstreams from router config
  const routing = buildSettingsUpstreams(routerConfig, profileName);
  if (!routing) {
    console.error(`[scenario-router] Failed to load settings for profile: ${profileName}`);
    return 1;
  }

  // Log routing configuration
  const verbose = process.env.CCS_DEBUG === '1' || process.env.CCS_ROUTER_VERBOSE === '1';
  if (verbose) {
    console.error(`[scenario-router] Entry profile: ${profileName}`);
    console.error(`[scenario-router] Default → ${routing.defaultUpstream.baseUrl}`);
    for (const [scenario, upstream] of Object.entries(routing.upstreams)) {
      console.error(`[scenario-router] ${scenario} → ${(upstream as ScenarioUpstream).baseUrl}`);
    }
  }

  // Start scenario routing proxy
  const proxy = new ScenarioRoutingProxy({
    routerConfig,
    defaultUpstream: routing.defaultUpstream.baseUrl,
    upstreams: routing.upstreams,
    verbose,
  });

  const proxyPort = await proxy.start();

  // Always log router activation (brief, non-verbose)
  const routeCount = Object.keys(routing.upstreams).length;
  if (routeCount > 0) {
    console.error(`[i] Router: ${routeCount} scenario routes active`);
  }

  // Build environment for Claude CLI
  // Merge full profile env (ANTHROPIC_MODEL, etc.) then override BASE_URL for proxy
  const proxyUrl = `http://127.0.0.1:${proxyPort}`;
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    ...routing.entryProfileEnv, // Full profile env (ANTHROPIC_MODEL, etc.)
    ...envOverrides,
    // Override BASE_URL to route through proxy
    ANTHROPIC_BASE_URL: proxyUrl,
  };

  if (verbose) {
    console.error(`[scenario-router] Proxy listening on ${proxyUrl}`);
  }

  // Spawn Claude CLI with Windows compatibility
  const isWindows = process.platform === 'win32';
  const needsShell = isWindows && /\.(cmd|bat|ps1)$/i.test(claudeCli);

  return new Promise((resolve) => {
    let child: ChildProcess;

    if (needsShell) {
      // Windows: Use shell mode for .cmd/.bat files
      const cmdString = [claudeCli, ...args].map(escapeShellArg).join(' ');
      child = spawn(cmdString, {
        env,
        stdio: 'inherit',
        shell: true,
        windowsHide: true,
      });
    } else {
      child = spawn(claudeCli, args, {
        env,
        stdio: 'inherit',
        windowsHide: true,
      });
    }

    child.on('error', (err) => {
      console.error(`Failed to start Claude CLI: ${err.message}`);
      proxy.stop();
      resolve(1);
    });

    child.on('exit', (code) => {
      proxy.stop();
      resolve(code ?? 0);
    });

    // Handle signals
    const cleanup = () => {
      proxy.stop();
      child.kill();
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
  });
}
