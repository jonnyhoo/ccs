/**
 * CLIProxy Variant Settings File Manager
 *
 * Handles creation of settings.json files for CLIProxy variants.
 * These files contain environment variables for Claude CLI integration.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { CLIProxyProfileName } from '../../auth/profile-detector';
import { getCcsDir } from '../../utils/config-manager';
import { expandPath } from '../../utils/helpers';
import { getClaudeEnvVars, CLIPROXY_DEFAULT_PORT } from '../config-generator';
import { CLIProxyProvider } from '../types';
import { ensureProfileHooks } from '../../utils/websearch/profile-hook-injector';
import { ensureProfileHooks as ensureImageAnalyzerHooks } from '../../utils/hooks/image-analyzer-profile-hook-injector';

/** Environment settings structure */
interface SettingsEnv {
  ANTHROPIC_BASE_URL: string;
  ANTHROPIC_AUTH_TOKEN: string;
  ANTHROPIC_MODEL: string;
  ANTHROPIC_DEFAULT_OPUS_MODEL: string;
  ANTHROPIC_DEFAULT_SONNET_MODEL: string;
  ANTHROPIC_DEFAULT_HAIKU_MODEL: string;
}

interface SettingsFile {
  env: SettingsEnv;
}

/**
 * Build settings env object for a variant
 */
function buildSettingsEnv(
  provider: CLIProxyProfileName,
  model: string,
  port: number = CLIPROXY_DEFAULT_PORT
): SettingsEnv {
  const baseEnv = getClaudeEnvVars(provider as CLIProxyProvider, port);

  return {
    ANTHROPIC_BASE_URL: baseEnv.ANTHROPIC_BASE_URL || '',
    ANTHROPIC_AUTH_TOKEN: baseEnv.ANTHROPIC_AUTH_TOKEN || '',
    ANTHROPIC_MODEL: model,
    ANTHROPIC_DEFAULT_OPUS_MODEL: model,
    ANTHROPIC_DEFAULT_SONNET_MODEL: model,
    ANTHROPIC_DEFAULT_HAIKU_MODEL: baseEnv.ANTHROPIC_DEFAULT_HAIKU_MODEL || model,
  };
}

/**
 * Ensure directory exists
 */
function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Write settings file atomically
 */
function writeSettings(filePath: string, settings: SettingsFile): void {
  fs.writeFileSync(filePath, JSON.stringify(settings, null, 2) + '\n', 'utf8');
}

/**
 * Get settings file path for a variant
 */
export function getSettingsFilePath(provider: CLIProxyProfileName, name: string): string {
  const ccsDir = getCcsDir();
  return path.join(ccsDir, `${provider}-${name}.settings.json`);
}

/**
 * Get settings file name (without path)
 */
export function getSettingsFileName(provider: CLIProxyProfileName, name: string): string {
  return `${provider}-${name}.settings.json`;
}

/**
 * Get relative settings path with ~ prefix
 */
export function getRelativeSettingsPath(provider: CLIProxyProfileName, name: string): string {
  return `~/.ccs/${getSettingsFileName(provider, name)}`;
}

/**
 * Create settings.json file for CLIProxy variant (legacy mode)
 */
export function createSettingsFile(
  name: string,
  provider: CLIProxyProfileName,
  model: string,
  port: number = CLIPROXY_DEFAULT_PORT
): string {
  const ccsDir = getCcsDir();
  const settingsPath = getSettingsFilePath(provider, name);

  const settings: SettingsFile = {
    env: buildSettingsEnv(provider, model, port),
  };

  ensureDir(ccsDir);
  writeSettings(settingsPath, settings);

  // Inject WebSearch hooks into variant settings
  ensureProfileHooks(`${provider}-${name}`);

  // Inject Image Analyzer hooks into variant settings
  ensureImageAnalyzerHooks(`${provider}-${name}`);

  return settingsPath;
}

/**
 * Create settings.json file for CLIProxy variant (unified mode)
 */
export function createSettingsFileUnified(
  name: string,
  provider: CLIProxyProfileName,
  model: string,
  port: number = CLIPROXY_DEFAULT_PORT
): string {
  const ccsDir = getCcsDir(); // Use centralized function for CCS_HOME support
  const settingsPath = path.join(ccsDir, getSettingsFileName(provider, name));

  const settings: SettingsFile = {
    env: buildSettingsEnv(provider, model, port),
  };

  ensureDir(ccsDir);
  writeSettings(settingsPath, settings);

  // Inject WebSearch hooks into variant settings
  ensureProfileHooks(`${provider}-${name}`);

  // Inject Image Analyzer hooks into variant settings
  ensureImageAnalyzerHooks(`${provider}-${name}`);

  return settingsPath;
}

/**
 * Delete settings file if it exists.
 * Uses expandPath() for cross-platform path handling.
 */
export function deleteSettingsFile(settingsPath: string): boolean {
  const resolvedPath = expandPath(settingsPath);
  if (fs.existsSync(resolvedPath)) {
    fs.unlinkSync(resolvedPath);
    return true;
  }
  return false;
}

/**
 * Update model in an existing settings file
 */
export function updateSettingsModel(settingsPath: string, model: string): void {
  const resolvedPath = settingsPath.replace(/^~/, os.homedir());
  if (!fs.existsSync(resolvedPath)) {
    return;
  }

  try {
    const content = fs.readFileSync(resolvedPath, 'utf8');
    const settings = JSON.parse(content) as SettingsFile;

    if (model) {
      settings.env = settings.env || ({} as SettingsEnv);
      settings.env.ANTHROPIC_MODEL = model;
      settings.env.ANTHROPIC_DEFAULT_OPUS_MODEL = model;
      settings.env.ANTHROPIC_DEFAULT_SONNET_MODEL = model;
    } else {
      // Clear model settings to use defaults
      delete (settings.env as unknown as Record<string, string>).ANTHROPIC_MODEL;
    }

    fs.writeFileSync(resolvedPath, JSON.stringify(settings, null, 2) + '\n', 'utf8');
  } catch {
    // Ignore errors - settings file may be invalid
  }
}
