/**
 * Unified Config Types for CCS
 *
 * 精简版：只保留 API profiles、preferences、global_env、thinking 相关类型。
 * 删除了 accounts、cliproxy、copilot、cliproxy_server、quota_management、
 * dashboard_auth、image_analysis、router 等不再需要的配置。
 */

export const UNIFIED_CONFIG_VERSION = 9;

/**
 * API profile 配置。
 * 通��� *.settings.json 注入环境变量。
 */
export interface ProfileConfig {
  /** Profile 类型 */
  type: 'api';
  /** settings 文件路径 (e.g., "~/.ccs/glm.settings.json") */
  settings: string;
  /** 端点协议: 'anthropic' (默认), 'openai' (Chat Completions), 'openai-responses' (Responses API) */
  protocol?: 'anthropic' | 'openai' | 'openai-responses';
  /** 启用缓存保活代理（透传 + 空闲 ping 维持 prompt cache 热度） */
  cacheKeepalive?: boolean;
}

/**
 * 用户偏好设置
 */
export interface PreferencesConfig {
  theme?: 'light' | 'dark' | 'system';
  telemetry?: boolean;
  auto_update?: boolean;
}

/**
 * 全局环境变量配置。
 * 注入到所有非 Claude 原生订阅的 profile 中。
 */
export interface GlobalEnvConfig {
  enabled: boolean;
  env: Record<string, string>;
}

export const DEFAULT_GLOBAL_ENV: Record<string, string> = {
  DISABLE_BUG_COMMAND: '1',
  DISABLE_ERROR_REPORTING: '1',
  DISABLE_TELEMETRY: '1',
};

// ============================================================================
// THINKING CONFIGURATION
// ============================================================================

export type ThinkingMode = 'auto' | 'off' | 'manual';

export interface ThinkingTierDefaults {
  opus: string;
  sonnet: string;
  haiku: string;
}

export interface ThinkingConfig {
  mode: ThinkingMode;
  override?: string | number;
  tier_defaults: ThinkingTierDefaults;
  provider_overrides?: Record<string, Partial<ThinkingTierDefaults>>;
  show_warnings?: boolean;
}

export const DEFAULT_THINKING_TIER_DEFAULTS: ThinkingTierDefaults = {
  opus: 'high',
  sonnet: 'medium',
  haiku: 'low',
};

export const DEFAULT_THINKING_CONFIG: ThinkingConfig = {
  mode: 'auto',
  tier_defaults: { ...DEFAULT_THINKING_TIER_DEFAULTS },
  show_warnings: true,
};

// ============================================================================
// UNIFIED CONFIG
// ============================================================================

/**
 * 主配置结构，存储在 ~/.ccs/config.yaml
 */
export interface UnifiedConfig {
  version: number;
  setup_completed?: boolean;
  default?: string;
  /** API profiles */
  profiles: Record<string, ProfileConfig>;
  /** 用户偏好 */
  preferences: PreferencesConfig;
  /** 全局环境变量 */
  global_env?: GlobalEnvConfig;
  /** Thinking 配置 */
  thinking?: ThinkingConfig;
}

/**
 * 创建空的默认配置
 */
export function createEmptyUnifiedConfig(): UnifiedConfig {
  return {
    version: UNIFIED_CONFIG_VERSION,
    default: undefined,
    profiles: {},
    preferences: {
      theme: 'system',
      telemetry: false,
      auto_update: true,
    },
    global_env: {
      enabled: true,
      env: { ...DEFAULT_GLOBAL_ENV },
    },
    thinking: { ...DEFAULT_THINKING_CONFIG },
  };
}

/**
 * UnifiedConfig 类型守卫
 */
export function isUnifiedConfig(obj: unknown): obj is UnifiedConfig {
  if (typeof obj !== 'object' || obj === null) return false;
  const config = obj as Record<string, unknown>;
  return typeof config.version === 'number' && config.version >= 1;
}
