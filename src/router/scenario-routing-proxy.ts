/**
 * Scenario Routing Proxy
 *
 * HTTP proxy that intercepts Anthropic API requests and routes them
 * to different upstream URLs based on detected scenario.
 *
 * Proxy chain position:
 * Claude CLI → ScenarioRoutingProxy → ToolSanitizationProxy → CLIProxy → Backend
 */

import * as http from 'http';
import * as https from 'https';
import * as fs from 'fs';
import * as os from 'os';
import { ScenarioRouter } from './scenario-router';
import { ScenarioType, ScenarioRouterConfig, AnthropicRequestBody } from './types';
import { CLIProxyProvider } from '../cliproxy/types';
import { loadOrCreateUnifiedConfig } from '../config/unified-config-loader';

/**
 * Upstream configuration for a scenario.
 */
export interface ScenarioUpstream {
  /** Base URL for the upstream (e.g., 'http://127.0.0.1:8317') */
  baseUrl: string;
  /** Additional headers to add (e.g., auth tokens) */
  headers?: Record<string, string>;
}

/**
 * Configuration for ScenarioRoutingProxy.
 */
export interface ScenarioRoutingProxyConfig {
  /** Scenario router configuration */
  routerConfig: ScenarioRouterConfig;
  /** Default upstream URL (used when no routing match) */
  defaultUpstream: string;
  /** Map of scenario type to upstream configuration */
  upstreams: Partial<Record<ScenarioType, ScenarioUpstream>>;
  /** Enable verbose logging */
  verbose?: boolean;
}

/**
 * Scenario Routing Proxy class.
 * Intercepts requests and routes them based on detected scenario.
 */
/**
 * Profile settings loaded from settings.json
 */
export interface ProfileSettings {
  baseUrl?: string;
  authToken?: string;
  /** Full env object from settings.json (includes ANTHROPIC_MODEL, etc.) */
  env: Record<string, string>;
}

/**
 * Load settings from a profile's settings.json file.
 * Returns the env vars including ANTHROPIC_BASE_URL, ANTHROPIC_AUTH_TOKEN, and all other env vars.
 */
export function loadProfileSettings(profileName: string): ProfileSettings | null {
  const config = loadOrCreateUnifiedConfig();
  const profileConfig = config.profiles?.[profileName];
  
  if (!profileConfig?.settings) {
    return null;
  }
  
  // Expand ~ to home directory
  const settingsPath = profileConfig.settings.replace(/^~/, os.homedir());
  
  if (!fs.existsSync(settingsPath)) {
    return null;
  }
  
  try {
    const content = fs.readFileSync(settingsPath, 'utf-8');
    const settings = JSON.parse(content);
    const env = settings.env || {};
    
    return {
      baseUrl: env.ANTHROPIC_BASE_URL,
      authToken: env.ANTHROPIC_AUTH_TOKEN,
      env,
    };
  } catch {
    return null;
  }
}

/**
 * Build scenario upstreams map from router config.
 * Supports both CLIProxy providers and settings-based profiles.
 *
 * For CLIProxy providers: Routes through the proxy chain with different provider paths
 * For settings-based profiles: Routes directly to the profile's configured endpoint
 *
 * @param routerConfig - Router configuration with scenario -> profile mappings
 * @param nextProxyBaseUrl - URL of the next proxy in chain (for CLIProxy providers)
 * @param currentProvider - Current provider being used (for default upstream)
 * @returns Map of scenario type to upstream configuration
 */
export function buildScenarioUpstreams(
  routerConfig: ScenarioRouterConfig,
  nextProxyBaseUrl: string,
  currentProvider: CLIProxyProvider
): { upstreams: Partial<Record<ScenarioType, ScenarioUpstream>>; defaultUpstream: string } {
  const upstreams: Partial<Record<ScenarioType, ScenarioUpstream>> = {};

  // Default upstream goes through the next proxy with current provider path
  const defaultUpstream = `${nextProxyBaseUrl}/api/provider/${currentProvider}`;

  // Known CLIProxy providers that can be used as route targets
  const validProviders: CLIProxyProvider[] = ['gemini', 'codex', 'agy', 'qwen', 'iflow', 'kiro', 'ghcp', 'claude'];

  // Build upstream for each configured route
  if (routerConfig.routes) {
    for (const [scenario, profile] of Object.entries(routerConfig.routes)) {
      // Option 1: CLIProxy provider - route through proxy chain
      if (validProviders.includes(profile as CLIProxyProvider)) {
        upstreams[scenario as ScenarioType] = {
          baseUrl: `${nextProxyBaseUrl}/api/provider/${profile}`,
        };
        continue;
      }
      
      // Option 2: Settings-based profile - route directly to its endpoint
      const profileSettings = loadProfileSettings(profile);
      if (profileSettings?.baseUrl) {
        upstreams[scenario as ScenarioType] = {
          baseUrl: profileSettings.baseUrl,
          // Include auth token if available
          headers: profileSettings.authToken
            ? { 'x-api-key': profileSettings.authToken, 'anthropic-api-key': profileSettings.authToken }
            : undefined,
        };
      }
    }
  }

  return { upstreams, defaultUpstream };
}

/**
 * Build scenario upstreams for settings-based profile entry point.
 * Used when the entry profile is a settings-based profile (not CLIProxy provider).
 *
 * @param routerConfig - Router configuration with scenario -> profile mappings
 * @param entryProfileName - The entry profile name (e.g., 'zz166')
 * @returns Map of scenario type to upstream configuration, or null if routing not configured
 */
export function buildSettingsUpstreams(
  routerConfig: ScenarioRouterConfig,
  entryProfileName: string
): { 
  upstreams: Partial<Record<ScenarioType, ScenarioUpstream>>; 
  defaultUpstream: ScenarioUpstream;
  /** Full env from entry profile's settings.json */
  entryProfileEnv: Record<string, string>;
} | null {
  // Load entry profile settings for default upstream
  const entrySettings = loadProfileSettings(entryProfileName);
  if (!entrySettings?.baseUrl) {
    return null;
  }

  const defaultUpstream: ScenarioUpstream = {
    baseUrl: entrySettings.baseUrl,
    headers: entrySettings.authToken
      ? { 'x-api-key': entrySettings.authToken, 'anthropic-api-key': entrySettings.authToken }
      : undefined,
  };

  const upstreams: Partial<Record<ScenarioType, ScenarioUpstream>> = {};

  // Build upstream for each configured route
  if (routerConfig.routes) {
    for (const [scenario, profile] of Object.entries(routerConfig.routes)) {
      // Skip 'default' route - handled by defaultUpstream
      if (scenario === 'default') continue;

      const profileSettings = loadProfileSettings(profile);
      if (profileSettings?.baseUrl) {
        upstreams[scenario as ScenarioType] = {
          baseUrl: profileSettings.baseUrl,
          headers: profileSettings.authToken
            ? { 'x-api-key': profileSettings.authToken, 'anthropic-api-key': profileSettings.authToken }
            : undefined,
        };
      }
    }
  }

  return { upstreams, defaultUpstream, entryProfileEnv: entrySettings.env };
}

export class ScenarioRoutingProxy {
  private server: http.Server | null = null;
  private port: number | null = null;
  private router: ScenarioRouter;
  private defaultUpstream: string;
  private upstreams: Map<ScenarioType, ScenarioUpstream>;
  private verbose: boolean;

  constructor(config: ScenarioRoutingProxyConfig) {
    this.router = new ScenarioRouter(config.routerConfig);
    this.defaultUpstream = config.defaultUpstream;
    this.upstreams = new Map(Object.entries(config.upstreams) as [ScenarioType, ScenarioUpstream][]);
    this.verbose = config.verbose ?? false;
  }

  /**
   * Log message if verbose mode is enabled.
   */
  private log(message: string): void {
    if (this.verbose) {
      console.error(`[scenario-routing-proxy] ${message}`);
    }
  }

  /**
   * Start the proxy server.
   * @returns The port number the proxy is listening on
   */
  async start(): Promise<number> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        this.handleRequest(req, res).catch((err) => {
          this.log(`Request error: ${err.message}`);
          if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Internal proxy error' }));
          }
        });
      });

      this.server.listen(0, '127.0.0.1', () => {
        const address = this.server?.address();
        this.port = typeof address === 'object' && address ? address.port : 0;
        this.log(`Scenario routing proxy active on port ${this.port}`);
        resolve(this.port);
      });

      this.server.on('error', (err) => reject(err));
    });
  }

  /**
   * Stop the proxy server.
   */
  stop(): void {
    if (this.server) {
      this.server.close();
      this.server = null;
      this.port = null;
    }
  }

  /**
   * Get the port the proxy is listening on.
   */
  getPort(): number | null {
    return this.port;
  }

  /**
   * Handle incoming request.
   */
  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    // Only intercept POST requests to /v1/messages
    const isMessagesEndpoint = req.url?.includes('/v1/messages') && req.method === 'POST';

    if (!isMessagesEndpoint) {
      // Pass through non-messages requests
      await this.forwardRequest(req, res, this.defaultUpstream);
      return;
    }

    // Collect request body
    const bodyChunks: Buffer[] = [];
    for await (const chunk of req) {
      bodyChunks.push(chunk);
    }
    const bodyBuffer = Buffer.concat(bodyChunks);

    // Try to parse body for scenario detection
    let body: AnthropicRequestBody | null = null;
    try {
      body = JSON.parse(bodyBuffer.toString('utf8'));
    } catch {
      this.log('Failed to parse request body, using default upstream');
    }

    // Detect scenario and get upstream
    let upstream = this.defaultUpstream;
    let extraHeaders: Record<string, string> = {};

    if (body && this.router.isEnabled()) {
      const scenario = this.router.detectScenario(body);
      const scenarioUpstream = this.upstreams.get(scenario);

      if (scenarioUpstream) {
        upstream = scenarioUpstream.baseUrl;
        extraHeaders = scenarioUpstream.headers ?? {};
        this.log(`Routing ${scenario} → ${upstream}`);
      } else {
        this.log(`No upstream for ${scenario}, using default`);
      }
    }

    // Forward request with collected body
    await this.forwardRequestWithBody(req, res, upstream, bodyBuffer, extraHeaders);
  }

  /**
   * Combine upstream base path with request path.
   * Ensures paths like /api/provider/gemini + /v1/messages = /api/provider/gemini/v1/messages
   */
  private combinePaths(upstreamPath: string, requestPath: string): string {
    // Remove trailing slash from upstream, leading slash from request (if both exist)
    const basePath = upstreamPath.replace(/\/$/, '');
    const reqPath = requestPath.startsWith('/') ? requestPath : '/' + requestPath;
    return basePath + reqPath;
  }

  /**
   * Forward request to upstream (streaming passthrough for non-messages).
   */
  private async forwardRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    upstream: string
  ): Promise<void> {
    const upstreamUrl = new URL(upstream);
    const isHttps = upstreamUrl.protocol === 'https:';
    const httpModule = isHttps ? https : http;

    // Combine upstream base path with request path
    const requestUrl = new URL(req.url ?? '/', 'http://dummy');
    const combinedPath = this.combinePaths(upstreamUrl.pathname, requestUrl.pathname);

    const proxyReq = httpModule.request(
      {
        hostname: upstreamUrl.hostname,
        port: upstreamUrl.port || (isHttps ? 443 : 80),
        path: combinedPath + requestUrl.search,
        method: req.method,
        headers: {
          ...req.headers,
          host: upstreamUrl.host,
        },
      },
      (proxyRes) => {
        res.writeHead(proxyRes.statusCode ?? 200, proxyRes.headers);
        proxyRes.pipe(res);
      }
    );

    proxyReq.on('error', (err) => {
      this.log(`Upstream error: ${err.message}`);
      if (!res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Upstream connection failed' }));
      }
    });

    req.pipe(proxyReq);
  }

  /**
   * Forward request to upstream with pre-collected body.
   */
  private async forwardRequestWithBody(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    upstream: string,
    body: Buffer,
    extraHeaders: Record<string, string> = {}
  ): Promise<void> {
    const upstreamUrl = new URL(upstream);
    const isHttps = upstreamUrl.protocol === 'https:';
    const httpModule = isHttps ? https : http;

    // Combine upstream base path with request path
    const requestUrl = new URL(req.url ?? '/', 'http://dummy');
    const combinedPath = this.combinePaths(upstreamUrl.pathname, requestUrl.pathname);

    const headers = {
      ...req.headers,
      ...extraHeaders,
      host: upstreamUrl.host,
      'content-length': body.length.toString(),
    };

    const proxyReq = httpModule.request(
      {
        hostname: upstreamUrl.hostname,
        port: upstreamUrl.port || (isHttps ? 443 : 80),
        path: combinedPath + requestUrl.search,
        method: req.method,
        headers,
      },
      (proxyRes) => {
        res.writeHead(proxyRes.statusCode ?? 200, proxyRes.headers);
        proxyRes.pipe(res);
      }
    );

    proxyReq.on('error', (err) => {
      this.log(`Upstream error: ${err.message}`);
      if (!res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Upstream connection failed' }));
      }
    });

    proxyReq.write(body);
    proxyReq.end();
  }
}
