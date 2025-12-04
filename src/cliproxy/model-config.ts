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
 */
export function getCurrentModel(provider: CLIProxyProvider): string | undefined {
  const settingsPath = getProviderSettingsPath(provider);
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
  return `${model.name}${tierBadge}${brokenBadge}`;
}

/**
 * Format model entry for detailed display (with description)
 */
function formatModelDetailed(model: ModelEntry, isCurrent: boolean): string {
  const marker = isCurrent ? color('>', 'success') : ' ';
  const name = isCurrent ? bold(model.name) : model.name;
  const tierBadge = model.tier === 'paid' ? color(' [Paid Tier]', 'warning') : '';
  const brokenBadge = model.broken ? color(' [BROKEN]', 'error') : '';
  const desc = model.description ? dim(` - ${model.description}`) : '';
  return `  ${marker} ${name}${tierBadge}${brokenBadge}${desc}`;
}

/**
 * Configure model for provider (interactive)
 *
 * @param provider CLIProxy provider (agy, gemini)
 * @param force Force reconfiguration even if settings exist
 * @returns true if configuration was performed, false if skipped
 */
export async function configureProviderModel(
  provider: CLIProxyProvider,
  force: boolean = false
): Promise<boolean> {
  // Check if provider supports model configuration
  if (!supportsModelConfig(provider)) {
    return false;
  }

  const catalog = getProviderCatalog(provider);
  if (!catalog) return false;

  const settingsPath = getProviderSettingsPath(provider);

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
  const currentModel = getCurrentModel(provider);
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
  console.error('');

  // Interactive selection
  const selectedModel = await InteractivePrompt.selectFromList('Select model:', options, {
    defaultIndex: safeDefaultIdx,
  });

  // Get base env vars to preserve haiku model and base URL
  const baseEnv = getClaudeEnvVars(provider);

  // Build settings with selected model
  const settings = {
    env: {
      ...baseEnv,
      ANTHROPIC_MODEL: selectedModel,
      ANTHROPIC_DEFAULT_OPUS_MODEL: selectedModel,
      ANTHROPIC_DEFAULT_SONNET_MODEL: selectedModel,
      // Keep haiku as-is from base config (usually flash model)
    },
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
  console.error('');
  catalog.models.forEach((m) => {
    const isCurrent = m.id === currentModel;
    console.error(formatModelDetailed(m, isCurrent));
  });

  console.error('');
  console.error(dim(`Run "ccs ${provider} --config" to change`));
  console.error('');
}
