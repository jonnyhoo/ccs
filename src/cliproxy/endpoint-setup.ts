/**
 * Endpoint Setup for CLIProxy Providers
 *
 * Interactive setup for custom API endpoints (codex-api-key, gemini-api-key, claude-api-key).
 * Allows users to configure third-party OpenAI-format endpoints without OAuth.
 *
 * Usage: ccs codex --setup
 */

import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { InteractivePrompt } from '../utils/prompt';
import { ok, fail, info, warn, dim } from '../utils/ui';
import { getConfigPathForPort, generateConfig, CLIPROXY_DEFAULT_PORT } from './config-generator';
import { CLIProxyProvider } from './types';

/** Provider API key field mapping */
const PROVIDER_KEY_FIELD: Partial<Record<CLIProxyProvider, string>> = {
  codex: 'codex-api-key',
  gemini: 'gemini-api-key',
  claude: 'claude-api-key',
};

interface EndpointConfig {
  apiKey: string;
  baseUrl: string;
}

/**
 * Read CLIProxy config.yaml as a plain object.
 */
function readCliproxyConfig(port: number = CLIPROXY_DEFAULT_PORT): Record<string, unknown> {
  const configPath = getConfigPathForPort(port);
  if (!fs.existsSync(configPath)) {
    return {};
  }
  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    return (yaml.load(content) as Record<string, unknown>) || {};
  } catch {
    return {};
  }
}

/**
 * Write a provider API key entry to CLIProxy config.yaml.
 * Preserves all other config content using section-based replacement.
 */
function writeProviderApiKey(
  provider: CLIProxyProvider,
  endpoint: EndpointConfig,
  port: number = CLIPROXY_DEFAULT_PORT
): void {
  const keyField = PROVIDER_KEY_FIELD[provider];
  if (!keyField) {
    throw new Error(`Provider ${provider} does not support API key configuration`);
  }

  const configPath = getConfigPathForPort(port);

  // Ensure config exists
  if (!fs.existsSync(configPath)) {
    generateConfig(provider, port);
  }

  // Read full config
  const content = fs.readFileSync(configPath, 'utf-8');
  const config = (yaml.load(content) as Record<string, unknown>) || {};

  // Set the provider API key entry
  config[keyField] = [
    {
      'api-key': endpoint.apiKey,
      'base-url': endpoint.baseUrl,
    },
  ];

  // Write back with YAML dump, preserving structure
  // Use section-based replacement to keep comments
  const newSection = yaml.dump(
    { [keyField]: config[keyField] },
    { indent: 2, lineWidth: -1, quotingType: "'", forceQuotes: false }
  );

  const newContent = replaceSectionInYaml(content, keyField, newSection);
  fs.writeFileSync(configPath, newContent, { mode: 0o600 });
}

/**
 * Replace a top-level section in YAML content while preserving rest of file.
 */
function replaceSectionInYaml(content: string, sectionKey: string, newSection: string): string {
  const lines = content.split('\n');
  const result: string[] = [];
  let inSection = false;
  let sectionFound = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trimStart();

    if (trimmed.startsWith(`${sectionKey}:`)) {
      inSection = true;
      sectionFound = true;
      result.push(newSection.trimEnd());
      continue;
    }

    if (inSection) {
      const isTopLevelKey =
        line.length > 0 &&
        !line.startsWith(' ') &&
        !line.startsWith('\t') &&
        !line.startsWith('#') &&
        /^[a-zA-Z_][a-zA-Z0-9_-]*\s*:/.test(line);

      if (isTopLevelKey) {
        inSection = false;
        result.push(line);
      }
      continue;
    }

    result.push(line);
  }

  if (!sectionFound) {
    result.push('');
    result.push(newSection.trimEnd());
  }

  return result.join('\n');
}

/**
 * Get current endpoint config for a provider (if any).
 */
function getCurrentEndpoint(
  provider: CLIProxyProvider,
  port: number = CLIPROXY_DEFAULT_PORT
): EndpointConfig | null {
  const keyField = PROVIDER_KEY_FIELD[provider];
  if (!keyField) return null;

  const config = readCliproxyConfig(port);
  const entries = config[keyField] as
    | Array<{ 'api-key'?: string; 'base-url'?: string }>
    | undefined;
  if (!Array.isArray(entries) || entries.length === 0) return null;

  const first = entries[0];
  if (!first['api-key']?.trim()) return null;

  return {
    apiKey: first['api-key'],
    baseUrl: first['base-url'] || '',
  };
}

/**
 * Environment variable names for provider API keys.
 * Users can set these in their shell profile for portable cross-machine config.
 * Format: CCS_{PROVIDER}_API_KEY, CCS_{PROVIDER}_BASE_URL
 */
const PROVIDER_ENV_VARS: Partial<Record<CLIProxyProvider, { apiKey: string; baseUrl: string }>> = {
  codex: { apiKey: 'CCS_CODEX_API_KEY', baseUrl: 'CCS_CODEX_BASE_URL' },
  gemini: { apiKey: 'CCS_GEMINI_API_KEY', baseUrl: 'CCS_GEMINI_BASE_URL' },
  claude: { apiKey: 'CCS_CLAUDE_API_KEY', baseUrl: 'CCS_CLAUDE_BASE_URL' },
};

/**
 * Check if a provider supports --setup (API key configuration).
 */
export function supportsSetup(provider: CLIProxyProvider): boolean {
  return provider in PROVIDER_KEY_FIELD;
}

/**
 * Get provider endpoint from environment variables.
 * Checks CCS_{PROVIDER}_API_KEY and CCS_{PROVIDER}_BASE_URL.
 * Returns null if env vars are not set.
 */
export function getEndpointFromEnv(provider: CLIProxyProvider): EndpointConfig | null {
  const envVars = PROVIDER_ENV_VARS[provider];
  if (!envVars) return null;

  const apiKey = process.env[envVars.apiKey]?.trim();
  if (!apiKey) return null;

  const baseUrl = process.env[envVars.baseUrl]?.trim() || '';
  return { apiKey, baseUrl };
}

/**
 * Get the resolved endpoint for a provider (env vars > config file).
 * Returns null if no endpoint is configured.
 */
export function getProviderEndpoint(
  provider: CLIProxyProvider,
  port: number = CLIPROXY_DEFAULT_PORT
): EndpointConfig | null {
  // 1. Check env vars first (highest priority)
  const envEndpoint = getEndpointFromEnv(provider);
  if (envEndpoint) return envEndpoint;

  // 2. Check config file
  return getCurrentEndpoint(provider, port);
}

/**
 * Auto-persist environment variable endpoint config to CLIProxy config.yaml.
 * Called when env vars are detected but not yet written to config.
 * This ensures the config is portable even if the env vars are removed later.
 */
export function persistEnvEndpoint(
  provider: CLIProxyProvider,
  endpoint: EndpointConfig,
  verbose: boolean = false,
  port: number = CLIPROXY_DEFAULT_PORT
): void {
  // Check if already in config (avoid unnecessary writes)
  const current = getCurrentEndpoint(provider, port);
  if (current && current.apiKey === endpoint.apiKey && current.baseUrl === endpoint.baseUrl) {
    return; // Already persisted
  }

  try {
    writeProviderApiKey(provider, endpoint, port);
    if (verbose) {
      const envVars = PROVIDER_ENV_VARS[provider];
      console.error(`[cliproxy] Auto-persisted ${envVars?.apiKey} to CLIProxy config`);
    }
  } catch {
    // Best-effort - don't block execution if persistence fails
  }
}

/**
 * Interactive setup for a provider's custom API endpoint.
 * Prompts for base URL and API key, writes to CLIProxy config.
 *
 * @param provider - CLIProxy provider (codex, gemini, claude)
 * @param verbose - Enable verbose logging
 */
export async function setupProviderEndpoint(
  provider: CLIProxyProvider,
  verbose: boolean = false,
  port: number = CLIPROXY_DEFAULT_PORT
): Promise<void> {
  const keyField = PROVIDER_KEY_FIELD[provider];
  if (!keyField) {
    console.error(fail(`Provider ${provider} does not support API key setup`));
    console.error(`    Supported: ${Object.keys(PROVIDER_KEY_FIELD).join(', ')}`);
    process.exit(1);
  }

  console.log('');
  console.log(info(`Setup custom API endpoint for ${provider}`));
  console.log(dim(`  This configures ${keyField} in CLIProxy config.`));
  console.log(dim('  OAuth authentication will be skipped when an API key is configured.'));
  console.log('');

  // Show current config if exists
  const current = getCurrentEndpoint(provider, port);
  if (current) {
    console.log(warn('Existing endpoint detected:'));
    console.log(`    Base URL: ${current.baseUrl}`);
    console.log(`    API Key:  ${current.apiKey.substring(0, 8)}...`);
    console.log('');

    const overwrite = await InteractivePrompt.confirm('Overwrite existing endpoint?', {
      default: true,
    });
    if (!overwrite) {
      console.log(info('Setup cancelled'));
      process.exit(0);
    }
    console.log('');
  }

  // Prompt for base URL
  const defaultUrl =
    current?.baseUrl || (provider === 'codex' ? 'http://api.example.com/openai' : '');
  const baseUrl = await InteractivePrompt.input('API Base URL (OpenAI Responses API)', {
    default: defaultUrl,
    validate: (val) => {
      if (!val) return 'Base URL is required';
      try {
        new URL(val);
        return null;
      } catch {
        return 'Invalid URL format';
      }
    },
  });

  // Prompt for API key
  const apiKey = await InteractivePrompt.password('API Key');
  if (!apiKey) {
    console.error(fail('API key is required'));
    process.exit(1);
  }

  // Write to CLIProxy config
  try {
    writeProviderApiKey(provider, { apiKey, baseUrl }, port);
  } catch (err) {
    console.error(fail(`Failed to write config: ${(err as Error).message}`));
    process.exit(1);
  }

  console.log('');
  console.log(ok(`Endpoint configured for ${provider}`));
  console.log('');
  console.log(`  Base URL: ${baseUrl}`);
  console.log(`  API Key:  ${apiKey.substring(0, 8)}...`);
  console.log(`  Config:   ${getConfigPathForPort(port)}`);
  console.log('');
  console.log(info('Usage:'));
  console.log(`  ccs ${provider}               Start coding session`);
  console.log(`  ccs ${provider} --verbose      Start with debug logging`);
  console.log(`  ccs ${provider} --setup        Reconfigure endpoint`);
  console.log('');

  if (verbose) {
    console.log(dim(`[setup] Written to ${keyField} in ${getConfigPathForPort(port)}`));
  }
}
