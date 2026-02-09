/**
 * Scenario Router
 *
 * Detects Claude CLI sub-agent request types and routes them to
 * appropriate CCS profiles. Based on claude-code-router's detection logic.
 *
 * Detection rules:
 * - background: model contains 'claude' + 'haiku'
 * - think: thinking.type === 'enabled'
 * - longContext: token count > threshold (optional)
 * - default: everything else
 */

import {
  ScenarioType,
  ScenarioRouterConfig,
  ScenarioDetectionResult,
  AnthropicRequestBody,
  DEFAULT_ROUTER_CONFIG,
} from './types';

/**
 * Scenario Router class.
 * Handles scenario detection and profile resolution.
 */
export class ScenarioRouter {
  private config: ScenarioRouterConfig;
  private verbose: boolean;

  constructor(config: Partial<ScenarioRouterConfig> = {}) {
    this.config = { ...DEFAULT_ROUTER_CONFIG, ...config };
    this.verbose = this.config.verbose ?? false;
  }

  /**
   * Log message if verbose mode is enabled.
   */
  private log(message: string): void {
    if (this.verbose) {
      console.error(`[scenario-router] ${message}`);
    }
  }

  /**
   * Check if router is enabled.
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Detect scenario type from Anthropic API request body.
   *
   * Detection order (first match wins):
   * 1. background - Haiku models (Claude uses Haiku for background tasks)
   * 2. think - Thinking mode enabled
   * 3. longContext - Token count exceeds threshold (if implemented)
   * 4. default - Everything else
   */
  detectScenario(body: AnthropicRequestBody): ScenarioType {
    // 1. Check for background task (Haiku model)
    // Claude CLI uses Haiku variants for background/batch tasks
    if (this.isBackgroundRequest(body)) {
      this.log(`Detected background scenario (model: ${body.model})`);
      return 'background';
    }

    // 2. Check for thinking mode
    if (this.isThinkingRequest(body)) {
      this.log('Detected think scenario (thinking enabled)');
      return 'think';
    }

    // 3. Long context detection (TODO: implement token counting)
    // For now, skip this as it requires token calculation
    // if (this.isLongContextRequest(body)) {
    //   return 'longContext';
    // }

    this.log('Detected default scenario');
    return 'default';
  }

  /**
   * Check if request is a background task (uses Haiku model).
   */
  private isBackgroundRequest(body: AnthropicRequestBody): boolean {
    const model = body.model?.toLowerCase() ?? '';
    return model.includes('claude') && model.includes('haiku');
  }

  /**
   * Check if request has thinking mode enabled.
   */
  private isThinkingRequest(body: AnthropicRequestBody): boolean {
    return body.thinking?.type === 'enabled';
  }

  /**
   * Get the target profile for a detected scenario.
   * Returns undefined if no routing is configured for the scenario.
   */
  getProfileForScenario(scenario: ScenarioType): string | undefined {
    return this.config.routes[scenario];
  }

  /**
   * Perform full detection and return routing result.
   *
   * @param body Anthropic API request body
   * @param currentProfile Current active profile name
   * @returns Detection result with routing decision
   */
  detectAndRoute(body: AnthropicRequestBody, currentProfile?: string): ScenarioDetectionResult {
    if (!this.config.enabled) {
      return {
        scenario: 'default',
        shouldSwitch: false,
        reason: 'Router disabled',
      };
    }

    const scenario = this.detectScenario(body);
    const targetProfile = this.getProfileForScenario(scenario);

    // Determine if we should switch profiles
    const shouldSwitch = !!(targetProfile && targetProfile !== currentProfile);

    let reason: string;
    if (!targetProfile) {
      reason = `No route configured for ${scenario}`;
    } else if (targetProfile === currentProfile) {
      reason = `Already using target profile: ${targetProfile}`;
    } else {
      reason = `Routing ${scenario} → ${targetProfile}`;
    }

    this.log(reason);

    return {
      scenario,
      targetProfile,
      shouldSwitch,
      reason,
    };
  }

  /**
   * Get all configured routes.
   */
  getRoutes(): ScenarioRouterConfig['routes'] {
    return { ...this.config.routes };
  }

  /**
   * Update router configuration.
   */
  updateConfig(config: Partial<ScenarioRouterConfig>): void {
    this.config = { ...this.config, ...config };
    this.verbose = this.config.verbose ?? false;
  }

  /**
   * Get current configuration.
   */
  getConfig(): ScenarioRouterConfig {
    return { ...this.config };
  }
}

/**
 * Create a scenario router from unified config.
 * Returns null if router is not configured or disabled.
 */
export function createScenarioRouter(
  routerConfig?: Partial<ScenarioRouterConfig>
): ScenarioRouter | null {
  if (!routerConfig?.enabled) {
    return null;
  }
  return new ScenarioRouter(routerConfig);
}

export { DEFAULT_ROUTER_CONFIG };
