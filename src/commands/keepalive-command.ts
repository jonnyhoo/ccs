import * as http from 'http';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { initUI, header, subheader, color, dim, ok, warn, fail, infoBox } from '../utils/ui';
import { readFileTailLines } from '../utils/file-tail';

interface KeepaliveArgs {
  port: number;
  intervalSec: number;
  json: boolean;
}

interface LlmReportArgs {
  port: number;
  logLines: number;
}

interface KeepaliveHealth {
  status?: string;
  upstream?: string;
  hasPrefix?: boolean;
  model?: string | null;
  prefixHash?: string | null;
  cacheHitRate?: number;
  pingOkRate?: number;
  prefixChangesPerReq?: number;
  lastPingLatencyMs?: number | null;
  lastRequestAt?: string | null;
  paths?: {
    logFile?: string;
    statsFile?: string;
    pidFile?: string;
  };
  stats?: {
    reqs?: number;
    pings?: number;
    ok?: number;
    errs?: number;
    prefixChanges?: number;
  };
  costEstimate?: {
    saved?: number;
    overhead?: number;
    pingCost?: number;
    netSaved?: number;
    currency?: string;
  };
}

interface KeepaliveStats {
  cacheHitRate?: number;
  pingOkRate?: number;
  prefixChangesPerReq?: number;
  cumulative?: {
    reqs?: number;
    pings?: number;
    ok?: number;
    errs?: number;
    uptimeSeconds?: number;
  };
  tokens?: {
    cacheRead?: number;
    cacheWrite?: number;
    input?: number;
    output?: number;
    total?: number;
  };
  costEstimate?: {
    saved?: number;
    overhead?: number;
    pingCost?: number;
    netSaved?: number;
    currency?: string;
  };
  byModel?: Record<
    string,
    {
      cacheReadTokens?: number;
      cacheWriteTokens?: number;
      inputTokens?: number;
      outputTokens?: number;
      reqs?: number;
    }
  >;
  prefixTracking?: {
    totalChanges?: number;
    currentHash?: string | null;
  };
  activity?: {
    lastRequestAt?: string | null;
    lastPingLatencyMs?: number | null;
  };
  paths?: {
    logFile?: string;
    statsFile?: string;
    pidFile?: string;
  };
  statsFile?: string;
}

function parseArgs(args: string[]): KeepaliveArgs {
  const parsed: KeepaliveArgs = {
    port: parseInt(process.env.CACHE_PROXY_PORT ?? '', 10) || 18621,
    intervalSec: 3,
    json: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if ((arg === '--port' || arg === '-p') && args[i + 1]) {
      const next = parseInt(args[++i], 10);
      if (!Number.isNaN(next) && next > 0 && next <= 65535) parsed.port = next;
    } else if ((arg === '--interval' || arg === '-i') && args[i + 1]) {
      const next = parseInt(args[++i], 10);
      if (!Number.isNaN(next) && next >= 1 && next <= 60) parsed.intervalSec = next;
    } else if (arg === '--json') {
      parsed.json = true;
    }
  }

  return parsed;
}

function parseLlmReportArgs(args: string[]): LlmReportArgs {
  const base = parseArgs(args);
  const parsed: LlmReportArgs = {
    port: base.port,
    logLines: 120,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if ((arg === '--log-lines' || arg === '-n') && args[i + 1]) {
      const next = parseInt(args[++i], 10);
      if (!Number.isNaN(next) && next >= 20 && next <= 1000) parsed.logLines = next;
    }
  }

  return parsed;
}

async function fetchJson<T>(url: string, timeoutMs: number = 1800): Promise<T | null> {
  return new Promise((resolve) => {
    const req = http.get(url, { timeout: timeoutMs }, (res) => {
      let data = '';
      res.on('data', (chunk: Buffer) => {
        data += chunk.toString();
      });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data) as T);
        } catch {
          resolve(null);
        }
      });
    });

    req.on('error', () => resolve(null));
    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });
  });
}

function defaultStatsFile(port: number): string {
  return path.join(os.tmpdir(), `cache-keepalive-${port}-stats.json`);
}

function defaultLogFile(port: number): string {
  return path.join(os.tmpdir(), `cache-keepalive-${port}.log`);
}

function readStatsFile(port: number): KeepaliveStats | null {
  const file = defaultStatsFile(port);
  try {
    if (!fs.existsSync(file)) return null;
    const raw = fs.readFileSync(file, 'utf8');
    return JSON.parse(raw) as KeepaliveStats;
  } catch {
    return null;
  }
}

function readLogTail(logFile: string, maxLines: number): string[] {
  return readFileTailLines(logFile, maxLines);
}

function num(v: unknown, fallback: number = 0): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function pct(v: number): string {
  return `${v.toFixed(2)}%`;
}

function usd(v: number): string {
  return `$${v.toFixed(2)}`;
}

function ensureDerivedStats(stats: KeepaliveStats): void {
  if (typeof stats.pingOkRate !== 'number') {
    const pings = num(stats.cumulative?.pings);
    const okPings = num(stats.cumulative?.ok);
    stats.pingOkRate = pings > 0 ? parseFloat(((okPings / pings) * 100).toFixed(2)) : 0;
  }
  if (typeof stats.prefixChangesPerReq !== 'number') {
    const reqs = num(stats.cumulative?.reqs);
    const changes = num(stats.prefixTracking?.totalChanges);
    stats.prefixChangesPerReq = reqs > 0 ? parseFloat((changes / reqs).toFixed(3)) : 0;
  }
}

interface LlmIncident {
  type: string;
  severity: 'info' | 'warn' | 'error';
  count: number;
  latest: string | null;
}

function summarizeLogIncidents(lines: string[]): LlmIncident[] {
  const detectors: Array<{ type: string; severity: LlmIncident['severity']; re: RegExp }> = [
    { type: 'ping_error', severity: 'error', re: /ping err:/i },
    { type: 'timeout', severity: 'error', re: /timeout/i },
    { type: 'upstream_unreachable', severity: 'error', re: /unreachable/i },
    { type: 'prefix_churn_warning', severity: 'warn', re: /prefix churn high/i },
    { type: 'prefix_changed', severity: 'info', re: /prefix changed:/i },
    { type: 'cache_warmup', severity: 'info', re: /cache warmup/i },
  ];

  const summaries: LlmIncident[] = detectors.map((d) => ({
    type: d.type,
    severity: d.severity,
    count: 0,
    latest: null,
  }));

  for (const line of lines) {
    for (let i = 0; i < detectors.length; i++) {
      const d = detectors[i];
      if (d.re.test(line)) {
        summaries[i].count++;
        summaries[i].latest = line;
      }
    }
  }

  return summaries.filter((s) => s.count > 0);
}

function gradeFromStats(stats: KeepaliveStats): {
  grade: string;
  score: number;
  reasons: string[];
} {
  const reasons: string[] = [];
  let score = 100;

  const hit = num(stats.cacheHitRate);
  const pingOk = num(stats.pingOkRate);
  const churn = num(stats.prefixChangesPerReq);
  const netSaved = num(stats.costEstimate?.netSaved);
  const errs = num(stats.cumulative?.errs);
  const pings = num(stats.cumulative?.pings);

  if (hit < 60) {
    score -= 35;
    reasons.push('cache hit rate < 60%');
  } else if (hit < 75) {
    score -= 20;
    reasons.push('cache hit rate < 75%');
  } else if (hit < 85) {
    score -= 10;
    reasons.push('cache hit rate < 85%');
  }

  if (pingOk < 95 && pings > 0) {
    score -= 20;
    reasons.push('ping success < 95%');
  } else if (pingOk < 98 && pings > 0) {
    score -= 10;
    reasons.push('ping success < 98%');
  }

  if (churn > 0.5) {
    score -= 20;
    reasons.push('prefix changes per request > 0.50');
  } else if (churn > 0.35) {
    score -= 10;
    reasons.push('prefix changes per request > 0.35');
  }

  if (netSaved <= 0) {
    score -= 20;
    reasons.push('net savings <= $0');
  } else if (netSaved < 5) {
    score -= 8;
    reasons.push('net savings < $5');
  }

  if (errs > 0) {
    score -= Math.min(10, errs);
    reasons.push(`ping/forward errors observed (${errs})`);
  }

  if (score < 0) score = 0;

  const grade = score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'F';

  return { grade, score, reasons };
}

function recommendations(stats: KeepaliveStats): string[] {
  const recs: string[] = [];
  const churn = num(stats.prefixChangesPerReq);
  const pingOk = num(stats.pingOkRate);
  const hit = num(stats.cacheHitRate);
  const netSaved = num(stats.costEstimate?.netSaved);
  const write = num(stats.tokens?.cacheWrite);
  const read = num(stats.tokens?.cacheRead);
  const input = num(stats.tokens?.input);
  const totalIn = read + write + input;
  const writeRatio = totalIn > 0 ? (write / totalIn) * 100 : 0;

  if (churn > 0.35) {
    recs.push(
      `prefix churn is high (${churn.toFixed(3)}/req): stabilize model/system/tools prefix and avoid profile switching mid-session`
    );
  }

  if (pingOk < 98 && num(stats.cumulative?.pings) > 0) {
    recs.push(
      `ping success is ${pingOk.toFixed(2)}%: investigate upstream/network stability and proxy timeout patterns`
    );
  }

  if (writeRatio > 15) {
    recs.push(
      `cache_write share is ${writeRatio.toFixed(2)}%: prioritize prompt-prefix reuse before adding more keepalive frequency`
    );
  }

  if (hit < 80) {
    recs.push(
      `cache hit ${hit.toFixed(2)}%: consider longer session continuity and reducing tool/schema churn`
    );
  }

  if (netSaved > 0 && recs.length === 0) {
    recs.push('current setup is healthy; keep observing before making behavior changes');
  }

  return recs;
}

async function handleStatus(args: string[]): Promise<void> {
  await initUI();
  const parsed = parseArgs(args);
  const health = await fetchJson<KeepaliveHealth>(`http://127.0.0.1:${parsed.port}/_health`);

  console.log(header('CCS Keepalive Status'));
  console.log('');

  if (!health || health.status !== 'ok') {
    console.log(fail(`Keepalive daemon not reachable on 127.0.0.1:${parsed.port}`));
    console.log(dim(`Try: ccs <profile-with-cacheKeepalive> --verbose`));
    console.log('');
    process.exit(1);
  }

  const reqs = num(health.stats?.reqs);
  const pings = num(health.stats?.pings);
  const errs = num(health.stats?.errs);
  const hit = num(health.cacheHitRate);
  const pingOk = num(health.pingOkRate);
  const churn = num(health.prefixChangesPerReq);
  const net = num(health.costEstimate?.netSaved);

  const content =
    `Port:        ${parsed.port}\n` +
    `Upstream:    ${health.upstream ?? 'unknown'}\n` +
    `Model:       ${health.model ?? 'unknown'}\n` +
    `Cache hit:   ${pct(hit)}\n` +
    `Ping OK:     ${pct(pingOk)} (${pings} pings)\n` +
    `Reqs/Errs:   ${reqs}/${errs}\n` +
    `Churn:       ${churn.toFixed(3)} changes/req\n` +
    `Net saved:   ${usd(net)}\n` +
    `Log file:    ${health.paths?.logFile ?? defaultStatsFile(parsed.port).replace('-stats.json', '.log')}\n` +
    `Stats file:  ${health.paths?.statsFile ?? defaultStatsFile(parsed.port)}`;

  console.log(infoBox(content, 'Live Snapshot'));
  console.log('');
}

async function renderWatchFrame(port: number): Promise<void> {
  const now = new Date().toLocaleString();
  const health = await fetchJson<KeepaliveHealth>(`http://127.0.0.1:${port}/_health`);

  console.clear();
  console.log(header('CCS Keepalive Watch'));
  console.log(dim(`Updated: ${now}  (Ctrl+C to exit)`));
  console.log('');

  if (!health || health.status !== 'ok') {
    console.log(fail(`Daemon offline at 127.0.0.1:${port}`));
    console.log(dim('Start a keepalive-enabled profile to bring it back.'));
    return;
  }

  const rows = [
    ['upstream', health.upstream ?? '-'],
    ['model', health.model ?? '-'],
    ['cache_hit_rate', pct(num(health.cacheHitRate))],
    ['ping_ok_rate', `${pct(num(health.pingOkRate))} (${num(health.stats?.pings)} pings)`],
    ['requests', String(num(health.stats?.reqs))],
    ['errors', String(num(health.stats?.errs))],
    ['prefix_churn', `${num(health.prefixChangesPerReq).toFixed(3)} changes/req`],
    ['net_saved', usd(num(health.costEstimate?.netSaved))],
    ['last_ping_latency', `${num(health.lastPingLatencyMs, 0)} ms`],
    ['last_request_at', health.lastRequestAt ?? '-'],
    ['log_file', health.paths?.logFile ?? '-'],
  ];

  const pad = 18;
  for (const [k, v] of rows) {
    console.log(`  ${dim(k.padEnd(pad))}${v}`);
  }
  console.log('');
  console.log(dim(`JSON: http://127.0.0.1:${port}/_health`));
  console.log(dim(`JSON: http://127.0.0.1:${port}/_stats`));
}

async function handleWatch(args: string[]): Promise<void> {
  const parsed = parseArgs(args);

  let inFlight = false;
  const loop = async (): Promise<void> => {
    if (inFlight) return;
    inFlight = true;
    try {
      await renderWatchFrame(parsed.port);
    } finally {
      inFlight = false;
    }
  };

  await loop();
  const timer = setInterval(() => {
    void loop();
  }, parsed.intervalSec * 1000);

  process.on('SIGINT', () => {
    clearInterval(timer);
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    clearInterval(timer);
    process.exit(0);
  });
}

async function handleAnalyze(args: string[]): Promise<void> {
  await initUI();
  const parsed = parseArgs(args);

  const stats =
    (await fetchJson<KeepaliveStats>(`http://127.0.0.1:${parsed.port}/_stats`, 2200)) ??
    readStatsFile(parsed.port);

  if (!stats) {
    console.log(fail(`No keepalive stats available for port ${parsed.port}`));
    console.log(dim('Start keepalive traffic first, then run analysis.'));
    console.log('');
    process.exit(1);
  }

  ensureDerivedStats(stats);

  if (parsed.json) {
    const report = {
      grade: gradeFromStats(stats),
      recommendations: recommendations(stats),
      stats,
    };
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  const hit = num(stats.cacheHitRate);
  const pingOk = num(stats.pingOkRate);
  const churn = num(stats.prefixChangesPerReq);
  const reqs = num(stats.cumulative?.reqs);
  const pings = num(stats.cumulative?.pings);
  const errs = num(stats.cumulative?.errs);
  const saved = num(stats.costEstimate?.saved);
  const overhead = num(stats.costEstimate?.overhead);
  const pingCost = num(stats.costEstimate?.pingCost);
  const netSaved = num(stats.costEstimate?.netSaved);
  const uptime = num(stats.cumulative?.uptimeSeconds);
  const grade = gradeFromStats(stats);
  const recs = recommendations(stats);

  console.log(header('CCS Keepalive Analysis'));
  console.log('');
  console.log(
    infoBox(
      `Grade: ${grade.grade} (${grade.score}/100)\n` +
        `Hit rate: ${pct(hit)}\n` +
        `Ping success: ${pct(pingOk)}\n` +
        `Prefix churn: ${churn.toFixed(3)} changes/req\n` +
        `Reqs/Pings/Errs: ${reqs}/${pings}/${errs}\n` +
        `Savings: +${usd(saved)} -${usd(overhead)} -${usd(pingCost)} = ${usd(netSaved)}\n` +
        `Observed uptime: ${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`,
      'Executive Summary'
    )
  );
  console.log('');

  console.log(subheader('Findings'));
  if (grade.reasons.length === 0) {
    console.log(`  ${ok('healthy: no major risk flags')}`);
  } else {
    for (const reason of grade.reasons) {
      console.log(`  ${warn(reason)}`);
    }
  }
  console.log('');

  console.log(subheader('Recommendations'));
  for (const rec of recs) {
    console.log(`  - ${rec}`);
  }
  console.log('');

  if (stats.byModel && Object.keys(stats.byModel).length > 0) {
    console.log(subheader('Model Breakdown'));
    const entries = Object.entries(stats.byModel).sort((a, b) => num(b[1].reqs) - num(a[1].reqs));
    for (const [model, s] of entries) {
      const mRead = num(s.cacheReadTokens);
      const mWrite = num(s.cacheWriteTokens);
      const mInput = num(s.inputTokens);
      const mTotal = mRead + mWrite + mInput;
      const mHit = mTotal > 0 ? (mRead / mTotal) * 100 : 0;
      console.log(
        `  ${color(model, 'command')}  req=${num(s.reqs)}  hit=${pct(mHit)}  read=${mRead} write=${mWrite} input=${mInput}`
      );
    }
    console.log('');
  }

  console.log(subheader('Data Sources'));
  console.log(`  /_stats:   http://127.0.0.1:${parsed.port}/_stats`);
  console.log(`  /_health:  http://127.0.0.1:${parsed.port}/_health`);
  console.log(
    `  statsFile: ${stats.paths?.statsFile ?? stats.statsFile ?? defaultStatsFile(parsed.port)}`
  );
  console.log(`  logFile:   ${stats.paths?.logFile ?? defaultLogFile(parsed.port)}`);
  console.log('');
}

async function handleLlmReport(args: string[]): Promise<void> {
  const parsed = parseLlmReportArgs(args);
  const healthUrl = `http://127.0.0.1:${parsed.port}/_health`;
  const statsUrl = `http://127.0.0.1:${parsed.port}/_stats`;

  const health = await fetchJson<KeepaliveHealth>(healthUrl, 2200);
  const stats = (await fetchJson<KeepaliveStats>(statsUrl, 2200)) ?? readStatsFile(parsed.port);

  if (!stats) {
    console.log(
      JSON.stringify(
        {
          status: 'error',
          message: `No keepalive stats available for port ${parsed.port}`,
          dataSources: {
            healthUrl,
            statsUrl,
            statsFile: defaultStatsFile(parsed.port),
          },
        },
        null,
        2
      )
    );
    process.exit(1);
  }

  ensureDerivedStats(stats);

  const grade = gradeFromStats(stats);
  const recs = recommendations(stats);
  const reqs = num(stats.cumulative?.reqs);
  const pings = num(stats.cumulative?.pings);
  const okPings = num(stats.cumulative?.ok);
  const errs = num(stats.cumulative?.errs);
  const hit = num(stats.cacheHitRate);
  const pingOk = num(stats.pingOkRate);
  const churn = num(stats.prefixChangesPerReq);
  const saved = num(stats.costEstimate?.saved);
  const overhead = num(stats.costEstimate?.overhead);
  const pingCost = num(stats.costEstimate?.pingCost);
  const netSaved = num(stats.costEstimate?.netSaved);

  const modelBreakdown = Object.entries(stats.byModel ?? {})
    .sort((a, b) => num(b[1].reqs) - num(a[1].reqs))
    .slice(0, 8)
    .map(([model, m]) => {
      const read = num(m.cacheReadTokens);
      const write = num(m.cacheWriteTokens);
      const input = num(m.inputTokens);
      const output = num(m.outputTokens);
      const totalIn = read + write + input;
      const modelHitRate = totalIn > 0 ? parseFloat(((read / totalIn) * 100).toFixed(2)) : 0;
      return {
        model,
        reqs: num(m.reqs),
        hitRate: modelHitRate,
        cacheReadTokens: read,
        cacheWriteTokens: write,
        inputTokens: input,
        outputTokens: output,
      };
    });

  const logFile = stats.paths?.logFile ?? defaultLogFile(parsed.port);
  const recentLogs = readLogTail(logFile, parsed.logLines);
  const incidents = summarizeLogIncidents(recentLogs);

  const report = {
    status: health?.status === 'ok' ? 'ok' : 'degraded',
    generatedAt: new Date().toISOString(),
    context: {
      port: parsed.port,
      upstream: health?.upstream ?? null,
      model: health?.model ?? null,
      hasPrefix: health?.hasPrefix ?? null,
      lastRequestAt: health?.lastRequestAt ?? stats.activity?.lastRequestAt ?? null,
      lastPingLatencyMs: num(health?.lastPingLatencyMs ?? stats.activity?.lastPingLatencyMs, 0),
    },
    scoring: grade,
    metrics: {
      reqs,
      pings,
      okPings,
      errs,
      cacheHitRate: hit,
      pingOkRate: pingOk,
      prefixChangesPerReq: churn,
      cost: {
        saved,
        overhead,
        pingCost,
        netSaved,
        currency: stats.costEstimate?.currency ?? 'USD',
      },
      uptimeSeconds: num(stats.cumulative?.uptimeSeconds),
    },
    modelBreakdown,
    incidents,
    recommendations: recs,
    evidence: {
      analyzedLogLines: recentLogs.length,
      logTail: recentLogs.slice(Math.max(0, recentLogs.length - 30)),
    },
    dataSources: {
      healthUrl,
      statsUrl,
      statsFile: stats.paths?.statsFile ?? stats.statsFile ?? defaultStatsFile(parsed.port),
      logFile,
    },
  };

  console.log(JSON.stringify(report, null, 2));
}

async function showHelp(): Promise<void> {
  await initUI();

  console.log(header('CCS Keepalive Tools'));
  console.log('');
  console.log(subheader('Usage'));
  console.log(`  ${color('ccs keepalive <command> [options]', 'command')}`);
  console.log('');
  console.log(subheader('Commands'));
  console.log(`  ${color('status', 'command')}   One-time snapshot from /_health`);
  console.log(`  ${color('watch', 'command')}    Live dashboard (refresh every N seconds)`);
  console.log(`  ${color('analyze', 'command')}  Data-driven score + recommendations`);
  console.log(`  ${color('llm-report', 'command')} JSON report for LLM automated analysis`);
  console.log('');
  console.log(subheader('Options'));
  console.log(
    `  ${color('--port, -p <port>', 'command')}       Keepalive daemon port (default: 18621)`
  );
  console.log(
    `  ${color('--interval, -i <sec>', 'command')}    Watch refresh interval (default: 3)`
  );
  console.log(`  ${color('--json', 'command')}                  JSON output for analyze`);
  console.log(
    `  ${color('--log-lines, -n <num>', 'command')}   Log tail lines for llm-report (default: 120)`
  );
  console.log('');
  console.log(subheader('Examples'));
  console.log(`  ${color('ccs keepalive status', 'command')}`);
  console.log(`  ${color('ccs keepalive watch -i 2', 'command')}`);
  console.log(`  ${color('ccs keepalive analyze', 'command')}`);
  console.log(`  ${color('ccs keepalive analyze --json > keepalive-report.json', 'command')}`);
  console.log(`  ${color('ccs keepalive llm-report -n 80 > keepalive-llm.json', 'command')}`);
  console.log('');
}

export async function handleKeepaliveCommand(args: string[]): Promise<void> {
  const command = args[0];
  if (!command || command === 'help' || command === '--help' || command === '-h') {
    await showHelp();
    return;
  }

  switch (command) {
    case 'status':
      await handleStatus(args.slice(1));
      return;
    case 'watch':
      await handleWatch(args.slice(1));
      return;
    case 'analyze':
      await handleAnalyze(args.slice(1));
      return;
    case 'llm-report':
    case 'report':
      await handleLlmReport(args.slice(1));
      return;
    default:
      await initUI();
      console.log(fail(`Unknown keepalive command: ${command}`));
      console.log(`Run ${color('ccs keepalive --help', 'command')} for usage.`);
      process.exit(1);
  }
}
