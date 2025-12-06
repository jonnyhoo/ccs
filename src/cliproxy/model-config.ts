/**
 * Model Configuration - Interactive model selection for CLI Proxy providers
 *
 * Handles first-run configuration and explicit --config flag.
 * Persists user selection to ~/.ccs/{provider}.settings.json
 */

import * as fs from 'fs';
import * as path from 'path';
import { InteractivePrompt } from '../utils/prompt';
import { getProviderCatalog, supportsModelConfig, ModelEntry } from './model-catalog';
import { getProviderSettingsPath, getClaudeEnvVars } from './config-generator';
import { CLIProxyProvider } from './types';
import { initUI, color, bold, dim, ok, info, header } from '../utils/ui';

/**
 * Check if model is a Claude model routed via Antigravity
 * Claude models require MAX_THINKING_TOKENS < 8192 for thinking to work
 */
function isClaudeModel(modelId: string): boolean {
  return modelId.includes('claude');
}

/**
 * Max thinking tokens for Claude models via Antigravity
 * Must be < 8192 due to Google protocol conversion limitations
 */
const CLAUDE_MAX_THINKING_TOKENS = '8191';

/** CCS directory */
const CCS_DIR = path.join(process.env.HOME || process.env.USERPROFILE || '', '.ccs');

/**
 * Check if provider has user settings configured
 */
export function hasUserSettings(provider: CLIProxyProvider): boolean {
  const settingsPath = getProviderSettingsPath(provider);
  return fs.existsSync(settingsPath);
}

/**
 * Get current model from user settings
 * @param provider CLIProxy provider
 * @param customSettingsPath Optional custom settings path for CLIProxy variants
 */
export function getCurrentModel(
  provider: CLIProxyProvider,
  customSettingsPath?: string
): string | undefined {
  const settingsPath = customSettingsPath
    ? customSettingsPath.replace(/^~/, process.env.HOME || process.env.USERPROFILE || '')
    : getProviderSettingsPath(provider);
  if (!fs.existsSync(settingsPath)) return undefined;

  try {
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    return settings.env?.ANTHROPIC_MODEL;
  } catch {
    return undefined;
  }
}

/**
 * Format model entry for display in selection list
 */
function formatModelOption(model: ModelEntry): string {
  // Tier badge: clarify that "paid" means paid Google account (not free tier)
  const tierBadge = model.tier === 'paid' ? color(' [Paid Tier]', 'warning') : '';
  const brokenBadge = model.broken ? color(' [BROKEN]', 'error') : '';
  const deprecatedBadge = model.deprecated ? color(' [DEPRECATED]', 'warning') : '';
  return `${model.name}${tierBadge}${brokenBadge}${deprecatedBadge}`;
}

/**
 * Format model entry for detailed display (with description)
 */
function formatModelDetailed(model: ModelEntry, isCurrent: boolean): string {
  const marker = isCurrent ? color('>', 'success') : ' ';
  const name = isCurrent ? bold(model.name) : model.name;
  const tierBadge = model.tier === 'paid' ? color(' [Paid Tier]', 'warning') : '';
  const brokenBadge = model.broken ? color(' [BROKEN]', 'error') : '';
  const deprecatedBadge = model.deprecated ? color(' [DEPRECATED]', 'warning') : '';
  const desc = model.description ? dim(` - ${model.description}`) : '';
  return `  ${marker} ${name}${tierBadge}${brokenBadge}${deprecatedBadge}${desc}`;
}

/**
 * Configure model for provider (interactive)
 *
 * @param provider CLIProxy provider (agy, gemini)
 * @param force Force reconfiguration even if settings exist
 * @param customSettingsPath Optional custom settings path for CLIProxy variants
 * @returns true if configuration was performed, false if skipped
 */
export async function configureProviderModel(
  provider: CLIProxyProvider,
  force: boolean = false,
  customSettingsPath?: string
): Promise<boolean> {
  // Check if provider supports model configuration
  if (!supportsModelConfig(provider)) {
    return false;
  }

  const catalog = getProviderCatalog(provider);
  if (!catalog) return false;

  // Use custom settings path for CLIProxy variants, otherwise use default provider path
  const settingsPath = customSettingsPath
    ? customSettingsPath.replace(/^~/, process.env.HOME || process.env.USERPROFILE || '')
    : getProviderSettingsPath(provider);

  // Skip if already configured (unless --config flag)
  if (!force && fs.existsSync(settingsPath)) {
    return false;
  }

  // Initialize UI for colors/gradient
  await initUI();

  // Build options list
  const options = catalog.models.map((m) => ({
    id: m.id,
    label: formatModelOption(m),
  }));

  // Find default index - use current model if configured, otherwise catalog default
  const currentModel = getCurrentModel(provider, customSettingsPath);
  const targetModel = currentModel || catalog.defaultModel;
  const defaultIdx = catalog.models.findIndex((m) => m.id === targetModel);
  const safeDefaultIdx = defaultIdx >= 0 ? defaultIdx : 0;

  // Show header with context (gradient like ccs doctor)
  console.error('');
  console.error(header(`Configure ${catalog.displayName} Model`));
  console.error('');
  console.error(dim('    Select which model to use for this provider.'));
  console.error(
    dim('    Models marked [Paid Tier] require a paid Google account (not free tier).')
  );
  console.error(dim('    Models marked [DEPRECATED] are not recommended for use.'));
  console.error('');

  // Interactive selection
  const selectedModel = await InteractivePrompt.selectFromList('Select model:', options, {
    defaultIndex: safeDefaultIdx,
  });

  // Get base env vars for defaults
  const baseEnv = getClaudeEnvVars(provider);

  // Read existing settings to preserve user customizations
  let existingSettings: Record<string, unknown> = {};
  let existingEnv: Record<string, string> = {};
  if (fs.existsSync(settingsPath)) {
    try {
      existingSettings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      existingEnv = (existingSettings.env as Record<string, string>) || {};
    } catch {
      // Invalid JSON - start fresh
    }
  }

  // Build settings with selective merge:
  // - Preserve ALL user settings (top-level and env vars)
  // - Only update CCS-controlled fields (model selection + thinking toggle for Claude)
  const isClaude = isClaudeModel(selectedModel);

  // CCS-controlled env vars (always override with our values)
  const ccsControlledEnv: Record<string, string> = {
    ANTHROPIC_BASE_URL: baseEnv.ANTHROPIC_BASE_URL || '',
    ANTHROPIC_AUTH_TOKEN: baseEnv.ANTHROPIC_AUTH_TOKEN || '',
    ANTHROPIC_MODEL: selectedModel,
    ANTHROPIC_DEFAULT_OPUS_MODEL: selectedModel,
    ANTHROPIC_DEFAULT_SONNET_MODEL: selectedModel,
    ANTHROPIC_DEFAULT_HAIKU_MODEL: baseEnv.ANTHROPIC_DEFAULT_HAIKU_MODEL || '',
  };

  // Claude models require MAX_THINKING_TOKENS < 8192 for thinking to work
  if (isClaude) {
    ccsControlledEnv.MAX_THINKING_TOKENS = CLAUDE_MAX_THINKING_TOKENS;
  }

  // Merge: user env vars (preserved) + CCS controlled (override)
  const mergedEnv = {
    ...existingEnv,
    ...ccsControlledEnv,
  };

  // Remove MAX_THINKING_TOKENS when switching away from Claude model
  if (!isClaude && mergedEnv.MAX_THINKING_TOKENS) {
    delete mergedEnv.MAX_THINKING_TOKENS;
  }

  // Build final settings: preserve user top-level settings + update env
  const settings: Record<string, unknown> = {
    ...existingSettings,
    env: mergedEnv,
  };

  // Ensure CCS directory exists
  if (!fs.existsSync(CCS_DIR)) {
    fs.mkdirSync(CCS_DIR, { recursive: true });
  }

  // Write settings file
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));

  // Find display name
  const selectedEntry = catalog.models.find((m) => m.id === selectedModel);
  const displayName = selectedEntry?.name || selectedModel;

  console.error('');
  console.error(ok(`Model set to: ${bold(displayName)}`));
  console.error(dim(`     Config saved: ${settingsPath}`));

  // Show deprecation warning if model is deprecated
  if (selectedEntry?.deprecated) {
    console.error('');
    console.error(color('[!] DEPRECATION WARNING', 'warning'));
    const reason = selectedEntry.deprecationReason || 'This model is deprecated';
    console.error(dim(`     ${reason}`));
    console.error(dim('     Consider using a non-deprecated model for better compatibility.'));
  }

  // Show info for Claude models about thinking token limit
  if (isClaude) {
    console.error('');
    console.error(
      info(`MAX_THINKING_TOKENS set to ${CLAUDE_MAX_THINKING_TOKENS} (required < 8192)`)
    );
    console.error(dim('     Google protocol conversion requires this limit for thinking to work.'));
  }
  console.error('');

  return true;
}

/**
 * Show current model configuration
 */
export async function showCurrentConfig(provider: CLIProxyProvider): Promise<void> {
  if (!supportsModelConfig(provider)) {
    console.error(info(`Provider ${provider} does not support model configuration`));
    return;
  }

  const catalog = getProviderCatalog(provider);
  if (!catalog) return;

  // Initialize UI for colors/gradient
  await initUI();

  const currentModel = getCurrentModel(provider);
  const settingsPath = getProviderSettingsPath(provider);

  console.error('');
  console.error(header(`${catalog.displayName} Model Configuration`));
  console.error('');

  if (currentModel) {
    const entry = catalog.models.find((m) => m.id === currentModel);
    const displayName = entry?.name || 'Unknown';
    console.error(
      `  ${bold('Current:')} ${color(displayName, 'success')} ${dim(`(${currentModel})`)}`
    );
    console.error(`  ${bold('Config:')}  ${dim(settingsPath)}`);
  } else {
    console.error(`  ${bold('Current:')} ${dim('(using defaults)')}`);
    console.error(`  ${bold('Default:')} ${catalog.defaultModel}`);
  }

  console.error('');
  console.error(bold('Available models:'));
  console.error(dim('  [Paid Tier] = Requires paid Google account (not free tier)'));
  console.error(dim('  [DEPRECATED] = Not recommended for use'));
  console.error('');
  catalog.models.forEach((m) => {
    const isCurrent = m.id === currentModel;
    console.error(formatModelDetailed(m, isCurrent));
  });

  console.error('');
  console.error(dim(`Run "ccs ${provider} --config" to change`));
  console.error('');
}
