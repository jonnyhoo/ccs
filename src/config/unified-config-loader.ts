/**
 * Unified Config Loader
 *
 * 精简版：加载和保存 YAML 配置，只保留核心功能。
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { getCcsDir } from '../utils/config-manager';
import {
  UnifiedConfig,
  isUnifiedConfig,
  createEmptyUnifiedConfig,
  UNIFIED_CONFIG_VERSION,
  DEFAULT_GLOBAL_ENV,
  DEFAULT_THINKING_CONFIG,
  GlobalEnvConfig,
  ThinkingConfig,
} from './unified-config-types';

const CONFIG_YAML = 'config.yaml';
const CONFIG_JSON = 'config.json';
const CONFIG_LOCK = 'config.yaml.lock';
const LOCK_STALE_MS = 5000;

export function getConfigYamlPath(): string {
  return path.join(getCcsDir(), CONFIG_YAML);
}

export function getConfigJsonPath(): string {
  return path.join(getCcsDir(), CONFIG_JSON);
}

function getLockFilePath(): string {
  return path.join(getCcsDir(), CONFIG_LOCK);
}

function acquireLock(): boolean {
  const lockPath = getLockFilePath();
  const lockData = `${process.pid}\n${Date.now()}`;

  try {
    // 尝试原子创建锁文件（wx = 排他写入，文件已存在则失败）
    const fd = fs.openSync(lockPath, 'wx', 0o600);
    fs.writeSync(fd, lockData);
    fs.closeSync(fd);
    return true;
  } catch (createError) {
    // 文件已存在，检查是否过期
    try {
      const content = fs.readFileSync(lockPath, 'utf8');
      const [pidStr, timestampStr] = content.trim().split('\n');
      const timestamp = parseInt(timestampStr, 10);

      if (Date.now() - timestamp > LOCK_STALE_MS) {
        fs.unlinkSync(lockPath);
        return acquireLock();
      }

      // 检查持锁进程是否存活
      try {
        process.kill(parseInt(pidStr, 10), 0);
        return false; // 进程存活，锁有效
      } catch {
        fs.unlinkSync(lockPath);
        return acquireLock();
      }
    } catch {
      return false;
    }
  }
}

function releaseLock(): void {
  const lockPath = getLockFilePath();
  try {
    if (fs.existsSync(lockPath)) fs.unlinkSync(lockPath);
  } catch {
    /* ignore */
  }
}

export function hasUnifiedConfig(): boolean {
  return fs.existsSync(getConfigYamlPath());
}

export function hasLegacyConfig(): boolean {
  return fs.existsSync(getConfigJsonPath());
}

export function getConfigFormat(): 'yaml' | 'json' | 'none' {
  if (hasUnifiedConfig()) return 'yaml';
  if (hasLegacyConfig()) return 'json';
  return 'none';
}

/**
 * 加载 unified config。文件不存在或格式错误返回 null。
 */
export function loadUnifiedConfig(): UnifiedConfig | null {
  const yamlPath = getConfigYamlPath();

  if (!fs.existsSync(yamlPath)) return null;

  try {
    const content = fs.readFileSync(yamlPath, 'utf8');
    const parsed = yaml.load(content);

    if (!isUnifiedConfig(parsed)) {
      console.error(`[!] Invalid config format in ${yamlPath}`);
      return null;
    }

    // 版本升级
    if ((parsed.version ?? 1) < UNIFIED_CONFIG_VERSION) {
      const upgraded = mergeWithDefaults(parsed);
      upgraded.version = UNIFIED_CONFIG_VERSION;
      try {
        saveUnifiedConfig(upgraded);
        return upgraded;
      } catch {
        // 保存失败也返回内存中的升级版本
      }
    }

    return parsed;
  } catch (err) {
    if (err instanceof yaml.YAMLException) {
      const mark = err.mark;
      console.error(`[X] YAML syntax error in ${yamlPath}:`);
      console.error(
        `    Line ${(mark?.line ?? 0) + 1}, Column ${(mark?.column ?? 0) + 1}: ${err.reason || 'Invalid syntax'}`
      );
    } else {
      const error = err instanceof Error ? err.message : 'Unknown error';
      console.error(`[X] Failed to load config: ${error}`);
    }
    return null;
  }
}

function mergeWithDefaults(partial: Partial<UnifiedConfig>): UnifiedConfig {
  const defaults = createEmptyUnifiedConfig();
  return {
    version: partial.version ?? defaults.version,
    setup_completed: partial.setup_completed,
    default: partial.default ?? defaults.default,
    profiles: partial.profiles ?? defaults.profiles,
    preferences: {
      ...defaults.preferences,
      ...partial.preferences,
    },
    global_env: {
      enabled: partial.global_env?.enabled ?? true,
      env: partial.global_env?.env ?? { ...DEFAULT_GLOBAL_ENV },
    },
    thinking: {
      mode: partial.thinking?.mode ?? DEFAULT_THINKING_CONFIG.mode,
      override: partial.thinking?.override,
      tier_defaults: {
        opus: partial.thinking?.tier_defaults?.opus ?? DEFAULT_THINKING_CONFIG.tier_defaults.opus,
        sonnet:
          partial.thinking?.tier_defaults?.sonnet ?? DEFAULT_THINKING_CONFIG.tier_defaults.sonnet,
        haiku:
          partial.thinking?.tier_defaults?.haiku ?? DEFAULT_THINKING_CONFIG.tier_defaults.haiku,
      },
      provider_overrides: partial.thinking?.provider_overrides,
      show_warnings: partial.thinking?.show_warnings ?? DEFAULT_THINKING_CONFIG.show_warnings,
    },
  };
}

export function loadOrCreateUnifiedConfig(): UnifiedConfig {
  const existing = loadUnifiedConfig();
  if (existing) return mergeWithDefaults(existing);
  return createEmptyUnifiedConfig();
}

function generateYamlHeader(): string {
  return `# CCS Unified Configuration
# Docs: https://github.com/kaitranntt/ccs
`;
}

function generateYamlWithComments(config: UnifiedConfig): string {
  const lines: string[] = [];

  lines.push(`version: ${config.version}`);
  if (config.setup_completed !== undefined) {
    lines.push(`setup_completed: ${config.setup_completed}`);
  }
  lines.push('');

  if (config.default) {
    lines.push(`# Default profile used when running 'ccs' without arguments`);
    lines.push(`default: "${config.default}"`);
    lines.push('');
  }

  // Profiles
  lines.push('# ----------------------------------------------------------------------------');
  lines.push('# Profiles: API-based providers (GLM, GLMT, Kimi, custom endpoints)');
  lines.push('# Each profile points to a *.settings.json file containing env vars.');
  lines.push('# ----------------------------------------------------------------------------');
  lines.push(
    yaml.dump({ profiles: config.profiles }, { indent: 2, lineWidth: -1, quotingType: '"' }).trim()
  );
  lines.push('');

  // Preferences
  lines.push('# ----------------------------------------------------------------------------');
  lines.push('# Preferences: User settings');
  lines.push('# ----------------------------------------------------------------------------');
  lines.push(
    yaml
      .dump({ preferences: config.preferences }, { indent: 2, lineWidth: -1, quotingType: '"' })
      .trim()
  );
  lines.push('');

  // Global env
  if (config.global_env) {
    lines.push('# ----------------------------------------------------------------------------');
    lines.push(
      '# Global Environment Variables: Injected into all non-Claude subscription profiles'
    );
    lines.push('# ----------------------------------------------------------------------------');
    lines.push(
      yaml
        .dump({ global_env: config.global_env }, { indent: 2, lineWidth: -1, quotingType: '"' })
        .trim()
    );
    lines.push('');
  }

  // Thinking
  if (config.thinking) {
    lines.push('# ----------------------------------------------------------------------------');
    lines.push('# Thinking: Extended thinking/reasoning budget configuration');
    lines.push('# Modes: auto (use tier_defaults), off (disable), manual (--thinking flag only)');
    lines.push('# ----------------------------------------------------------------------------');
    lines.push(
      yaml
        .dump({ thinking: config.thinking }, { indent: 2, lineWidth: -1, quotingType: '"' })
        .trim()
    );
    lines.push('');
  }

  return lines.join('\n');
}

export function saveUnifiedConfig(config: UnifiedConfig): void {
  const yamlPath = getConfigYamlPath();
  const dir = path.dirname(yamlPath);

  const maxRetries = 10;
  const retryDelayMs = 100;
  let lockAcquired = false;
  for (let i = 0; i < maxRetries; i++) {
    if (acquireLock()) {
      lockAcquired = true;
      break;
    }
    // 同步忙等待，避免阻塞事件循环的 Atomics.wait
    const waitUntil = Date.now() + retryDelayMs;
    while (Date.now() < waitUntil) { /* spin */ }
  }

  if (!lockAcquired) {
    throw new Error('Config file is locked by another process. Wait a moment and try again.');
  }

  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    }

    config.version = UNIFIED_CONFIG_VERSION;

    const yamlContent = generateYamlWithComments(config);
    const content = generateYamlHeader() + yamlContent;

    const tempPath = `${yamlPath}.tmp.${process.pid}`;

    try {
      fs.writeFileSync(tempPath, content, { mode: 0o600 });
      fs.renameSync(tempPath, yamlPath);
    } catch (error) {
      if (fs.existsSync(tempPath)) {
        try {
          fs.unlinkSync(tempPath);
        } catch {
          /* ignore */
        }
      }
      const err = error as NodeJS.ErrnoException;
      if (err.code === 'ENOSPC') {
        throw new Error('Disk full - cannot save config. Free up space and try again.');
      } else if (err.code === 'EROFS' || err.code === 'EACCES') {
        throw new Error(`Cannot write config - check file permissions: ${err.message}`);
      }
      throw error;
    }
  } finally {
    releaseLock();
  }
}

export function updateUnifiedConfig(updates: Partial<UnifiedConfig>): UnifiedConfig {
  const config = loadOrCreateUnifiedConfig();
  const updated = { ...config, ...updates };
  saveUnifiedConfig(updated);
  return updated;
}

export function isUnifiedMode(): boolean {
  return hasUnifiedConfig();
}

export function getDefaultProfile(): string | undefined {
  const config = loadUnifiedConfig();
  return config?.default;
}

export function setDefaultProfile(name: string): void {
  updateUnifiedConfig({ default: name });
}

export function getGlobalEnvConfig(): GlobalEnvConfig {
  const config = loadOrCreateUnifiedConfig();
  return {
    enabled: config.global_env?.enabled ?? true,
    env: config.global_env?.env ?? { ...DEFAULT_GLOBAL_ENV },
  };
}

export function getThinkingConfig(): ThinkingConfig {
  const config = loadOrCreateUnifiedConfig();

  if (config.thinking !== undefined && typeof config.thinking !== 'object') {
    console.warn(
      `[!] Invalid thinking config: expected object, got ${typeof config.thinking}. Using defaults.`
    );
    return DEFAULT_THINKING_CONFIG;
  }

  return {
    mode: config.thinking?.mode ?? DEFAULT_THINKING_CONFIG.mode,
    override: config.thinking?.override,
    tier_defaults: {
      opus: config.thinking?.tier_defaults?.opus ?? DEFAULT_THINKING_CONFIG.tier_defaults.opus,
      sonnet:
        config.thinking?.tier_defaults?.sonnet ?? DEFAULT_THINKING_CONFIG.tier_defaults.sonnet,
      haiku: config.thinking?.tier_defaults?.haiku ?? DEFAULT_THINKING_CONFIG.tier_defaults.haiku,
    },
    provider_overrides: config.thinking?.provider_overrides,
    show_warnings: config.thinking?.show_warnings ?? DEFAULT_THINKING_CONFIG.show_warnings,
  };
}
