/**
 * API Services
 *
 * Barrel export for API-related business logic services.
 */

// Validation services
export { validateApiName, validateUrl, getUrlWarning, sanitizeBaseUrl } from './validation-service';

// Profile types
export {
  type ModelMapping,
  type ApiProfileInfo,
  type CliproxyVariantInfo,
  type ApiListResult,
  type CreateApiProfileResult,
  type RemoveApiProfileResult,
} from './profile-types';

// Profile read operations
export {
  apiProfileExists,
  isApiProfileConfigured,
  listApiProfiles,
  getApiProfileNames,
  isUsingUnifiedConfig,
} from './profile-reader';

// Profile write operations
export { createApiProfile, removeApiProfile } from './profile-writer';

// OpenRouter catalog and picker
export { isOpenRouterUrl, fetchOpenRouterModels, type OpenRouterModel } from './openrouter-catalog';
export { pickOpenRouterModel, type OpenRouterSelection } from './openrouter-picker';

// Provider presets for CLI
export {
  PROVIDER_PRESETS,
  OPENROUTER_BASE_URL,
  getPresetById,
  getPresetIds,
  isValidPresetId,
  type ProviderPreset,
} from './provider-presets';
