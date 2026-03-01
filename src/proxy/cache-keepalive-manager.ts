/**
 * CacheKeepaliveManager — CCS 侧生命周期管理
 *
 * 负责探测、启动、验证、重启 cache-keepalive daemon。
 * 核心改进：ensureRunning() 会校验正在运行的 daemon 的 upstream 是否匹配，
 * 不匹配则自动重启，避免不同 profile 错误共用同一 daemon。
 */

import * as http from 'http';
import * as net from 'net';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';

import type { HealthResponse } from './cache-keepalive-types';

const DEFAULT_PORT = parseInt(process.env['CACHE_PROXY_PORT'] ?? '', 10) || 18621;

export class CacheKeepaliveManager {
  readonly port: number;

  constructor(port: number = DEFAULT_PORT) {
    this.port = port;
  }

  /**
   * 确保 daemon 以正确的 upstream 运行。
   * - 若端口空闲：spawn 新 daemon
   * - 若端口已占用且 upstream 匹配：直接复用
   * - 若端口已占用但 upstream 不匹配：停止旧 daemon，spawn 新 daemon
   *
   * 返回本地代理端口，失败时返回 null（静默降级）。
   */
  async ensureRunning(upstreamUrl: string, verbose: boolean = false): Promise<number | null> {
    const isListening = await this.checkPort();

    if (isListening) {
      const health = await this.fetchHealth();
      if (health?.upstream === upstreamUrl) {
        if (verbose) console.error(`[keepalive] reusing daemon on :${this.port} → ${upstreamUrl}`);
        return this.port;
      }
      // upstream 不匹配，重启
      const actual = health?.upstream ?? 'unknown';
      if (verbose) {
        console.error(`[keepalive] upstream mismatch (was ${actual}, need ${upstreamUrl}), restarting`);
      }
      await this.stop();
      await new Promise<void>((resolve) => setTimeout(resolve, 500));
    }

    return this.spawnDaemon(upstreamUrl, verbose);
  }

  /**
   * 停止 daemon：优先 HTTP POST /_stop，失败则 SIGTERM PID 文件兜底。
   */
  async stop(): Promise<void> {
    const stopped = await this.httpStop();
    if (!stopped) {
      this.sigtermFallback();
    }
  }

  // ─── 内部工具 ──────────────────────────────────────────────────────────────

  private checkPort(): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = net.createConnection({ port: this.port, host: '127.0.0.1' }, () => {
        socket.destroy();
        resolve(true);
      });
      socket.on('error', () => {
        socket.destroy();
        resolve(false);
      });
      socket.setTimeout(1000, () => {
        socket.destroy();
        resolve(false);
      });
    });
  }

  private fetchHealth(): Promise<HealthResponse | null> {
    return new Promise((resolve) => {
      const req = http.get(
        `http://127.0.0.1:${this.port}/health`,
        { timeout: 2000 },
        (res) => {
          let data = '';
          res.on('data', (chunk: Buffer) => {
            data += chunk.toString();
          });
          res.on('end', () => {
            try {
              resolve(JSON.parse(data) as HealthResponse);
            } catch {
              resolve(null);
            }
          });
        }
      );
      req.on('error', () => resolve(null));
      req.on('timeout', () => {
        req.destroy();
        resolve(null);
      });
    });
  }

  private httpStop(): Promise<boolean> {
    return new Promise((resolve) => {
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port: this.port,
          path: '/_stop',
          method: 'POST',
          timeout: 3000,
        },
        (res) => {
          res.resume();
          resolve(res.statusCode === 200);
        }
      );
      req.on('error', () => resolve(false));
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });
      req.end();
    });
  }

  private sigtermFallback(): void {
    const pidFile = path.join(os.tmpdir(), `cache-keepalive-${this.port}.pid`);
    try {
      const pid = parseInt(fs.readFileSync(pidFile, 'utf8').trim(), 10);
      if (pid) process.kill(pid, 'SIGTERM');
    } catch {
      /* no PID file or process already gone */
    }
  }

  private async spawnDaemon(upstreamUrl: string, verbose: boolean): Promise<number | null> {
    const daemonScript = path.join(__dirname, 'cache-keepalive-proxy.js');
    if (!fs.existsSync(daemonScript)) {
      if (verbose) console.error(`[keepalive] daemon script not found: ${daemonScript}`);
      return null;
    }

    if (verbose) console.error(`[keepalive] spawning daemon → ${upstreamUrl}`);

    const child = spawn(process.execPath, [daemonScript, '--daemon'], {
      env: {
        ...process.env,
        CACHE_PROXY_UPSTREAM: upstreamUrl,
        CACHE_PROXY_PORT: String(this.port),
      },
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    });
    child.unref();

    // 等待端口就绪（最多 5 秒）
    const start = Date.now();
    while (Date.now() - start < 5000) {
      await new Promise<void>((resolve) => setTimeout(resolve, 200));
      if (await this.checkPort()) {
        if (verbose) console.error(`[keepalive] daemon ready on :${this.port}`);
        return this.port;
      }
    }

    if (verbose) console.error('[keepalive] daemon failed to start, continuing without it');
    return null;
  }
}
