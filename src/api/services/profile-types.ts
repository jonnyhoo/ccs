/**
 * API Profile Types
 *
 * Shared type definitions for API profile services.
 */

/** Model mapping for API profiles */
export interface ModelMapping {
  default: string;
  opus: string;
  sonnet: string;
  haiku: string;
}

/** API profile info for listing */
export interface ApiProfileInfo {
  name: string;
  settingsPath: string;
  isConfigured: boolean;
  configSource: 'unified' | 'legacy';
}

/** Result from list operation */
export interface ApiListResult {
  profiles: ApiProfileInfo[];
}

/** Result from create operation */
export interface CreateApiProfileResult {
  success: boolean;
  settingsFile: string;
  error?: string;
}

/** Result from remove operation */
export interface RemoveApiProfileResult {
  success: boolean;
  error?: string;
}
