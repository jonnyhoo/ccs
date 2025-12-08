/**
 * CLIProxy Command Handler
 *
 * Manages CLIProxyAPI binary installation and profile variants.
 *
 * Binary commands:
 *   ccs cliproxy                  Show current version
 *   ccs cliproxy --install <ver>  Install specific version
 *   ccs cliproxy --latest         Install latest version
 *
 * Profile commands:
 *   ccs cliproxy create <name>    Create CLIProxy variant profile
 *   ccs cliproxy list             List all CLIProxy variant profiles
 *   ccs cliproxy remove <name>    Remove CLIProxy variant profile
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  getInstalledCliproxyVersion,
  installCliproxyVersion,
  fetchLatestCliproxyVersion,
  isCLIProxyInstalled,
  getCLIProxyPath,
} from '../cliproxy';
import { getAllAuthStatus, getOAuthConfig } from '../cliproxy/auth-handler';
import { CLIPROXY_FALLBACK_VERSION } from '../cliproxy/platform-detector';
import { CLIPROXY_PROFILES, CLIProxyProfileName } from '../auth/profile-detector';
import { getCcsDir, getConfigPath, loadConfig } from '../utils/config-manager';
import { getClaudeEnvVars, CLIPROXY_DEFAULT_PORT } from '../cliproxy/config-generator';
import { getProviderCatalog, supportsModelConfig, ModelEntry } from '../cliproxy/model-catalog';
import { CLIProxyProvider } from '../cliproxy/types';
import {
  initUI,
  header,
  subheader,
  color,
  dim,
  ok,
  fail,
  warn,
  info,
  table,
  infoBox,
} from '../utils/ui';
import { InteractivePrompt } from '../utils/prompt';

// ============================================================================
// PROFILE MANAGEMENT
// ============================================================================

interface CliproxyProfileArgs {
  name?: string;
  provider?: CLIProxyProfileName;
  model?: string;
  force?: boolean;
  yes?: boolean;
}

/**
 * Parse command line arguments for profile commands
 */
function parseProfileArgs(args: string[]): CliproxyProfileArgs {
  const result: CliproxyProfileArgs = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--provider' && args[i + 1]) {
      result.provider = args[++i] as CLIProxyProfileName;
    } else if (arg === '--model' && args[i + 1]) {
      result.model = args[++i];
    } else if (arg === '--force') {
      result.force = true;
    } else if (arg === '--yes' || arg === '-y') {
      result.yes = true;
    } else if (!arg.startsWith('-') && !result.name) {
      result.name = arg;
    }
  }

  return result;
}

/**
 * Validate CLIProxy profile name
 */
function validateProfileName(name: string): string | null {
  if (!name) {
    return 'Profile name is required';
  }
  if (!/^[a-zA-Z][a-zA-Z0-9._-]*$/.test(name)) {
    return 'Name must start with letter, contain only letters, numbers, dot, dash, underscore';
  }
  if (name.length > 32) {
    return 'Name must be 32 characters or less';
  }
  // Reserved names - includes built-in cliproxy profiles
  const reserved = [
    'default',
    'auth',
    'api',
    'doctor',
    'sync',
    'update',
    'help',
    'version',
    'cliproxy',
    'create',
    'list',
    'remove',
    ...CLIPROXY_PROFILES,
  ];
  if (reserved.includes(name.toLowerCase())) {
    return `'${name}' is a reserved name`;
  }
  return null;
}

/**
 * Check if CLIProxy variant profile exists
 */
function cliproxyVariantExists(name: string): boolean {
  try {
    const config = loadConfig();
    return !!(config.cliproxy && name in config.cliproxy);
  } catch {
    return false;
  }
}

/**
 * Create settings.json file for CLIProxy variant
 * Includes all 6 fields for proper Claude CLI integration
 */
function createCliproxySettingsFile(
  name: string,
  provider: CLIProxyProfileName,
  model: string
): string {
  const ccsDir = getCcsDir();
  const settingsPath = path.join(ccsDir, `${provider}-${name}.settings.json`);

  // Get base env vars from provider config
  const baseEnv = getClaudeEnvVars(provider as CLIProxyProvider, CLIPROXY_DEFAULT_PORT);

  const settings = {
    env: {
      ANTHROPIC_BASE_URL: baseEnv.ANTHROPIC_BASE_URL || '',
      ANTHROPIC_AUTH_TOKEN: baseEnv.ANTHROPIC_AUTH_TOKEN || '',
      ANTHROPIC_MODEL: model,
      ANTHROPIC_DEFAULT_OPUS_MODEL: model,
      ANTHROPIC_DEFAULT_SONNET_MODEL: model,
      ANTHROPIC_DEFAULT_HAIKU_MODEL: baseEnv.ANTHROPIC_DEFAULT_HAIKU_MODEL || model,
    },
  };

  // Ensure directory exists
  if (!fs.existsSync(ccsDir)) {
    fs.mkdirSync(ccsDir, { recursive: true });
  }

  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf8');
  return settingsPath;
}

/**
 * Update config.json with new CLIProxy variant
 */
function addCliproxyVariant(
  name: string,
  provider: CLIProxyProfileName,
  settingsPath: string
): void {
  const configPath = getConfigPath();

  // Read existing config or create new
  let config: { profiles: Record<string, string>; cliproxy?: Record<string, unknown> };
  try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch {
    config = { profiles: {} };
  }

  // Ensure cliproxy section exists
  if (!config.cliproxy) {
    config.cliproxy = {};
  }

  // Use relative path with ~ for portability
  const relativePath = `~/.ccs/${path.basename(settingsPath)}`;
  config.cliproxy[name] = {
    provider,
    settings: relativePath,
  };

  // Write config atomically
  const tempPath = configPath + '.tmp';
  fs.writeFileSync(tempPath, JSON.stringify(config, null, 2) + '\n', 'utf8');
  fs.renameSync(tempPath, configPath);
}

/**
 * Remove CLIProxy variant from config.json
 */
function removeCliproxyVariant(name: string): { provider: string; settings: string } | null {
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

  const variant = config.cliproxy[name] as { provider: string; settings: string };
  delete config.cliproxy[name];

  // Clean up empty cliproxy section
  if (Object.keys(config.cliproxy).length === 0) {
    delete config.cliproxy;
  }

  // Write config atomically
  const tempPath = configPath + '.tmp';
  fs.writeFileSync(tempPath, JSON.stringify(config, null, 2) + '\n', 'utf8');
  fs.renameSync(tempPath, configPath);

  return variant;
}

/**
 * Format model entry for display
 */
function formatModelOption(model: ModelEntry): string {
  const tierBadge = model.tier === 'paid' ? color(' [Paid Tier]', 'warning') : '';
  return `${model.name}${tierBadge}`;
}

/**
 * Handle 'ccs cliproxy create' command
 */
async function handleCreate(args: string[]): Promise<void> {
  await initUI();
  const parsedArgs = parseProfileArgs(args);

  console.log(header('Create CLIProxy Variant'));
  console.log('');

  // Step 1: Profile name
  let name = parsedArgs.name;
  if (!name) {
    name = await InteractivePrompt.input('Variant name (e.g., g3, flash, pro)', {
      validate: validateProfileName,
    });
  } else {
    const error = validateProfileName(name);
    if (error) {
      console.log(fail(error));
      process.exit(1);
    }
  }

  // Check if exists
  if (cliproxyVariantExists(name) && !parsedArgs.force) {
    console.log(fail(`Variant '${name}' already exists`));
    console.log(`    Use ${color('--force', 'command')} to overwrite`);
    process.exit(1);
  }

  // Step 2: Provider selection
  let provider = parsedArgs.provider;
  if (!provider) {
    const providerOptions = CLIPROXY_PROFILES.map((p) => ({
      id: p,
      label: p.charAt(0).toUpperCase() + p.slice(1),
    }));

    provider = (await InteractivePrompt.selectFromList(
      'Select provider:',
      providerOptions
    )) as CLIProxyProfileName;
  } else if (!CLIPROXY_PROFILES.includes(provider)) {
    console.log(fail(`Invalid provider: ${provider}`));
    console.log(`    Available: ${CLIPROXY_PROFILES.join(', ')}`);
    process.exit(1);
  }

  // Step 3: Model selection
  let model = parsedArgs.model;
  if (!model) {
    // Check if provider has model catalog for interactive selection
    if (supportsModelConfig(provider as CLIProxyProvider)) {
      const catalog = getProviderCatalog(provider as CLIProxyProvider);
      if (catalog) {
        const modelOptions = catalog.models.map((m) => ({
          id: m.id,
          label: formatModelOption(m),
        }));

        const defaultIdx = catalog.models.findIndex((m) => m.id === catalog.defaultModel);

        model = await InteractivePrompt.selectFromList('Select model:', modelOptions, {
          defaultIndex: defaultIdx >= 0 ? defaultIdx : 0,
        });
      }
    }

    // Fallback to manual input if no catalog
    if (!model) {
      model = await InteractivePrompt.input('Model name', {
        validate: (val) => (val ? null : 'Model is required'),
      });
    }
  }

  // Create files
  console.log('');
  console.log(info('Creating CLIProxy variant...'));

  try {
    const settingsPath = createCliproxySettingsFile(name, provider, model);
    addCliproxyVariant(name, provider, settingsPath);

    console.log('');
    console.log(
      infoBox(
        `Variant:  ${name}\n` +
          `Provider: ${provider}\n` +
          `Model:    ${model}\n` +
          `Settings: ~/.ccs/${path.basename(settingsPath)}`,
        'CLIProxy Variant Created'
      )
    );
    console.log('');
    console.log(header('Usage'));
    console.log(`  ${color(`ccs ${name} "your prompt"`, 'command')}`);
    console.log('');
    console.log(dim('To change model later:'));
    console.log(`  ${color(`ccs ${name} --config`, 'command')}`);
    console.log('');
  } catch (error) {
    console.log(fail(`Failed to create variant: ${(error as Error).message}`));
    process.exit(1);
  }
}

/**
 * Handle 'ccs cliproxy list' command
 */
async function handleList(): Promise<void> {
  await initUI();

  console.log(header('CLIProxy Profiles'));
  console.log('');

  try {
    // Show auth status for built-in profiles
    console.log(subheader('Built-in Profiles'));
    const authStatuses = getAllAuthStatus();

    for (const status of authStatuses) {
      const oauthConfig = getOAuthConfig(status.provider);
      const icon = status.authenticated ? ok('') : warn('');
      const authLabel = status.authenticated
        ? color('authenticated', 'success')
        : dim('not authenticated');
      const lastAuthStr = status.lastAuth ? dim(` (${status.lastAuth.toLocaleDateString()})`) : '';

      console.log(
        `  ${icon} ${color(status.provider, 'command').padEnd(18)} ${oauthConfig.displayName.padEnd(16)} ${authLabel}${lastAuthStr}`
      );
    }
    console.log('');
    console.log(dim('  To authenticate: ccs <provider> --auth'));
    console.log(dim('  To logout:       ccs <provider> --logout'));
    console.log('');

    // Show custom variants if any
    const config = loadConfig();
    const variants = config.cliproxy || {};
    const variantNames = Object.keys(variants);

    if (variantNames.length > 0) {
      console.log(subheader('Custom Variants'));

      // Build table data
      const rows: string[][] = variantNames.map((name) => {
        const variant = variants[name] as { provider: string; settings: string };
        return [name, variant.provider, variant.settings];
      });

      // Print table
      console.log(
        table(rows, {
          head: ['Variant', 'Provider', 'Settings'],
          colWidths: [15, 12, 35],
        })
      );
      console.log('');
      console.log(dim(`Total: ${variantNames.length} custom variant(s)`));
      console.log('');
    }

    console.log(dim('To create a custom variant:'));
    console.log(`  ${color('ccs cliproxy create', 'command')}`);
    console.log('');
  } catch (error) {
    console.log(fail(`Failed to list profiles: ${(error as Error).message}`));
    process.exit(1);
  }
}

/**
 * Handle 'ccs cliproxy remove' command
 */
async function handleRemove(args: string[]): Promise<void> {
  await initUI();
  const parsedArgs = parseProfileArgs(args);

  // Load config to get available variants
  let config: { profiles: Record<string, string>; cliproxy?: Record<string, unknown> };
  try {
    config = loadConfig();
  } catch {
    console.log(fail('Failed to load config'));
    process.exit(1);
  }

  const variants = config.cliproxy || {};
  const variantNames = Object.keys(variants);

  if (variantNames.length === 0) {
    console.log(warn('No CLIProxy variants to remove'));
    process.exit(0);
  }

  // Interactive selection if not provided
  let name = parsedArgs.name;
  if (!name) {
    console.log(header('Remove CLIProxy Variant'));
    console.log('');
    console.log('Available variants:');
    variantNames.forEach((n, i) => {
      const v = variants[n] as { provider: string };
      console.log(`  ${i + 1}. ${n} (${v.provider})`);
    });
    console.log('');

    name = await InteractivePrompt.input('Variant name to remove', {
      validate: (val) => {
        if (!val) return 'Variant name is required';
        if (!variantNames.includes(val)) return `Variant '${val}' not found`;
        return null;
      },
    });
  }

  if (!(name in variants)) {
    console.log(fail(`Variant '${name}' not found`));
    console.log('');
    console.log('Available variants:');
    variantNames.forEach((n) => console.log(`  - ${n}`));
    process.exit(1);
  }

  const variant = variants[name] as { provider: string; settings: string };

  // Confirm deletion
  console.log('');
  console.log(`Variant '${color(name, 'command')}' will be removed.`);
  console.log(`  Provider: ${variant.provider}`);
  console.log(`  Settings: ${variant.settings}`);
  console.log('');

  const confirmed =
    parsedArgs.yes || (await InteractivePrompt.confirm('Delete this variant?', { default: false }));

  if (!confirmed) {
    console.log(info('Cancelled'));
    process.exit(0);
  }

  // Remove from config
  const removed = removeCliproxyVariant(name);
  if (!removed) {
    console.log(fail('Failed to remove variant from config'));
    process.exit(1);
  }

  // Remove settings file if it exists
  const settingsFile = removed.settings.replace(/^~/, process.env.HOME || '');
  if (fs.existsSync(settingsFile)) {
    fs.unlinkSync(settingsFile);
  }

  console.log(ok(`Variant removed: ${name}`));
  console.log('');
}

// ============================================================================
// BINARY MANAGEMENT
// ============================================================================

/**
 * Show cliproxy command help with styled UI
 */
async function showHelp(): Promise<void> {
  await initUI();

  console.log('');
  console.log(header('CLIProxy Management'));
  console.log('');

  // Usage
  console.log(subheader('Usage:'));
  console.log(`  ${color('ccs cliproxy', 'command')} <command> [options]`);
  console.log('');

  // Profile Commands
  console.log(subheader('Profile Commands:'));
  const profileCmds: [string, string][] = [
    ['create [name]', 'Create new CLIProxy variant profile'],
    ['list', 'List all CLIProxy variant profiles'],
    ['remove <name>', 'Remove a CLIProxy variant profile'],
  ];
  const maxProfileLen = Math.max(...profileCmds.map(([cmd]) => cmd.length));
  for (const [cmd, desc] of profileCmds) {
    console.log(`  ${color(cmd.padEnd(maxProfileLen + 2), 'command')} ${desc}`);
  }
  console.log('');

  // Binary Commands
  console.log(subheader('Binary Commands:'));
  const binaryCmds: [string, string][] = [
    ['--install <version>', 'Install a specific binary version'],
    ['--latest', 'Install the latest binary version'],
  ];
  const maxBinaryLen = Math.max(...binaryCmds.map(([cmd]) => cmd.length));
  for (const [cmd, desc] of binaryCmds) {
    console.log(`  ${color(cmd.padEnd(maxBinaryLen + 2), 'command')} ${desc}`);
  }
  console.log('');

  // Create Options
  console.log(subheader('Create Options:'));
  const createOpts: [string, string][] = [
    ['--provider <name>', 'Provider (gemini, codex, agy, qwen)'],
    ['--model <model>', 'Model name'],
    ['--force', 'Overwrite existing variant'],
    ['--yes, -y', 'Skip confirmation prompts'],
  ];
  const maxOptLen = Math.max(...createOpts.map(([opt]) => opt.length));
  for (const [opt, desc] of createOpts) {
    console.log(`  ${color(opt.padEnd(maxOptLen + 2), 'command')} ${desc}`);
  }
  console.log('');

  // Examples
  console.log(subheader('Examples:'));
  console.log(
    `  $ ${color('ccs cliproxy create', 'command')}                    ${dim('# Interactive wizard')}`
  );
  console.log(`  $ ${color('ccs cliproxy create g3 --provider gemini', 'command')}`);
  console.log(
    `    ${color('--model gemini-3-pro-preview', 'command')}            ${dim('# Non-interactive')}`
  );
  console.log(
    `  $ ${color('ccs cliproxy list', 'command')}                       ${dim('# Show all variants')}`
  );
  console.log(
    `  $ ${color('ccs cliproxy remove g3', 'command')}                  ${dim('# Remove variant')}`
  );
  console.log(
    `  $ ${color('ccs cliproxy --latest', 'command')}                   ${dim('# Update binary')}`
  );
  console.log('');

  // Notes
  console.log(subheader('Notes:'));
  console.log(`  Default fallback version: ${color(CLIPROXY_FALLBACK_VERSION, 'info')}`);
  console.log(
    `  Releases: ${color('https://github.com/router-for-me/CLIProxyAPI/releases', 'path')}`
  );
  console.log('');
}

/**
 * Show current cliproxy status
 */
async function showStatus(verbose: boolean): Promise<void> {
  await initUI();

  const installed = isCLIProxyInstalled();
  const currentVersion = getInstalledCliproxyVersion();
  const binaryPath = getCLIProxyPath();

  console.log('');
  console.log(color('CLIProxyAPI Status', 'primary'));
  console.log('');

  if (installed) {
    console.log(`  Installed:  ${color('Yes', 'success')}`);
    console.log(`  Version:    ${color(`v${currentVersion}`, 'info')}`);
    console.log(`  Binary:     ${dim(binaryPath)}`);
  } else {
    console.log(`  Installed:  ${color('No', 'error')}`);
    console.log(`  Fallback:   ${color(`v${CLIPROXY_FALLBACK_VERSION}`, 'info')}`);
    console.log(`  ${dim('Run "ccs gemini" or any provider to auto-install')}`);
  }

  // Try to fetch latest version
  try {
    console.log('');
    console.log(`  ${dim('Checking for updates...')}`);
    const latestVersion = await fetchLatestCliproxyVersion();

    if (latestVersion !== currentVersion) {
      console.log(
        `  Latest:     ${color(`v${latestVersion}`, 'success')} ${dim('(update available)')}`
      );
      console.log('');
      console.log(`  ${dim(`Run "ccs cliproxy --latest" to update`)}`);
    } else {
      console.log(`  Latest:     ${color(`v${latestVersion}`, 'success')} ${dim('(up to date)')}`);
    }
  } catch (error) {
    if (verbose) {
      const err = error as Error;
      console.log(`  Latest:     ${dim(`Could not fetch (${err.message})`)}`);
    }
  }

  console.log('');
  console.log(dim(`Run "ccs cliproxy --help" for all available commands`));
  console.log('');
}

/**
 * Install a specific version
 */
async function installVersion(version: string, verbose: boolean): Promise<void> {
  // Validate version format (basic semver check)
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    console.error('[X] Invalid version format. Expected format: X.Y.Z (e.g., 6.5.53)');
    process.exit(1);
  }

  console.log(`[i] Installing CLIProxyAPI v${version}...`);
  console.log('');

  try {
    await installCliproxyVersion(version, verbose);
    console.log('');
    console.log(`[OK] CLIProxyAPI v${version} installed successfully`);
  } catch (error) {
    const err = error as Error;
    console.error('');
    console.error(`[X] Failed to install CLIProxyAPI v${version}`);
    console.error(`    ${err.message}`);
    console.error('');
    console.error('Possible causes:');
    console.error('  1. Version does not exist on GitHub');
    console.error('  2. Network connectivity issues');
    console.error('  3. GitHub API rate limiting');
    console.error('');
    console.error('Check available versions at:');
    console.error('  https://github.com/router-for-me/CLIProxyAPI/releases');
    process.exit(1);
  }
}

/**
 * Install latest version
 */
async function installLatest(verbose: boolean): Promise<void> {
  console.log('[i] Fetching latest CLIProxyAPI version...');

  try {
    const latestVersion = await fetchLatestCliproxyVersion();
    const currentVersion = getInstalledCliproxyVersion();

    if (isCLIProxyInstalled() && latestVersion === currentVersion) {
      console.log(`[OK] Already running latest version: v${latestVersion}`);
      return;
    }

    console.log(`[i] Latest version: v${latestVersion}`);
    if (isCLIProxyInstalled()) {
      console.log(`[i] Current version: v${currentVersion}`);
    }
    console.log('');

    await installCliproxyVersion(latestVersion, verbose);
    console.log('');
    console.log(`[OK] CLIProxyAPI updated to v${latestVersion}`);
  } catch (error) {
    const err = error as Error;
    console.error(`[X] Failed to install latest version: ${err.message}`);
    process.exit(1);
  }
}

// ============================================================================
// MAIN ROUTER
// ============================================================================

/**
 * Main cliproxy command handler
 */
export async function handleCliproxyCommand(args: string[]): Promise<void> {
  const verbose = args.includes('--verbose') || args.includes('-v');
  const command = args[0];

  // Handle --help
  if (args.includes('--help') || args.includes('-h')) {
    await showHelp();
    return;
  }

  // Handle profile commands
  if (command === 'create') {
    await handleCreate(args.slice(1));
    return;
  }

  if (command === 'list' || command === 'ls') {
    await handleList();
    return;
  }

  if (command === 'remove' || command === 'delete' || command === 'rm') {
    await handleRemove(args.slice(1));
    return;
  }

  // Handle --install <version>
  const installIdx = args.indexOf('--install');
  if (installIdx !== -1) {
    const version = args[installIdx + 1];
    if (!version || version.startsWith('-')) {
      console.error('[X] Missing version argument for --install');
      console.error('    Usage: ccs cliproxy --install <version>');
      console.error('    Example: ccs cliproxy --install 6.5.53');
      process.exit(1);
    }
    await installVersion(version, verbose);
    return;
  }

  // Handle --latest
  if (args.includes('--latest')) {
    await installLatest(verbose);
    return;
  }

  // Default: show status
  await showStatus(verbose);
}
