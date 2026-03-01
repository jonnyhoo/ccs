/**
 * cache-keepalive-proxy — CCS 一等代理模块
 *
 * 透传代理 + 空闲保活：
 *   Claude Code → proxy(:PORT) → 上游（原始字节透传）
 *   空闲 4 分钟自动发保活请求，刷新 Anthropic 侧 5min TTL
 *   10 分钟无请求自动退出
 *
 * 自包含约束：运行时只依赖 Node.js 内置模块。
 * 独立启动：CACHE_PROXY_UPSTREAM=<url> node cache-keepalive-proxy.js --daemon
 */

import * as http from 'http';
import * as https from 'https';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { URL } from 'url';

import type {
  KeepaliveStats,
  ModelStats,
  PrefixChangeRecord,
  CapturedPrefix,
  DaemonConfig,
  PricingModel,
  CostEstimate,
} from './cache-keepalive-types';

// ─── 常量 ────────────────────────────────────────────────────────────────────

const PRICING: PricingModel = {
  input: 3.0,
  cacheRead: 0.3,
  cacheWrite: 3.75,
  output: 15.0,
};

const STATS_SAVE_INTERVAL_MS = 30000;
const MAX_PREFIX_CHANGES = 20;

// ─── CacheKeepaliveProxy ──────────────────────────────────────────────────────

export class CacheKeepaliveProxy {
  private readonly config: DaemonConfig;
  private readonly upstream: URL;
  private readonly httpMod: typeof http | typeof https;
  private readonly statsFile: string;
  private readonly logFile: string;
  private readonly pidFile: string;

  private lastPrefix: CapturedPrefix | null = null;
  private lastPrefixHash: string | null = null;
  private keepaliveTimer: NodeJS.Timeout | null = null;
  private autoExitTimer: NodeJS.Timeout | null = null;
  private statsDirty = false;
  private statsSaveTimer: NodeJS.Timeout | null = null;
  private sessionStartTime = Date.now();
  private stats: KeepaliveStats;

  constructor(config: DaemonConfig) {
    this.config = config;
    this.upstream = new URL(config.upstreamUrl);
    this.httpMod = this.upstream.protocol === 'https:' ? https : http;
    this.statsFile = path.join(os.tmpdir(), `cache-keepalive-${config.port}-stats.json`);
    this.logFile = path.join(os.tmpdir(), `cache-keepalive-${config.port}.log`);
    this.pidFile = path.join(os.tmpdir(), `cache-keepalive-${config.port}.pid`);
    this.stats = this.loadStats();
  }

  // ─── 启动 ───────────────────────────────────────────────────────────────────

  start(): void {
    this.killStaleDaemon();

    const server = http.createServer((cReq, cRes) => {
      const url = cReq.url ?? '/';

      if (cReq.method === 'GET' && url === '/health') {
        cRes.writeHead(200, { 'content-type': 'application/json' });
        cRes.end(
          JSON.stringify({
            service: 'cache-keepalive',
            status: 'ok',
            upstream: this.config.upstreamUrl,
          })
        );
        return;
      }

      if (cReq.method === 'GET' && url === '/_health') {
        this.handleHealth(cRes);
        return;
      }

      if (cReq.method === 'GET' && url === '/_stats') {
        this.handleStats(cRes);
        return;
      }

      if (cReq.method === 'POST' && url === '/_stop') {
        cRes.writeHead(200, { 'content-type': 'application/json' });
        cRes.end(JSON.stringify({ status: 'stopping' }));
        this.gracefulExit('/_stop');
        return;
      }

      const chunks: Buffer[] = [];
      cReq.on('data', (chunk: Buffer) => chunks.push(chunk));
      cReq.on('end', () => {
        this.stats.reqs++;
        const raw = Buffer.concat(chunks);
        let requestModel: string | null = null;
        const contentType = cReq.headers['content-type'] ?? '';
        if (cReq.method === 'POST' && contentType.includes('json')) {
          this.capturePrefix(raw, cReq.headers);
          try {
            const parsed = JSON.parse(raw.toString('utf8')) as Record<string, unknown>;
            requestModel = typeof parsed['model'] === 'string' ? parsed['model'] : null;
          } catch {
            /* ignore parse error */
          }
        }
        this.forward(cReq, raw, cRes, requestModel);
      });
    });

    server.listen(this.config.port, '127.0.0.1', () => {
      this.writePid(process.pid);
      this.log(
        `proxy listening on 127.0.0.1:${this.config.port} → ${this.config.upstreamUrl} (pid ${process.pid})`
      );
      this.resetAutoExit();
    });

    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        this.log(`port ${this.config.port} in use, exit`);
        process.exit(0);
      }
      this.log(`server error: ${err.message}`);
    });

    process.on('SIGINT', () => this.gracefulExit('SIGINT'));
    process.on('SIGTERM', () => this.gracefulExit('SIGTERM'));
  }

  // ─── 统计持久化 ──────────────────────────────────────────────────────────────

  private makeEmptyStats(): KeepaliveStats {
    return {
      reqs: 0,
      pings: 0,
      ok: 0,
      errs: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      inputTokens: 0,
      outputTokens: 0,
      prefixChanges: 0,
      startTime: Date.now(),
      byModel: {},
      recentPrefixChanges: [],
    };
  }

  private loadStats(): KeepaliveStats {
    try {
      const raw = fs.readFileSync(this.statsFile, 'utf8');
      const loaded = JSON.parse(raw) as Partial<KeepaliveStats>;
      const empty = this.makeEmptyStats();
      return { ...empty, ...loaded };
    } catch {
      return this.makeEmptyStats();
    }
  }

  private saveStats(): void {
    try {
      fs.writeFileSync(this.statsFile, JSON.stringify(this.stats, null, 2));
      this.statsDirty = false;
    } catch (err) {
      this.log(`stats save err: ${(err as Error).message}`);
    }
  }

  private markStatsDirty(): void {
    this.statsDirty = true;
    if (!this.statsSaveTimer) {
      this.statsSaveTimer = setTimeout(() => {
        this.statsSaveTimer = null;
        if (this.statsDirty) this.saveStats();
      }, STATS_SAVE_INTERVAL_MS);
    }
  }

  // ─── 日志 ────────────────────────────────────────────────────────────────────

  private log(msg: string): void {
    const line = `[${new Date().toISOString().slice(11, 19)}] ${msg}\n`;
    fs.appendFileSync(this.logFile, line);
  }

  // ─── PID 文件 ────────────────────────────────────────────────────────────────

  private readPid(): number | null {
    try {
      return parseInt(fs.readFileSync(this.pidFile, 'utf8').trim(), 10) || null;
    } catch {
      return null;
    }
  }

  private writePid(pid: number): void {
    fs.writeFileSync(this.pidFile, String(pid));
  }

  private removePid(): void {
    try {
      fs.unlinkSync(this.pidFile);
    } catch {
      /* ignore */
    }
  }

  private killStaleDaemon(): void {
    const pid = this.readPid();
    if (!pid) return;
    try {
      process.kill(pid, 0); // throws if not alive
      process.kill(pid, 'SIGTERM');
    } catch {
      /* already gone */
    }
    this.removePid();
  }

  // ─── 前缀捕获 ────────────────────────────────────────────────────────────────

  private computePrefixHash(model: string, system: unknown, tools: unknown): string {
    const content = JSON.stringify({ model, system: system ?? null, tools: tools ?? null });
    return crypto.createHash('md5').update(content).digest('hex').slice(0, 12);
  }

  private capturePrefix(raw: Buffer, headers: http.IncomingHttpHeaders): void {
    try {
      const parsed = JSON.parse(raw.toString('utf8')) as Record<string, unknown>;
      const model = parsed['model'];
      if (typeof model !== 'string') return;

      const newHash = this.computePrefixHash(model, parsed['system'], parsed['tools']);
      const prefixChanged = this.lastPrefixHash !== null && newHash !== this.lastPrefixHash;

      if (prefixChanged) {
        this.stats.prefixChanges++;
        const record: PrefixChangeRecord = {
          time: new Date().toISOString(),
          from: this.lastPrefixHash,
          to: newHash,
          model,
        };
        this.stats.recentPrefixChanges.push(record);
        if (this.stats.recentPrefixChanges.length > MAX_PREFIX_CHANGES) {
          this.stats.recentPrefixChanges.shift();
        }
        this.log(`prefix changed: ${this.lastPrefixHash} → ${newHash}`);
        this.markStatsDirty();
      }

      this.lastPrefixHash = newHash;
      const apiKey =
        (headers['x-api-key'] as string | undefined) ??
        (headers['authorization'] as string | undefined) ??
        '';
      this.lastPrefix = {
        model,
        system: parsed['system'],
        tools: parsed['tools'],
        apiKey,
        ver: (headers['anthropic-version'] as string | undefined) ?? '2023-06-01',
        beta: headers['anthropic-beta'] as string | undefined,
      };
      this.onClientActivity();
    } catch {
      /* ignore malformed JSON */
    }
  }

  // ─── SSE token 采集 ──────────────────────────────────────────────────────────

  private parseSSETokenUsage(proxyRes: http.IncomingMessage, model: string | null): void {
    let sseBuffer = '';
    proxyRes.on('data', (chunk: Buffer) => {
      sseBuffer += chunk.toString('utf8');
      let newlineIdx: number;
      while ((newlineIdx = sseBuffer.indexOf('\n')) !== -1) {
        const line = sseBuffer.slice(0, newlineIdx).trim();
        sseBuffer = sseBuffer.slice(newlineIdx + 1);
        if (!line.startsWith('data: ')) continue;
        const payload = line.slice(6);
        if (payload === '[DONE]') continue;
        try {
          const event = JSON.parse(payload) as Record<string, unknown>;
          this.extractTokens(event, model ?? 'unknown');
        } catch {
          /* ignore malformed SSE */
        }
      }
    });
  }

  private extractTokens(event: Record<string, unknown>, modelKey: string): void {
    if (event['type'] === 'message_start') {
      const message = event['message'] as Record<string, unknown> | undefined;
      const usage = message?.['usage'] as Record<string, unknown> | undefined;
      if (!usage) return;

      const cacheRead = (usage['cache_read_input_tokens'] as number | undefined) ?? 0;
      const cacheWrite = (usage['cache_creation_input_tokens'] as number | undefined) ?? 0;
      const input = (usage['input_tokens'] as number | undefined) ?? 0;

      this.stats.cacheReadTokens += cacheRead;
      this.stats.cacheWriteTokens += cacheWrite;
      this.stats.inputTokens += input;

      if (!this.stats.byModel[modelKey]) {
        this.stats.byModel[modelKey] = {
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
          inputTokens: 0,
          outputTokens: 0,
          reqs: 0,
        } satisfies ModelStats;
      }
      const modelStats = this.stats.byModel[modelKey];
      modelStats.cacheReadTokens += cacheRead;
      modelStats.cacheWriteTokens += cacheWrite;
      modelStats.inputTokens += input;
      modelStats.reqs++;

      if (cacheRead > 0) {
        this.log(`cache hit: ${cacheRead} read, ${cacheWrite} write, ${input} input`);
      }
      this.markStatsDirty();
    }

    if (event['type'] === 'message_delta') {
      const usage = event['usage'] as Record<string, unknown> | undefined;
      const output = (usage?.['output_tokens'] as number | undefined) ?? 0;
      this.stats.outputTokens += output;
      const modelStats = this.stats.byModel[modelKey];
      if (modelStats) modelStats.outputTokens += output;
      this.markStatsDirty();
    }
  }

  // ─── 成本 / 命中率 ───────────────────────────────────────────────────────────

  private computeCostEstimate(): CostEstimate {
    const savedPerToken = (PRICING.input - PRICING.cacheRead) / 1e6;
    const overheadPerToken = (PRICING.cacheWrite - PRICING.input) / 1e6;
    const pingCostPerPing = (50000 * PRICING.cacheRead) / 1e6;

    const saved = this.stats.cacheReadTokens * savedPerToken;
    const overhead = this.stats.cacheWriteTokens * overheadPerToken;
    const pingCost = this.stats.pings * pingCostPerPing;

    return {
      saved: parseFloat(saved.toFixed(4)),
      overhead: parseFloat(overhead.toFixed(4)),
      pingCost: parseFloat(pingCost.toFixed(4)),
      netSaved: parseFloat((saved - overhead - pingCost).toFixed(4)),
      currency: 'USD',
      pricing: PRICING,
    };
  }

  private computeCacheHitRate(): number {
    const total = this.stats.cacheReadTokens + this.stats.cacheWriteTokens + this.stats.inputTokens;
    if (total === 0) return 0;
    return parseFloat(((this.stats.cacheReadTokens / total) * 100).toFixed(2));
  }

  // ─── 定时器 ──────────────────────────────────────────────────────────────────

  private resetKeepalive(): void {
    if (this.keepaliveTimer) clearTimeout(this.keepaliveTimer);
    this.keepaliveTimer = setTimeout(() => this.sendPing(), this.config.keepaliveMs);
  }

  private resetAutoExit(): void {
    if (this.autoExitTimer) clearTimeout(this.autoExitTimer);
    this.autoExitTimer = setTimeout(() => {
      if (this.statsDirty) this.saveStats();
      this.removePid();
      this.log(`idle ${this.config.autoExitMs / 60000}min, exit`);
      process.exit(0);
    }, this.config.autoExitMs);
  }

  private onClientActivity(): void {
    this.resetKeepalive();
    this.resetAutoExit();
  }

  // ─── 保活 Ping ───────────────────────────────────────────────────────────────

  private sendPing(): void {
    if (!this.lastPrefix) return;

    const prefix = this.lastPrefix;
    const body: Record<string, unknown> = {
      model: prefix.model,
      max_tokens: 1,
      stream: true,
      messages: [{ role: 'user', content: 'ping' }],
    };
    if (prefix.system !== undefined) body['system'] = prefix.system;
    if (prefix.tools !== undefined) body['tools'] = prefix.tools;

    const payload = Buffer.from(JSON.stringify(body));
    const headers: Record<string, string | number> = {
      'content-type': 'application/json',
      'content-length': payload.length,
      host: this.upstream.host,
      'anthropic-version': prefix.ver,
    };
    if (prefix.beta) headers['anthropic-beta'] = prefix.beta;
    if (prefix.apiKey.startsWith('Bearer ')) {
      headers['authorization'] = prefix.apiKey;
    } else if (prefix.apiKey) {
      headers['x-api-key'] = prefix.apiKey;
    }

    this.stats.pings++;

    const req = this.httpMod.request(
      {
        hostname: this.upstream.hostname,
        port: this.upstream.port || (this.upstream.protocol === 'https:' ? 443 : 80),
        path: this.upstream.pathname.replace(/\/$/, '') + '/v1/messages',
        method: 'POST',
        headers,
      },
      (res) => {
        this.parseSSETokenUsage(res, prefix.model);
        res.on('end', () => {
          if (res.statusCode === 200) {
            this.stats.ok++;
            this.log('ping ok');
            this.resetAutoExit();
          } else {
            this.stats.errs++;
            this.log(`ping ${res.statusCode ?? 'unknown'}`);
          }
          this.markStatsDirty();
          this.resetKeepalive();
        });
        res.resume();
      }
    );

    req.on('error', (err: Error) => {
      this.stats.errs++;
      this.log(`ping err: ${err.message} → upstream ${this.upstream.host}`);
      this.markStatsDirty();
      this.resetKeepalive();
    });

    req.write(payload);
    req.end();
  }

  // ─── HTTP 端点 ───────────────────────────────────────────────────────────────

  private handleHealth(cRes: http.ServerResponse): void {
    const body = JSON.stringify(
      {
        status: 'ok',
        upstream: this.config.upstreamUrl,
        hasPrefix: !!this.lastPrefix,
        model: this.lastPrefix?.model ?? null,
        prefixHash: this.lastPrefixHash,
        uptime: Math.floor(process.uptime()),
        stats: {
          reqs: this.stats.reqs,
          pings: this.stats.pings,
          ok: this.stats.ok,
          errs: this.stats.errs,
          prefixChanges: this.stats.prefixChanges,
        },
        tokens: {
          cacheRead: this.stats.cacheReadTokens,
          cacheWrite: this.stats.cacheWriteTokens,
          input: this.stats.inputTokens,
          output: this.stats.outputTokens,
        },
        cacheHitRate: this.computeCacheHitRate(),
        costEstimate: this.computeCostEstimate(),
      },
      null,
      2
    );
    cRes.writeHead(200, { 'content-type': 'application/json' });
    cRes.end(body);
  }

  private handleStats(cRes: http.ServerResponse): void {
    const sessionUptime = Date.now() - this.sessionStartTime;
    const totalUptime = Date.now() - this.stats.startTime;

    const body = JSON.stringify(
      {
        session: {
          startTime: new Date(this.sessionStartTime).toISOString(),
          uptimeSeconds: Math.floor(sessionUptime / 1000),
        },
        cumulative: {
          startTime: new Date(this.stats.startTime).toISOString(),
          uptimeSeconds: Math.floor(totalUptime / 1000),
          reqs: this.stats.reqs,
          pings: this.stats.pings,
          ok: this.stats.ok,
          errs: this.stats.errs,
        },
        tokens: {
          cacheRead: this.stats.cacheReadTokens,
          cacheWrite: this.stats.cacheWriteTokens,
          input: this.stats.inputTokens,
          output: this.stats.outputTokens,
          total:
            this.stats.cacheReadTokens +
            this.stats.cacheWriteTokens +
            this.stats.inputTokens +
            this.stats.outputTokens,
        },
        cacheHitRate: this.computeCacheHitRate(),
        costEstimate: this.computeCostEstimate(),
        byModel: this.stats.byModel,
        prefixTracking: {
          currentHash: this.lastPrefixHash,
          totalChanges: this.stats.prefixChanges,
          recentChanges: this.stats.recentPrefixChanges,
        },
        statsFile: this.statsFile,
      },
      null,
      2
    );
    cRes.writeHead(200, { 'content-type': 'application/json' });
    cRes.end(body);
  }

  // ─── 透传转发 ────────────────────────────────────────────────────────────────

  private forward(
    cReq: http.IncomingMessage,
    rawBody: Buffer,
    cRes: http.ServerResponse,
    requestModel: string | null
  ): void {
    const targetPath = this.upstream.pathname.replace(/\/$/, '') + (cReq.url ?? '/');
    const fwdHeaders: http.OutgoingHttpHeaders = { ...cReq.headers, host: this.upstream.host };
    delete fwdHeaders['connection'];

    const proxyReq = this.httpMod.request(
      {
        hostname: this.upstream.hostname,
        port: this.upstream.port || (this.upstream.protocol === 'https:' ? 443 : 80),
        path: targetPath,
        method: cReq.method,
        headers: fwdHeaders,
      },
      (proxyRes) => {
        cRes.writeHead(proxyRes.statusCode ?? 200, proxyRes.headers);

        const isSSE = (proxyRes.headers['content-type'] ?? '').includes('text/event-stream');
        if (isSSE && proxyRes.statusCode === 200) {
          this.parseSSETokenUsage(proxyRes, requestModel ?? this.lastPrefix?.model ?? null);
        }

        proxyRes.pipe(cRes, { end: true });
      }
    );

    proxyReq.on('error', (err: Error & { code?: string }) => {
      this.log(`forward err: ${err.message}`);
      if (!cRes.headersSent) {
        const errBody = JSON.stringify({
          type: 'error',
          error: {
            type: 'proxy_error',
            message:
              `[cache-keepalive] upstream ${this.upstream.host} unreachable: ` +
              `${err.code ?? err.message}`,
          },
        });
        cRes.writeHead(502, {
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(errBody),
        });
        cRes.end(errBody);
      } else if (!cRes.writableEnded) {
        cRes.end();
      }
    });

    proxyReq.setTimeout(30000, () => {
      proxyReq.destroy();
      this.log(`forward timeout: ${this.upstream.host}`);
      if (!cRes.headersSent) {
        const errBody = JSON.stringify({
          type: 'error',
          error: {
            type: 'proxy_timeout',
            message: `[cache-keepalive] upstream ${this.upstream.host} timeout after 30s`,
          },
        });
        cRes.writeHead(504, {
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(errBody),
        });
        cRes.end(errBody);
      }
    });

    if (rawBody.length > 0) proxyReq.write(rawBody);
    proxyReq.end();
    this.resetAutoExit();
  }

  // ─── 退出 ────────────────────────────────────────────────────────────────────

  private gracefulExit(signal: string): void {
    if (this.statsDirty) this.saveStats();
    this.removePid();
    this.log(`${signal}, exit`);
    process.exit(0);
  }
}

// ─── 独立启动入口 ─────────────────────────────────────────────────────────────

if (require.main === module) {
  if (process.argv.includes('--daemon')) {
    const upstreamUrl =
      process.env['CACHE_PROXY_UPSTREAM'] ?? process.env['CACHE_UPSTREAM_URL'] ?? '';
    if (!upstreamUrl) {
      process.stderr.write('Error: CACHE_PROXY_UPSTREAM environment variable is required\n');
      process.exit(1);
    }

    const config: import('./cache-keepalive-types').DaemonConfig = {
      upstreamUrl,
      port: parseInt(process.env['CACHE_PROXY_PORT'] ?? '', 10) || 18621,
      keepaliveMs: 240000,
      autoExitMs: 600000,
    };

    new CacheKeepaliveProxy(config).start();
  } else {
    process.stderr.write(
      'Usage: CACHE_PROXY_UPSTREAM=<url> node cache-keepalive-proxy.js --daemon\n'
    );
    process.exit(1);
  }
}
