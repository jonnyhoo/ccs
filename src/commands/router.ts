/**
 * CCS Router Commands
 *
 * CLI commands for managing scenario routing configuration.
 *
 * Commands:
 * - ccs router status  - Show current router configuration
 * - ccs router enable  - Enable scenario routing
 * - ccs router disable - Disable scenario routing
 * - ccs router set <scenario> <profile> - Set route for a scenario
 * - ccs router unset <scenario> - Remove route for a scenario
 */

import { loadOrCreateUnifiedConfig, saveUnifiedConfig } from '../config/unified-config-loader';
import { ScenarioType } from '../router';
import { ok, fail, info, warn, bold, color, dim } from '../utils/ui';

const VALID_SCENARIOS: ScenarioType[] = ['default', 'background', 'think', 'longContext'];

/**
 * Show current router configuration.
 */
export function routerStatus(): void {
  const config = loadOrCreateUnifiedConfig();
  const router = config.router;

  console.log('');
  console.log(bold('📍 Scenario Router Configuration'));
  console.log('');

  if (!router || !router.enabled) {
    console.log(color('  Status: ', 'warning') + dim('Disabled'));
    console.log('');
    console.log(info('Enable with: ccs router enable'));
    console.log('');
    return;
  }

  console.log(color('  Status: ', 'success') + 'Enabled');
  console.log('');
  console.log(bold('  Routes:'));

  if (!router.routes || Object.keys(router.routes).length === 0) {
    console.log(dim('    No routes configured'));
  } else {
    for (const scenario of VALID_SCENARIOS) {
      const profile = router.routes[scenario];
      if (profile) {
        console.log(`    ${color(scenario.padEnd(12), 'info')} → ${color(profile, 'success')}`);
      }
    }
  }

  console.log('');
  console.log(dim(`  Long context threshold: ${router.longContextThreshold ?? 60000} tokens`));
  console.log('');

  // Show help
  console.log(info('Commands:'));
  console.log('  ccs router set <scenario> <profile>  - Set route');
  console.log('  ccs router unset <scenario>          - Remove route');
  console.log('  ccs router disable                   - Disable routing');
  console.log('');
  console.log(dim(`  Valid scenarios: ${VALID_SCENARIOS.join(', ')}`));
  console.log('');
}

/**
 * Enable scenario routing.
 */
export function routerEnable(): void {
  const config = loadOrCreateUnifiedConfig();

  if (!config.router) {
    config.router = {
      enabled: true,
      routes: {},
      longContextThreshold: 60000,
    };
  } else {
    config.router.enabled = true;
  }

  saveUnifiedConfig(config);
  console.log(ok('Scenario routing enabled'));
  console.log('');
  console.log(info('Configure routes with: ccs router set <scenario> <profile>'));
  console.log(dim(`  Example: ccs router set background deepseek`));
  console.log('');
}

/**
 * Disable scenario routing.
 */
export function routerDisable(): void {
  const config = loadOrCreateUnifiedConfig();

  if (config.router) {
    config.router.enabled = false;
    saveUnifiedConfig(config);
  }

  console.log(ok('Scenario routing disabled'));
}

/**
 * Set a route for a scenario.
 */
export function routerSet(scenario: string, profile: string): void {
  // Validate scenario
  if (!VALID_SCENARIOS.includes(scenario as ScenarioType)) {
    console.log(fail(`Invalid scenario: ${scenario}`));
    console.log(info(`Valid scenarios: ${VALID_SCENARIOS.join(', ')}`));
    process.exit(1);
  }

  // Validate profile exists
  const config = loadOrCreateUnifiedConfig();
  const allProfiles = [
    ...Object.keys(config.profiles || {}),
    ...Object.keys(config.cliproxy?.variants || {}),
  ];

  // Also check built-in providers
  const builtinProviders = config.cliproxy?.providers || [];

  if (!allProfiles.includes(profile) && !builtinProviders.includes(profile)) {
    console.log(warn(`Profile '${profile}' not found in config`));
    console.log(info('Available profiles:'));
    if (allProfiles.length > 0) {
      allProfiles.forEach((p) => console.log(`  - ${p}`));
    }
    if (builtinProviders.length > 0) {
      console.log(info('Built-in providers:'));
      builtinProviders.forEach((p) => console.log(`  - ${p}`));
    }
    console.log('');
    console.log(info('Continuing anyway - make sure the profile exists before use'));
  }

  // Update config
  if (!config.router) {
    config.router = {
      enabled: true,
      routes: {},
      longContextThreshold: 60000,
    };
  }

  config.router.routes[scenario as ScenarioType] = profile;

  // Auto-enable if setting routes
  if (!config.router.enabled) {
    config.router.enabled = true;
    console.log(info('Auto-enabled scenario routing'));
  }

  saveUnifiedConfig(config);
  console.log(ok(`Route set: ${scenario} → ${profile}`));
}

/**
 * Remove a route for a scenario.
 */
export function routerUnset(scenario: string): void {
  // Validate scenario
  if (!VALID_SCENARIOS.includes(scenario as ScenarioType)) {
    console.log(fail(`Invalid scenario: ${scenario}`));
    console.log(info(`Valid scenarios: ${VALID_SCENARIOS.join(', ')}`));
    process.exit(1);
  }

  const config = loadOrCreateUnifiedConfig();

  if (!config.router?.routes?.[scenario as ScenarioType]) {
    console.log(info(`No route configured for ${scenario}`));
    return;
  }

  delete config.router.routes[scenario as ScenarioType];
  saveUnifiedConfig(config);
  console.log(ok(`Route removed: ${scenario}`));
}

/**
 * Set long context threshold.
 */
export function routerSetThreshold(threshold: number): void {
  if (isNaN(threshold) || threshold < 1000) {
    console.log(fail('Threshold must be a number >= 1000'));
    process.exit(1);
  }

  const config = loadOrCreateUnifiedConfig();

  if (!config.router) {
    config.router = {
      enabled: false,
      routes: {},
      longContextThreshold: threshold,
    };
  } else {
    config.router.longContextThreshold = threshold;
  }

  saveUnifiedConfig(config);
  console.log(ok(`Long context threshold set to ${threshold} tokens`));
}

/**
 * Main router command handler.
 */
export function handleRouterCommand(args: string[]): void {
  const subcommand = args[0];

  switch (subcommand) {
    case 'status':
    case undefined:
      routerStatus();
      break;

    case 'enable':
      routerEnable();
      break;

    case 'disable':
      routerDisable();
      break;

    case 'set':
      if (args.length < 3) {
        console.log(fail('Usage: ccs router set <scenario> <profile>'));
        console.log(info(`Valid scenarios: ${VALID_SCENARIOS.join(', ')}`));
        process.exit(1);
      }
      routerSet(args[1], args[2]);
      break;

    case 'unset':
      if (args.length < 2) {
        console.log(fail('Usage: ccs router unset <scenario>'));
        process.exit(1);
      }
      routerUnset(args[1]);
      break;

    case 'threshold':
      if (args.length < 2) {
        console.log(fail('Usage: ccs router threshold <number>'));
        process.exit(1);
      }
      routerSetThreshold(parseInt(args[1], 10));
      break;

    default:
      console.log(fail(`Unknown subcommand: ${subcommand}`));
      console.log(info('Available commands: status, enable, disable, set, unset, threshold'));
      process.exit(1);
  }
}
