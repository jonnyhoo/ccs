/**
 * cache-keepalive 类型定义
 * 供 cache-keepalive-proxy.ts 和 cache-keepalive-manager.ts 共享
 */

/** 累积统计（跨重启持久化到 tmpdir） */
export interface KeepaliveStats {
  reqs: number;
  pings: number;
  ok: number;
  errs: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  inputTokens: number;
  outputTokens: number;
  prefixChanges: number;
  startTime: number;
  byModel: Record<string, ModelStats>;
  recentPrefixChanges: PrefixChangeRecord[];
}

/** 按模型分组统计 */
export interface ModelStats {
  cacheReadTokens: number;
  cacheWriteTokens: number;
  inputTokens: number;
  outputTokens: number;
  reqs: number;
}

/** 前缀变化记录 */
export interface PrefixChangeRecord {
  time: string;
  from: string | null;
  to: string;
  model: string;
}

/** 保活 ping 重放用的前缀信息 */
export interface CapturedPrefix {
  model: string;
  system?: unknown;
  tools?: unknown;
  apiKey: string;
  ver: string;
  beta?: string;
}

/** Daemon 配置 */
export interface DaemonConfig {
  upstreamUrl: string;
  port: number;
  keepaliveMs: number;
  autoExitMs: number;
}

/** 定价模型 ($/MTok) */
export interface PricingModel {
  input: number;
  cacheRead: number;
  cacheWrite: number;
  output: number;
}

/** 成本估算结果 */
export interface CostEstimate {
  saved: number;
  overhead: number;
  pingCost: number;
  netSaved: number;
  currency: string;
  pricing: PricingModel;
}

/** /health 端点响应 */
export interface HealthResponse {
  service: string;
  status: string;
  upstream: string;
}
