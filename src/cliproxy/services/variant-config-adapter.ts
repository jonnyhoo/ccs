/**
 * CLIProxy Variant Config Adapters
 *
 * Handles reading/writing variant config in both unified and legacy formats.
 */

import * as fs from 'fs';
import { getConfigPath, loadConfig } from '../../utils/config-manager';
import { CLIProxyProvider } from '../types';
import {
  loadOrCreateUnifiedConfig,
  saveUnifiedConfig,
  isUnifiedMode,
} from '../../config/unified-config-loader';
import { CLIPROXY_DEFAULT_PORT } from '../config-generator';

/** First port for variant profiles (8318 = default + 1) */
export const VARIANT_PORT_BASE = CLIPROXY_DEFAULT_PORT + 1;

/** Maximum port offset for variants (100 ports: 8318-8417) */
export const VARIANT_PORT_MAX_OFFSET = 100;

/** Variant configuration structure */
export interface VariantConfig {
  provider: string;
  settings?: string;
  account?: string;
  model?: string;
  port?: number;
}

/**
 * Check if variant exists in config
 */
export function variantExistsInConfig(name: string): boolean {
  try {
    if (isUnifiedMode()) {
      const config = loadOrCreateUnifiedConfig();
      return !!(config.cliproxy?.variants && name in config.cliproxy.variants);
    }
    const config = loadConfig();
    return !!(config.cliproxy && name in config.cliproxy);
  } catch {
    return false;
  }
}

/**
 * Get next available port for a new variant.
 * Scans existing variants, returns first unused port starting from VARIANT_PORT_BASE.
 */
export function getNextAvailablePort(): number {
  const variants = listVariantsFromConfig();
  const usedPorts = new Set<number>();

  for (const name of Object.keys(variants)) {
    const port = variants[name].port;
    if (port) usedPorts.add(port);
  }

  // Find first available port in range
  for (let offset = 0; offset < VARIANT_PORT_MAX_OFFSET; offset++) {
    const port = VARIANT_PORT_BASE + offset;
    if (!usedPorts.has(port)) {
      return port;
    }
  }

  const variantCount = Object.keys(variants).length;
  throw new Error(
    `Port limit reached (${variantCount}/${VARIANT_PORT_MAX_OFFSET} variants). ` +
      `Delete unused variants with 'ccs cliproxy remove <name>' to free ports.`
  );
}

/**
 * List variants from config
 */
export function listVariantsFromConfig(): Record<string, VariantConfig> {
  try {
    if (isUnifiedMode()) {
      const unifiedConfig = loadOrCreateUnifiedConfig();
      const variants = unifiedConfig.cliproxy?.variants || {};
      const result: Record<string, VariantConfig> = {};
      for (const name of Object.keys(variants)) {
        const v = variants[name];
        result[name] = {
          provider: v.provider,
          settings: v.settings,
          account: v.account,
          port: v.port,
        };
      }
      return result;
    }

    const config = loadConfig();
    const variants = config.cliproxy || {};
    const result: Record<string, VariantConfig> = {};
    for (const name of Object.keys(variants)) {
      const v = variants[name] as {
        provider: string;
        settings: string;
        account?: string;
        port?: number;
      };
      result[name] = {
        provider: v.provider,
        settings: v.settings,
        account: v.account,
        port: v.port,
      };
    }
    return result;
  } catch {
    return {};
  }
}

/**
 * Save variant to unified config
 */
export function saveVariantUnified(
  name: string,
  provider: CLIProxyProvider,
  settingsPath: string,
  account?: string,
  port?: number
): void {
  const config = loadOrCreateUnifiedConfig();

  if (!config.cliproxy) {
    config.cliproxy = {
      oauth_accounts: {},
      providers: ['gemini', 'codex', 'agy', 'qwen', 'iflow', 'kiro', 'ghcp'],
      variants: {},
    };
  }
  if (!config.cliproxy.variants) {
    config.cliproxy.variants = {};
  }

  config.cliproxy.variants[name] = {
    provider,
    account,
    settings: settingsPath,
    port,
  };

  saveUnifiedConfig(config);
}

/**
 * Save variant to legacy JSON config
 */
export function saveVariantLegacy(
  name: string,
  provider: string,
  settingsPath: string,
  account?: string,
  port?: number
): void {
  const configPath = getConfigPath();

  let config: { profiles: Record<string, string>; cliproxy?: Record<string, unknown> };
  try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch {
    config = { profiles: {} };
  }

  if (!config.cliproxy) {
    config.cliproxy = {};
  }

  const variantConfig: { provider: string; settings: string; account?: string; port?: number } = {
    provider,
    settings: settingsPath,
  };
  if (account) {
    variantConfig.account = account;
  }
  if (port) {
    variantConfig.port = port;
  }
  config.cliproxy[name] = variantConfig;

  const tempPath = configPath + '.tmp';
  fs.writeFileSync(tempPath, JSON.stringify(config, null, 2) + '\n', 'utf8');
  fs.renameSync(tempPath, configPath);
}

/**
 * Remove variant from unified config
 */
export function removeVariantFromUnifiedConfig(name: string): VariantConfig | null {
  const config = loadOrCreateUnifiedConfig();

  if (!config.cliproxy?.variants || !(name in config.cliproxy.variants)) {
    return null;
  }

  const variant = config.cliproxy.variants[name];
  delete config.cliproxy.variants[name];
  saveUnifiedConfig(config);

  return { provider: variant.provider, settings: variant.settings, port: variant.port };
}

/**
 * Remove variant from legacy JSON config
 */
export function removeVariantFromLegacyConfig(name: string): VariantConfig | null {
  const configPath = getConfigPath();

  let config: { profiles: Record<string, string>; cliproxy?: Record<string, unknown> };
  try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch {
    return null;
  }

  if (!config.cliproxy || !(name in config.cliproxy)) {
    return null;
  }

  const variant = config.cliproxy[name] as { provider: string; settings: string; port?: number };
  delete config.cliproxy[name];

  if (Object.keys(config.cliproxy).length === 0) {
    delete config.cliproxy;
  }

  const tempPath = configPath + '.tmp';
  fs.writeFileSync(tempPath, JSON.stringify(config, null, 2) + '\n', 'utf8');
  fs.renameSync(tempPath, configPath);

  return variant;
}
