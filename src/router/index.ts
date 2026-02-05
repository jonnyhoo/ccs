/**
 * Scenario Router Module
 *
 * Routes Claude CLI sub-agent requests to different CCS profiles
 * based on request characteristics (background, think, webSearch, etc.).
 */

// Types
export type {
  ScenarioType,
  ScenarioRoutes,
  ScenarioRouterConfig,
  AnthropicRequestBody,
  ScenarioDetectionResult,
} from './types';

export { DEFAULT_ROUTER_CONFIG } from './types';

// Router
export { ScenarioRouter, createScenarioRouter } from './scenario-router';

// Proxy
export { ScenarioRoutingProxy, buildScenarioUpstreams, buildSettingsUpstreams } from './scenario-routing-proxy';
export type { ScenarioUpstream, ScenarioRoutingProxyConfig } from './scenario-routing-proxy';

// Settings-based Profile Executor
export { execWithScenarioRouting } from './settings-routing-executor';
