/**
 * Profile Detector
 *
 * 精简版：只保留 settings 和 default 两种 profile 类型。
 * 从 unified config (YAML) 或 legacy config (JSON) 查找 API profile。
 */

import * as fs from 'fs';
import * as path from 'path';
import { findSimilarStrings, expandPath } from '../utils/helpers';
import { Config } from '../types';
import { UnifiedConfig } from './unified-config-types';
import { loadUnifiedConfig, isUnifiedMode } from './unified-config-loader';
import { getCcsDir } from '../utils/config-manager';

export type ProfileType = 'settings' | 'default';

export interface ProfileDetectionResult {
  type: ProfileType;
  name: string;
  settingsPath?: string;
  message?: string;
  /** 从 unified config 或 settings 文件加载的 env vars */
  env?: Record<string, string>;
  /** API profile 的端点协议 ('anthropic' 默认, 'openai' Chat Completions, 'openai-responses' Responses API) */
  protocol?: 'anthropic' | 'openai' | 'openai-responses';
}

export interface AllProfiles {
  settings: string[];
  default?: string;
}

export interface ProfileNotFoundError extends Error {
  profileName: string;
  suggestions: string[];
  availableProfiles: string;
}

/**
 * 从 settings 文件加载 env vars。
 */
export function loadSettingsFromFile(settingsPath: string): Record<string, string> {
  const expandedPath = expandPath(settingsPath);
  try {
    if (!fs.existsSync(expandedPath)) return {};
    const content = fs.readFileSync(expandedPath, 'utf8');
    const settings = JSON.parse(content) as { env?: Record<string, string> };
    return settings.env || {};
  } catch {
    return {};
  }
}

class ProfileDetector {
  private readonly configPath: string;

  constructor() {
    const ccsDir = getCcsDir();
    this.configPath = path.join(ccsDir, 'config.json');
  }

  private readUnifiedConfig(): UnifiedConfig | null {
    if (!isUnifiedMode()) return null;
    return loadUnifiedConfig();
  }

  /**
   * 从 unified config 解析 profile。
   */
  private resolveFromUnifiedConfig(
    profileName: string,
    config: UnifiedConfig
  ): ProfileDetectionResult | null {
    if (config.profiles?.[profileName]) {
      const profile = config.profiles[profileName];
      const settingsEnv = loadSettingsFromFile(profile.settings);
      return {
        type: 'settings',
        name: profileName,
        env: settingsEnv,
        protocol: profile.protocol,
      };
    }
    return null;
  }

  /**
   * 读取 legacy config.json
   */
  private readConfig(): Config {
    if (!fs.existsSync(this.configPath)) {
      return { profiles: {} };
    }
    try {
      const data = fs.readFileSync(this.configPath, 'utf8');
      return JSON.parse(data) as Config;
    } catch (error) {
      console.warn(`[!] Warning: Could not read config.json: ${(error as Error).message}`);
      return { profiles: {} };
    }
  }

  /**
   * 检测 profile 类型并返回路由信息。
   *
   * 优先级：
   * 1. Unified config profiles (config.yaml)
   * 2. Settings-based profiles (config.json legacy)
   * 3. Default
   */
  detectProfileType(profileName: string | null | undefined): ProfileDetectionResult {
    if (profileName === 'default' || profileName === null || profileName === undefined) {
      return this.resolveDefaultProfile();
    }

    // 尝试 unified config
    const unifiedConfig = this.readUnifiedConfig();
    if (unifiedConfig) {
      const result = this.resolveFromUnifiedConfig(profileName, unifiedConfig);
      if (result) return result;
    }

    // Legacy: settings-based profiles
    const config = this.readConfig();
    if (config.profiles && config.profiles[profileName]) {
      return {
        type: 'settings',
        name: profileName,
        settingsPath: config.profiles[profileName],
      };
    }

    // 未找到 — 生成建议
    const allProfiles = this.getAllProfiles();
    const allProfileNames = [...allProfiles.settings];
    const suggestions = findSimilarStrings(profileName, allProfileNames);

    const error = new Error(`Profile not found: ${profileName}`) as ProfileNotFoundError;
    error.profileName = profileName;
    error.suggestions = suggestions;
    error.availableProfiles = this.listAvailableProfiles();
    throw error;
  }

  /**
   * 解析默认 profile
   */
  private resolveDefaultProfile(): ProfileDetectionResult {
    const unifiedConfig = this.readUnifiedConfig();
    if (unifiedConfig?.default) {
      const result = this.resolveFromUnifiedConfig(unifiedConfig.default, unifiedConfig);
      if (result) return result;
    }

    // Legacy: settings-based default
    const config = this.readConfig();
    if (config.profiles && config.profiles['default']) {
      const settingsPath = config.profiles['default'];
      if (settingsPath.includes('.claude') && settingsPath.endsWith('settings.json')) {
        return {
          type: 'default',
          name: 'default',
          message: 'Using native Claude auth (no custom env vars)',
        };
      }
      return {
        type: 'settings',
        name: 'default',
        settingsPath,
      };
    }

    return {
      type: 'default',
      name: 'default',
      message: 'No profile configured. Using Claude CLI defaults from ~/.claude/',
    };
  }

  /**
   * 列出可用 profiles（用于错误提示）
   */
  private listAvailableProfiles(): string {
    const lines: string[] = [];

    const unifiedConfig = this.readUnifiedConfig();
    if (unifiedConfig) {
      const apiProfiles = Object.keys(unifiedConfig.profiles || {});
      if (apiProfiles.length > 0) {
        lines.push('API profiles:');
        apiProfiles.forEach((name) => {
          const isDefault = name === unifiedConfig.default;
          lines.push(`  - ${name}${isDefault ? ' [DEFAULT]' : ''}`);
        });
      }
      return lines.join('\n');
    }

    // Legacy
    const config = this.readConfig();
    const settingsProfiles = Object.keys(config.profiles || {});
    if (settingsProfiles.length > 0) {
      lines.push('Settings-based profiles:');
      settingsProfiles.forEach((name) => {
        lines.push(`  - ${name}`);
      });
    }

    return lines.join('\n');
  }

  hasProfile(profileName: string): boolean {
    try {
      this.detectProfileType(profileName);
      return true;
    } catch {
      return false;
    }
  }

  getAllProfiles(): AllProfiles {
    const unifiedConfig = this.readUnifiedConfig();
    if (unifiedConfig) {
      return {
        settings: Object.keys(unifiedConfig.profiles || {}),
        default: unifiedConfig.default,
      };
    }

    const config = this.readConfig();
    return {
      settings: Object.keys(config.profiles || {}),
    };
  }
}

export default ProfileDetector;
