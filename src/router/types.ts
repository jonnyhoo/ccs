/**
 * Scenario Router Types
 *
 * Defines types for sub-agent routing feature.
 * Routes Claude CLI's internal sub-agents (background, think, etc.)
 * to different CCS profiles based on request characteristics.
 */

/**
 * Scenario types that can be detected from Claude CLI requests.
 * Based on claude-code-router's detection logic.
 */
export type ScenarioType = 'default' | 'background' | 'think' | 'longContext';

/**
 * Maps scenario types to CCS profile names.
 */
export type ScenarioRoutes = Partial<Record<ScenarioType, string>>;

/**
 * Scenario router configuration.
 * Stored in config.yaml under the 'router' key.
 */
export interface ScenarioRouterConfig {
  /** Enable/disable scenario routing (default: false) */
  enabled: boolean;

  /** Maps scenario types to CCS profile names */
  routes: ScenarioRoutes;

  /** Token count threshold for longContext detection (default: 60000) */
  longContextThreshold?: number;

  /** Enable verbose logging for debugging */
  verbose?: boolean;
}

/**
 * Default router configuration.
 */
export const DEFAULT_ROUTER_CONFIG: ScenarioRouterConfig = {
  enabled: false,
  routes: {},
  longContextThreshold: 60000,
  verbose: false,
};

/**
 * Anthropic API request body structure (subset for scenario detection).
 */
export interface AnthropicRequestBody {
  /** Model identifier (e.g., 'claude-3-haiku-20240307') */
  model?: string;

  /** Messages array */
  messages?: unknown[];

  /** Thinking configuration */
  thinking?: {
    type?: 'enabled' | 'disabled';
    budget_tokens?: number;
  };

  /** Tools array */
  tools?: Array<{
    name?: string;
    [key: string]: unknown;
  }>;

  /** System prompt */
  system?: string | Array<{ type?: string; text?: string }>;
}

/**
 * Result of scenario detection.
 */
export interface ScenarioDetectionResult {
  /** Detected scenario type */
  scenario: ScenarioType;

  /** Target profile name (if routing is configured) */
  targetProfile?: string;

  /** Whether to switch profiles */
  shouldSwitch: boolean;

  /** Detection reason for logging */
  reason: string;
}
