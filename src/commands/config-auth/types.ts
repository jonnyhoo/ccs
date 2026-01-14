/**
 * Config Auth Command Types
 *
 * Shared interfaces for dashboard authentication CLI commands.
 */

export interface ConfigAuthContext {
  verbose?: boolean;
}

export interface AuthSetupResult {
  success: boolean;
  username?: string;
  error?: string;
}

export interface AuthStatusInfo {
  enabled: boolean;
  configured: boolean;
  username: string;
  sessionTimeoutHours: number;
  envOverride: {
    enabled: boolean;
    username: boolean;
    passwordHash: boolean;
  };
}
