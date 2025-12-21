/**
 * API Command Handler
 *
 * Manages CCS API profiles for custom API providers.
 * Commands: create, list, remove
 *
 * CLI parsing and output formatting only.
 * Business logic delegated to src/api/services/.
 */

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
import {
  validateApiName,
  validateUrl,
  getUrlWarning,
  sanitizeBaseUrl,
  apiProfileExists,
  listApiProfiles,
  createApiProfile,
  removeApiProfile,
  getApiProfileNames,
  isUsingUnifiedConfig,
  isOpenRouterUrl,
  pickOpenRouterModel,
  getPresetById,
  getPresetIds,
  type ModelMapping,
} from '../api/services';

interface ApiCommandArgs {
  name?: string;
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  preset?: string;
  force?: boolean;
  yes?: boolean;
}

/** Parse command line arguments for api commands */
function parseArgs(args: string[]): ApiCommandArgs {
  const result: ApiCommandArgs = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--base-url' && args[i + 1]) {
      result.baseUrl = args[++i];
    } else if (arg === '--api-key' && args[i + 1]) {
      result.apiKey = args[++i];
    } else if (arg === '--model' && args[i + 1]) {
      result.model = args[++i];
    } else if (arg === '--preset' && args[i + 1]) {
      result.preset = args[++i];
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

/** Handle 'ccs api create' command */
async function handleCreate(args: string[]): Promise<void> {
  await initUI();
  const parsedArgs = parseArgs(args);

  console.log(header('Create API Profile'));
  console.log('');

  // Handle --preset option for quick provider setup
  const preset = parsedArgs.preset ? getPresetById(parsedArgs.preset) : null;
  if (parsedArgs.preset && !preset) {
    console.log(fail(`Unknown preset: ${parsedArgs.preset}`));
    console.log('');
    console.log('Available presets:');
    getPresetIds().forEach((id) => console.log(`  - ${id}`));
    process.exit(1);
  }

  // Step 1: API name (use preset default if --preset provided)
  let name = parsedArgs.name || preset?.defaultProfileName;
  if (!name) {
    name = await InteractivePrompt.input('API name', {
      validate: validateApiName,
    });
  } else {
    const error = validateApiName(name);
    if (error) {
      console.log(fail(error));
      process.exit(1);
    }
  }

  // Check if exists
  if (apiProfileExists(name) && !parsedArgs.force) {
    console.log(fail(`API '${name}' already exists`));
    console.log(`    Use ${color('--force', 'command')} to overwrite`);
    process.exit(1);
  }

  // Step 2: Base URL (use preset if provided)
  let baseUrl = parsedArgs.baseUrl || preset?.baseUrl;
  if (!baseUrl) {
    baseUrl = await InteractivePrompt.input(
      'API Base URL (e.g., https://api.example.com/v1 - without /chat/completions)',
      { validate: validateUrl }
    );
  } else if (!preset) {
    // Only validate custom URLs, not preset URLs
    const error = validateUrl(baseUrl);
    if (error) {
      console.log(fail(error));
      process.exit(1);
    }
  }

  // Check for common URL mistakes and warn (skip for presets)
  if (!preset) {
    const urlWarning = getUrlWarning(baseUrl);
    if (urlWarning) {
      console.log('');
      console.log(warn(urlWarning));
      const continueAnyway = await InteractivePrompt.confirm('Continue with this URL anyway?', {
        default: false,
      });
      if (!continueAnyway) {
        baseUrl = await InteractivePrompt.input('API Base URL', {
          validate: validateUrl,
          default: sanitizeBaseUrl(baseUrl),
        });
      }
    }
  } else {
    // Show preset info
    console.log(info(`Using preset: ${preset.name}`));
    console.log(dim(`  ${preset.description}`));
    console.log(dim(`  Base URL: ${preset.baseUrl}`));
    console.log('');
  }

  // OpenRouter detection: offer interactive model picker
  let openRouterModel: string | undefined;
  let openRouterTierMapping: { opus?: string; sonnet?: string; haiku?: string } | undefined;

  if (isOpenRouterUrl(baseUrl) && !parsedArgs.model) {
    console.log('');
    console.log(info('OpenRouter detected!'));

    const useInteractive = await InteractivePrompt.confirm('Browse models interactively?', {
      default: true,
    });

    if (useInteractive) {
      const selection = await pickOpenRouterModel();

      if (selection) {
        openRouterModel = selection.model;
        openRouterTierMapping = selection.tierMapping;
      }
    }

    console.log('');
    console.log(dim('Note: For OpenRouter, ANTHROPIC_API_KEY should be empty.'));
  }

  // Step 3: API Key
  let apiKey = parsedArgs.apiKey;
  if (!apiKey) {
    const keyPrompt = preset?.apiKeyHint ? `API Key (${preset.apiKeyHint})` : 'API Key';
    apiKey = await InteractivePrompt.password(keyPrompt);
    if (!apiKey) {
      console.log(fail('API key is required'));
      process.exit(1);
    }
  }

  // Step 4: Model configuration (use preset default if available)
  const defaultModel = preset?.defaultModel || 'claude-sonnet-4-5-20250929';
  let model = parsedArgs.model || openRouterModel || preset?.defaultModel;
  if (!model && !parsedArgs.yes && !preset) {
    model = await InteractivePrompt.input('Default model (ANTHROPIC_MODEL)', {
      default: defaultModel,
    });
  }
  model = model || defaultModel;

  // Step 5: Model mapping for Opus/Sonnet/Haiku (skip prompt for presets with --yes)
  let opusModel = openRouterTierMapping?.opus || model;
  let sonnetModel = openRouterTierMapping?.sonnet || model;
  let haikuModel = openRouterTierMapping?.haiku || model;
  const isCustomModel = model !== defaultModel;
  const hasOpenRouterTierMapping = openRouterTierMapping !== undefined;
  const hasPreset = preset !== null;

  if (!parsedArgs.yes && !hasOpenRouterTierMapping && !hasPreset) {
    let wantCustomMapping = isCustomModel;

    if (!isCustomModel) {
      console.log('');
      console.log(dim('Some API proxies route different model types to different backends.'));
      wantCustomMapping = await InteractivePrompt.confirm(
        'Configure different models for Opus/Sonnet/Haiku?',
        { default: false }
      );
    }

    if (wantCustomMapping) {
      console.log('');
      console.log(
        dim(
          isCustomModel
            ? 'Configure model IDs for each tier (defaults to your model):'
            : 'Leave blank to use the default model for each.'
        )
      );
      opusModel =
        (await InteractivePrompt.input('Opus model (ANTHROPIC_DEFAULT_OPUS_MODEL)', {
          default: model,
        })) || model;
      sonnetModel =
        (await InteractivePrompt.input('Sonnet model (ANTHROPIC_DEFAULT_SONNET_MODEL)', {
          default: model,
        })) || model;
      haikuModel =
        (await InteractivePrompt.input('Haiku model (ANTHROPIC_DEFAULT_HAIKU_MODEL)', {
          default: model,
        })) || model;
    }
  }

  const models: ModelMapping = {
    default: model,
    opus: opusModel,
    sonnet: sonnetModel,
    haiku: haikuModel,
  };

  // Create profile
  console.log('');
  console.log(info('Creating API profile...'));

  const result = createApiProfile(name, baseUrl, apiKey, models);

  if (!result.success) {
    console.log(fail(`Failed to create API profile: ${result.error}`));
    process.exit(1);
  }

  // Display success
  console.log('');
  const hasCustomMapping = opusModel !== model || sonnetModel !== model || haikuModel !== model;
  let infoMsg =
    `API:      ${name}\n` +
    `Config:   ${isUsingUnifiedConfig() ? '~/.ccs/config.yaml' : '~/.ccs/config.json'}\n` +
    `Settings: ${result.settingsFile}\n` +
    `Base URL: ${baseUrl}\n` +
    `Model:    ${model}`;

  if (hasCustomMapping) {
    infoMsg +=
      `\n\nModel Mapping:\n` +
      `  Opus:   ${opusModel}\n` +
      `  Sonnet: ${sonnetModel}\n` +
      `  Haiku:  ${haikuModel}`;
  }

  console.log(infoBox(infoMsg, 'API Profile Created'));
  console.log('');
  console.log(header('Usage'));
  console.log(`  ${color(`ccs ${name} "your prompt"`, 'command')}`);
  console.log('');
  console.log(header('Edit Settings'));
  console.log(`  ${dim('To modify env vars later:')}`);
  console.log(`  ${color(`nano ${result.settingsFile.replace('~', '$HOME')}`, 'command')}`);
  console.log('');
}

/** Handle 'ccs api list' command */
async function handleList(): Promise<void> {
  await initUI();

  console.log(header('CCS API Profiles'));
  console.log('');

  const { profiles, variants } = listApiProfiles();

  if (profiles.length === 0) {
    console.log(warn('No API profiles configured'));
    console.log('');
    console.log('To create an API profile:');
    console.log(`  ${color('ccs api create', 'command')}`);
    console.log('');
    return;
  }

  // Build table data
  const rows: string[][] = profiles.map((p) => {
    const status = p.isConfigured ? color('[OK]', 'success') : color('[!]', 'warning');
    return [p.name, p.settingsPath, status];
  });

  const colWidths = isUsingUnifiedConfig() ? [15, 20, 10] : [15, 35, 10];
  console.log(
    table(rows, {
      head: ['API', isUsingUnifiedConfig() ? 'Config' : 'Settings File', 'Status'],
      colWidths,
    })
  );
  console.log('');

  // Show CLIProxy variants if any
  if (variants.length > 0) {
    console.log(subheader('CLIProxy Variants'));
    const cliproxyRows = variants.map((v) => [v.name, v.provider, v.settings]);
    console.log(
      table(cliproxyRows, {
        head: ['Variant', 'Provider', 'Settings'],
        colWidths: [15, 15, 30],
      })
    );
    console.log('');
  }

  console.log(dim(`Total: ${profiles.length} API profile(s)`));
  console.log('');
}

/** Handle 'ccs api remove' command */
async function handleRemove(args: string[]): Promise<void> {
  await initUI();
  const parsedArgs = parseArgs(args);

  const apis = getApiProfileNames();

  if (apis.length === 0) {
    console.log(warn('No API profiles to remove'));
    process.exit(0);
  }

  // Interactive API selection if not provided
  let name = parsedArgs.name;
  if (!name) {
    console.log(header('Remove API Profile'));
    console.log('');
    console.log('Available APIs:');
    apis.forEach((p, i) => console.log(`  ${i + 1}. ${p}`));
    console.log('');

    name = await InteractivePrompt.input('API name to remove', {
      validate: (val) => {
        if (!val) return 'API name is required';
        if (!apis.includes(val)) return `API '${val}' not found`;
        return null;
      },
    });
  }

  if (!apis.includes(name)) {
    console.log(fail(`API '${name}' not found`));
    console.log('');
    console.log('Available APIs:');
    apis.forEach((p) => console.log(`  - ${p}`));
    process.exit(1);
  }

  // Confirm deletion
  console.log('');
  console.log(`API '${color(name, 'command')}' will be removed.`);
  if (isUsingUnifiedConfig()) {
    console.log('  Config: ~/.ccs/config.yaml');
    console.log('  Secrets: ~/.ccs/secrets.yaml');
  } else {
    console.log(`  Settings: ~/.ccs/${name}.settings.json`);
  }
  console.log('');

  const confirmed =
    parsedArgs.yes ||
    (await InteractivePrompt.confirm('Delete this API profile?', { default: false }));

  if (!confirmed) {
    console.log(info('Cancelled'));
    process.exit(0);
  }

  const result = removeApiProfile(name);

  if (!result.success) {
    console.log(fail(`Failed to remove API profile: ${result.error}`));
    process.exit(1);
  }

  console.log(ok(`API profile removed: ${name}`));
  console.log('');
}

/** Show help for api commands */
async function showHelp(): Promise<void> {
  await initUI();

  console.log(header('CCS API Management'));
  console.log('');
  console.log(subheader('Usage'));
  console.log(`  ${color('ccs api', 'command')} <command> [options]`);
  console.log('');
  console.log(subheader('Commands'));
  console.log(`  ${color('create [name]', 'command')}    Create new API profile (interactive)`);
  console.log(`  ${color('list', 'command')}             List all API profiles`);
  console.log(`  ${color('remove <name>', 'command')}    Remove an API profile`);
  console.log('');
  console.log(subheader('Options'));
  console.log(
    `  ${color('--preset <id>', 'command')}        Use provider preset (openrouter, glm, glmt, kimi)`
  );
  console.log(`  ${color('--base-url <url>', 'command')}     API base URL (create)`);
  console.log(`  ${color('--api-key <key>', 'command')}      API key (create)`);
  console.log(`  ${color('--model <model>', 'command')}      Default model (create)`);
  console.log(`  ${color('--force', 'command')}              Overwrite existing (create)`);
  console.log(`  ${color('--yes, -y', 'command')}            Skip confirmation prompts`);
  console.log('');
  console.log(subheader('Provider Presets'));
  console.log(
    `  ${color('openrouter', 'command')}    OpenRouter - 349+ models (Claude, GPT, Gemini, Llama)`
  );
  console.log(`  ${color('glm', 'command')}           GLM - Claude via Z.AI (GitHub Copilot)`);
  console.log(`  ${color('glmt', 'command')}          GLMT - GLM with Thinking mode`);
  console.log(`  ${color('kimi', 'command')}          Kimi - Moonshot AI reasoning model`);
  console.log('');
  console.log(subheader('Examples'));
  console.log(`  ${dim('# Interactive wizard')}`);
  console.log(`  ${color('ccs api create', 'command')}`);
  console.log('');
  console.log(`  ${dim('# Quick setup with preset')}`);
  console.log(`  ${color('ccs api create --preset openrouter', 'command')}`);
  console.log(`  ${color('ccs api create --preset glm', 'command')}`);
  console.log('');
  console.log(`  ${dim('# Create with name')}`);
  console.log(`  ${color('ccs api create myapi', 'command')}`);
  console.log('');
  console.log(`  ${dim('# Remove API profile')}`);
  console.log(`  ${color('ccs api remove myapi', 'command')}`);
  console.log('');
  console.log(`  ${dim('# Show all API profiles')}`);
  console.log(`  ${color('ccs api list', 'command')}`);
  console.log('');
}

/** Main api command router */
export async function handleApiCommand(args: string[]): Promise<void> {
  const command = args[0];

  if (!command || command === '--help' || command === '-h' || command === 'help') {
    await showHelp();
    return;
  }

  switch (command) {
    case 'create':
      await handleCreate(args.slice(1));
      break;
    case 'list':
      await handleList();
      break;
    case 'remove':
    case 'delete':
    case 'rm':
      await handleRemove(args.slice(1));
      break;
    default:
      await initUI();
      console.log(fail(`Unknown command: ${command}`));
      console.log('');
      console.log('Run for help:');
      console.log(`  ${color('ccs api --help', 'command')}`);
      process.exit(1);
  }
}
