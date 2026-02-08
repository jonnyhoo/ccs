#!/usr/bin/env node

/**
 * Bridge CCS background Claude execution to Redis Streams.
 *
 * Required env:
 * - CCS_BG_TASK_ID
 * - CCS_BG_REDIS_URL
 * - CCS_BG_STREAM_KEY
 * - CCS_BG_CLAUDE_CLI
 * - CCS_BG_CLAUDE_ARGS_B64 (base64 JSON array)
 *
 * Optional env:
 * - CCS_BG_CWD
 * - CCS_BG_TTL_SECONDS (default: 86400)
 */

const net = require('node:net');
const tls = require('node:tls');
const { spawn } = require('node:child_process');

const taskId = process.env.CCS_BG_TASK_ID;
const redisUrl = process.env.CCS_BG_REDIS_URL;
const streamKey = process.env.CCS_BG_STREAM_KEY;
const claudeCli = process.env.CCS_BG_CLAUDE_CLI;
const argsB64 = process.env.CCS_BG_CLAUDE_ARGS_B64;
const cwd = process.env.CCS_BG_CWD || process.cwd();
const ttlSeconds = parseInt(process.env.CCS_BG_TTL_SECONDS || '86400', 10);

if (!taskId || !redisUrl || !streamKey || !claudeCli || !argsB64) {
  process.exit(1);
}

let claudeArgs = [];
try {
  const decoded = Buffer.from(argsB64, 'base64').toString('utf8');
  const parsed = JSON.parse(decoded);
  claudeArgs = Array.isArray(parsed) ? parsed.map(String) : [];
} catch {
  process.exit(1);
}

function encodeBulk(value) {
  const str = String(value);
  return `$${Buffer.byteLength(str, 'utf8')}\r\n${str}\r\n`;
}

function encodeArray(parts) {
  let out = `*${parts.length}\r\n`;
  for (const part of parts) {
    out += encodeBulk(part);
  }
  return out;
}

function parseRedisUrl(input) {
  const u = new URL(input);
  const secure = u.protocol === 'rediss:';
  if (u.protocol !== 'redis:' && u.protocol !== 'rediss:') {
    throw new Error('Unsupported Redis protocol');
  }

  const db = u.pathname && u.pathname !== '/' ? parseInt(u.pathname.slice(1), 10) : 0;
  return {
    host: u.hostname || '127.0.0.1',
    port: u.port ? parseInt(u.port, 10) : 6379,
    secure,
    username: decodeURIComponent(u.username || ''),
    password: decodeURIComponent(u.password || ''),
    db: Number.isFinite(db) ? db : 0,
  };
}

class RedisClient {
  constructor(config) {
    this.config = config;
    this.socket = null;
    this.buffer = '';
    this.pending = [];
  }

  connect() {
    return new Promise((resolve, reject) => {
      const options = { host: this.config.host, port: this.config.port };
      const onConnect = async () => {
        try {
          await this._authAndSelect();
          resolve();
        } catch (err) {
          reject(err);
        }
      };

      this.socket = this.config.secure
        ? tls.connect({ ...options, servername: this.config.host }, onConnect)
        : net.createConnection(options, onConnect);

      this.socket.setEncoding('utf8');
      this.socket.on('data', (chunk) => this._onData(chunk));
      this.socket.on('error', (err) => {
        while (this.pending.length > 0) {
          const p = this.pending.shift();
          p.reject(err);
        }
      });
      this.socket.on('close', () => {
        while (this.pending.length > 0) {
          const p = this.pending.shift();
          p.reject(new Error('Redis connection closed'));
        }
      });
    });
  }

  async _authAndSelect() {
    if (this.config.password) {
      if (this.config.username) {
        await this.command('AUTH', this.config.username, this.config.password);
      } else {
        await this.command('AUTH', this.config.password);
      }
    }
    if (this.config.db > 0) {
      await this.command('SELECT', String(this.config.db));
    }
  }

  command(...parts) {
    return new Promise((resolve, reject) => {
      const payload = encodeArray(parts);
      this.pending.push({ resolve, reject });
      this.socket.write(payload);
    });
  }

  async xadd(fields) {
    const payload = ['XADD', streamKey, '*'];
    for (const [k, v] of Object.entries(fields)) {
      payload.push(k, v == null ? '' : String(v));
    }
    await this.command(...payload);
  }

  async expire(seconds) {
    await this.command('EXPIRE', streamKey, String(seconds));
  }

  _onData(chunk) {
    this.buffer += chunk;
    while (this.buffer.length > 0 && this.pending.length > 0) {
      const parsed = this._readOne(this.buffer);
      if (!parsed) {
        return;
      }
      this.buffer = parsed.rest;
      const pending = this.pending.shift();
      if (parsed.type === 'error') {
        pending.reject(new Error(parsed.value));
      } else {
        pending.resolve(parsed.value);
      }
    }
  }

  _readOne(input) {
    if (!input.length) return null;
    const marker = input[0];

    if (marker === '+' || marker === '-' || marker === ':') {
      const idx = input.indexOf('\r\n');
      if (idx === -1) return null;
      const value = input.slice(1, idx);
      return {
        type: marker === '-' ? 'error' : 'ok',
        value,
        rest: input.slice(idx + 2),
      };
    }

    if (marker === '$') {
      const idx = input.indexOf('\r\n');
      if (idx === -1) return null;
      const len = parseInt(input.slice(1, idx), 10);
      if (len === -1) {
        return { type: 'ok', value: null, rest: input.slice(idx + 2) };
      }
      const total = idx + 2 + len + 2;
      if (input.length < total) return null;
      const value = input.slice(idx + 2, idx + 2 + len);
      return { type: 'ok', value, rest: input.slice(total) };
    }

    if (marker === '*') {
      // For our command path, we do not need to parse nested arrays fully.
      // Consume minimal array response as opaque ok.
      const idx = input.indexOf('\r\n');
      if (idx === -1) return null;
      const count = parseInt(input.slice(1, idx), 10);
      if (count < 0) {
        return { type: 'ok', value: null, rest: input.slice(idx + 2) };
      }
      let rest = input.slice(idx + 2);
      for (let i = 0; i < count; i++) {
        const item = this._readOne(rest);
        if (!item) return null;
        rest = item.rest;
      }
      return { type: 'ok', value: 'array', rest };
    }

    return null;
  }

  close() {
    if (this.socket) {
      this.socket.end();
      this.socket.destroy();
      this.socket = null;
    }
  }
}

function splitLines(state, chunk, onLine) {
  state.buffer += chunk;
  const parts = state.buffer.split(/\r?\n/);
  state.buffer = parts.pop() || '';
  for (const p of parts) {
    onLine(p);
  }
}

async function run() {
  const config = parseRedisUrl(redisUrl);
  const redis = new RedisClient(config);
  await redis.connect();

  const startedAt = Date.now();
  await redis.xadd({
    type: 'status',
    event: 'started',
    task_id: taskId,
    ts: String(startedAt),
  });
  await redis.expire(ttlSeconds);

  const proc = spawn(claudeCli, claudeArgs, {
    cwd,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const stdoutState = { buffer: '' };
  const stderrState = { buffer: '' };

  proc.stdout.on('data', (buf) => {
    splitLines(stdoutState, buf.toString(), (line) => {
      if (!line.trim()) return;
      void redis
        .xadd({ type: 'stdout', task_id: taskId, ts: String(Date.now()), data: line })
        .catch(() => {});
    });
  });

  proc.stderr.on('data', (buf) => {
    splitLines(stderrState, buf.toString(), (line) => {
      if (!line.trim()) return;
      void redis
        .xadd({ type: 'stderr', task_id: taskId, ts: String(Date.now()), data: line })
        .catch(() => {});
    });
  });

  proc.on('close', async (code, signal) => {
    if (stdoutState.buffer.trim()) {
      await redis.xadd({
        type: 'stdout',
        task_id: taskId,
        ts: String(Date.now()),
        data: stdoutState.buffer,
      });
    }
    if (stderrState.buffer.trim()) {
      await redis.xadd({
        type: 'stderr',
        task_id: taskId,
        ts: String(Date.now()),
        data: stderrState.buffer,
      });
    }

    await redis.xadd({
      type: 'status',
      event: 'completed',
      task_id: taskId,
      ts: String(Date.now()),
      exit_code: String(code == null ? -1 : code),
      signal: signal || '',
      success: String((code || 0) === 0),
      duration_ms: String(Date.now() - startedAt),
    });
    await redis.expire(ttlSeconds);
    redis.close();
    process.exit((code || 0) === 0 ? 0 : 1);
  });

  proc.on('error', async (err) => {
    await redis.xadd({
      type: 'status',
      event: 'failed',
      task_id: taskId,
      ts: String(Date.now()),
      error: err.message,
    });
    await redis.expire(ttlSeconds);
    redis.close();
    process.exit(1);
  });
}

run().catch(() => process.exit(1));
