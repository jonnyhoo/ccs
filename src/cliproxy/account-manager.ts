/**
 * Account Manager for CLIProxyAPI Multi-Account Support
 *
 * Manages multiple OAuth accounts per provider (Gemini, Codex, etc.).
 * Each provider can have multiple accounts, with one designated as default.
 *
 * Account storage: ~/.ccs/cliproxy/accounts.json
 * Token storage: ~/.ccs/cliproxy/auth/ (flat structure, CLIProxyAPI discovers by type field)
 * Paused tokens: ~/.ccs/cliproxy/auth-paused/ (sibling dir, outside CLIProxyAPI scan path)
 */

import * as fs from 'fs';
import * as path from 'path';
import { CLIProxyProvider } from './types';
import { getCliproxyDir, getAuthDir } from './config-generator';
import { PROVIDER_TYPE_VALUES } from './auth/auth-types';

/** Account tier for quota management (free vs paid - no Pro/Ultra distinction needed) */
export type AccountTier = 'free' | 'paid' | 'unknown';

/**
 * Providers that typically have empty email in OAuth token files.
 * For these providers, nickname is used as accountId instead of email.
 */
export const PROVIDERS_WITHOUT_EMAIL: CLIProxyProvider[] = ['kiro', 'ghcp'];

/** Account information */
export interface AccountInfo {
  /** Account identifier (email or custom name) */
  id: string;
  /** Email address from OAuth (if available) */
  email?: string;
  /** User-friendly nickname for quick reference (auto-generated from email prefix) */
  nickname?: string;
  /** Provider this account belongs to */
  provider: CLIProxyProvider;
  /** Whether this is the default account for the provider */
  isDefault: boolean;
  /** Token file name in auth directory */
  tokenFile: string;
  /** When account was added */
  createdAt: string;
  /** Last usage time */
  lastUsedAt?: string;
  /** User-paused state (skip in quota rotation) */
  paused?: boolean;
  /** ISO timestamp when paused */
  pausedAt?: string;
  /** Account tier: free or paid (Pro/Ultra combined) */
  tier?: AccountTier;
  /** GCP Project ID (Antigravity only) - read-only, fetched from auth token */
  projectId?: string;
}

/** Provider accounts configuration */
interface ProviderAccounts {
  /** Default account ID for this provider */
  default: string;
  /** Map of account ID to account metadata */
  accounts: Record<string, Omit<AccountInfo, 'id' | 'provider' | 'isDefault'>>;
}

/** Accounts registry structure */
interface AccountsRegistry {
  /** Version for future migrations */
  version: number;
  /** Accounts organized by provider */
  providers: Partial<Record<CLIProxyProvider, ProviderAccounts>>;
}

/** Default registry structure */
const DEFAULT_REGISTRY: AccountsRegistry = {
  version: 1,
  providers: {},
};

/**
 * Extract unique account ID from token filename when email is unavailable
 * For Kiro/GHCP OAuth, filenames are: <provider>-<oauth>-<profile_id>.json
 * Extracts: <oauth>-<profile_id> as unique identifier
 * @example kiro-github-ABC123.json → github-ABC123
 * @example ghcp-amazon-XYZ789.json → amazon-XYZ789
 * @example kiro-nomail.json → default (no OAuth structure)
 */
export function extractAccountIdFromTokenFile(filename: string, email?: string): string {
  if (email) return email;

  // Pattern: <provider>-<oauth>-<profile_id>.json → extract <oauth>-<profile_id>
  // Requires at least 2 hyphens to distinguish from simple filenames like "kiro-nomail.json"
  const match = filename.match(/^[^-]+-([^-]+-[^.]+)\.json$/);
  if (match) return match[1];

  return 'default';
}

/**
 * Generate nickname from email
 * Takes prefix before @ symbol, sanitizes whitespace
 * Validation: 1-50 chars, any non-whitespace (permissive per user preference)
 */
export function generateNickname(email?: string): string {
  if (!email) return 'default';
  const prefix = email.split('@')[0];
  // Sanitize: remove whitespace, limit to 50 chars
  return prefix.replace(/\s+/g, '').slice(0, 50) || 'default';
}

/**
 * Validate nickname
 * Rules: 1-50 chars, no whitespace, URL-safe, no reserved patterns
 * @returns null if valid, error message if invalid
 */
export function validateNickname(nickname: string): string | null {
  if (!nickname || nickname.length === 0) {
    return 'Nickname is required';
  }
  if (nickname.length > 50) {
    return 'Nickname must be 50 characters or less';
  }
  if (/\s/.test(nickname)) {
    return 'Nickname cannot contain whitespace';
  }
  // Block URL-unsafe chars that break routing
  if (/[%\/&?#]/.test(nickname)) {
    return 'Nickname cannot contain special URL characters (%, /, &, ?, #)';
  }
  // Block reserved patterns used by auto-discovery (kiro-1, ghcp-2, etc.)
  if (/^(kiro|ghcp)-\d+$/i.test(nickname)) {
    return 'Nickname cannot match reserved pattern (kiro-N, ghcp-N)';
  }
  return null;
}

/**
 * Get path to accounts registry file
 */
export function getAccountsRegistryPath(): string {
  return path.join(getCliproxyDir(), 'accounts.json');
}

/**
 * Get path to paused tokens directory
 * Paused tokens are moved here so CLIProxyAPI won't discover them
 *
 * Uses sibling directory (auth-paused/) instead of subdirectory (auth/paused/)
 * because CLIProxyAPI's watcher uses filepath.Walk() which recursively scans
 * all subdirectories of auth/. A sibling directory is completely outside
 * CLIProxyAPI's scan path, preventing token refresh loops.
 */
export function getPausedDir(): string {
  return path.join(getCliproxyDir(), 'auth-paused');
}

/**
 * Load accounts registry
 */
export function loadAccountsRegistry(): AccountsRegistry {
  const registryPath = getAccountsRegistryPath();

  if (!fs.existsSync(registryPath)) {
    return { ...DEFAULT_REGISTRY };
  }

  try {
    const content = fs.readFileSync(registryPath, 'utf-8');
    const data = JSON.parse(content);
    return {
      version: data.version || 1,
      providers: data.providers || {},
    };
  } catch {
    return { ...DEFAULT_REGISTRY };
  }
}

/**
 * Save accounts registry
 */
export function saveAccountsRegistry(registry: AccountsRegistry): void {
  const registryPath = getAccountsRegistryPath();
  const dir = path.dirname(registryPath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }

  fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2) + '\n', {
    mode: 0o600,
  });
}

/**
 * Sync registry with actual token files
 * Removes stale entries where token file no longer exists
 * For paused accounts, checks both auth/ and paused/ directories
 * Called automatically when loading accounts
 */
function syncRegistryWithTokenFiles(registry: AccountsRegistry): boolean {
  const authDir = getAuthDir();
  const pausedDir = getPausedDir();
  let modified = false;

  for (const [_providerName, providerAccounts] of Object.entries(registry.providers)) {
    if (!providerAccounts) continue;

    const staleIds: string[] = [];

    for (const [accountId, meta] of Object.entries(providerAccounts.accounts)) {
      const tokenPath = path.join(authDir, meta.tokenFile);
      const pausedPath = path.join(pausedDir, meta.tokenFile);

      // For paused accounts, check paused dir; for active accounts, check auth dir
      const expectedPath = meta.paused ? pausedPath : tokenPath;
      // Also accept if file exists in either location (handles edge cases)
      const existsAnywhere = fs.existsSync(tokenPath) || fs.existsSync(pausedPath);

      if (!fs.existsSync(expectedPath) && !existsAnywhere) {
        staleIds.push(accountId);
      }
    }

    // Remove stale accounts
    for (const id of staleIds) {
      delete providerAccounts.accounts[id];
      modified = true;

      // Update default if deleted
      if (providerAccounts.default === id) {
        const remainingIds = Object.keys(providerAccounts.accounts);
        providerAccounts.default = remainingIds[0] || 'default';
      }
    }
  }

  return modified;
}

/**
 * Get all accounts for a provider
 */
export function getProviderAccounts(provider: CLIProxyProvider): AccountInfo[] {
  const registry = loadAccountsRegistry();

  // Sync with actual token files (removes stale entries)
  if (syncRegistryWithTokenFiles(registry)) {
    saveAccountsRegistry(registry);
  }

  const providerAccounts = registry.providers[provider];

  if (!providerAccounts) {
    return [];
  }

  return Object.entries(providerAccounts.accounts).map(([id, meta]) => ({
    id,
    provider,
    isDefault: id === providerAccounts.default,
    ...meta,
  }));
}

/**
 * Get default account for a provider
 */
export function getDefaultAccount(provider: CLIProxyProvider): AccountInfo | null {
  const accounts = getProviderAccounts(provider);
  return accounts.find((a) => a.isDefault) || accounts[0] || null;
}

/**
 * Get specific account by ID
 */
export function getAccount(provider: CLIProxyProvider, accountId: string): AccountInfo | null {
  const accounts = getProviderAccounts(provider);
  return accounts.find((a) => a.id === accountId) || null;
}

/**
 * Find account by query (nickname, email, or id)
 * Supports partial matching for convenience
 */
export function findAccountByQuery(provider: CLIProxyProvider, query: string): AccountInfo | null {
  const accounts = getProviderAccounts(provider);
  const lowerQuery = query.toLowerCase();

  // Exact match first (id, email, nickname)
  const exactMatch = accounts.find(
    (a) =>
      a.id === query ||
      a.email?.toLowerCase() === lowerQuery ||
      a.nickname?.toLowerCase() === lowerQuery
  );
  if (exactMatch) return exactMatch;

  // Partial match on nickname or email prefix
  const partialMatch = accounts.find(
    (a) =>
      a.nickname?.toLowerCase().startsWith(lowerQuery) ||
      a.email?.toLowerCase().startsWith(lowerQuery)
  );
  return partialMatch || null;
}

/**
 * Register a new account
 * Called after successful OAuth to record the account
 *
 * For providers without email (kiro, ghcp):
 * - nickname is REQUIRED and used as accountId
 * - Uniqueness is enforced to prevent overwriting
 *
 * For providers with email:
 * - email is used as accountId
 * - nickname is auto-generated from email if not provided
 */
export function registerAccount(
  provider: CLIProxyProvider,
  tokenFile: string,
  email?: string,
  nickname?: string,
  projectId?: string
): AccountInfo {
  const registry = loadAccountsRegistry();

  // Initialize provider section if needed
  if (!registry.providers[provider]) {
    registry.providers[provider] = {
      default: 'default',
      accounts: {},
    };
  }

  const providerAccounts = registry.providers[provider];
  if (!providerAccounts) {
    throw new Error('Failed to initialize provider accounts');
  }

  // Determine account ID based on provider type
  let accountId: string;
  let accountNickname: string;

  if (PROVIDERS_WITHOUT_EMAIL.includes(provider)) {
    // For kiro/ghcp: nickname is REQUIRED and used as accountId
    if (!nickname || nickname === 'default') {
      throw new Error(
        `Nickname is required when adding ${provider} accounts. ` +
          `Use --nickname <name> or provide a nickname in the UI.`
      );
    }

    // Validate nickname format
    const validationError = validateNickname(nickname);
    if (validationError) {
      throw new Error(validationError);
    }

    // Check uniqueness
    for (const [existingId, _account] of Object.entries(providerAccounts.accounts)) {
      if (existingId.toLowerCase() === nickname.toLowerCase()) {
        throw new Error(
          `An account with nickname "${nickname}" already exists for ${provider}. ` +
            `Choose a different nickname.`
        );
      }
    }

    accountId = nickname;
    accountNickname = nickname;
  } else {
    // For other providers: use email as accountId, fallback to filename extraction
    accountId = extractAccountIdFromTokenFile(tokenFile, email);
    accountNickname = nickname || generateNickname(email);
  }

  const isFirstAccount = Object.keys(providerAccounts.accounts).length === 0;

  // Create or update account
  const accountMeta: Omit<AccountInfo, 'id' | 'provider' | 'isDefault'> = {
    email,
    nickname: accountNickname,
    tokenFile,
    createdAt: new Date().toISOString(),
    lastUsedAt: new Date().toISOString(),
  };

  // Include projectId for Antigravity accounts
  if (provider === 'agy' && projectId) {
    accountMeta.projectId = projectId;
  }

  providerAccounts.accounts[accountId] = accountMeta;

  // Set as default if first account
  if (isFirstAccount) {
    providerAccounts.default = accountId;
  }

  saveAccountsRegistry(registry);

  return {
    id: accountId,
    provider,
    isDefault: accountId === providerAccounts.default,
    email,
    nickname: accountNickname,
    tokenFile,
    createdAt: providerAccounts.accounts[accountId].createdAt,
    lastUsedAt: providerAccounts.accounts[accountId].lastUsedAt,
    projectId: providerAccounts.accounts[accountId].projectId,
  };
}

/**
 * Set default account for a provider
 */
export function setDefaultAccount(provider: CLIProxyProvider, accountId: string): boolean {
  const registry = loadAccountsRegistry();
  const providerAccounts = registry.providers[provider];

  if (!providerAccounts || !providerAccounts.accounts[accountId]) {
    return false;
  }

  providerAccounts.default = accountId;
  saveAccountsRegistry(registry);
  return true;
}

/**
 * Pause an account (skip in quota rotation)
 * Moves token file to paused/ subdir so CLIProxyAPI won't discover it
 */
export function pauseAccount(provider: CLIProxyProvider, accountId: string): boolean {
  const registry = loadAccountsRegistry();
  const providerAccounts = registry.providers[provider];

  if (!providerAccounts?.accounts[accountId]) {
    return false;
  }

  const accountMeta = providerAccounts.accounts[accountId];

  // Skip if already paused (idempotent)
  if (accountMeta.paused) {
    return true;
  }

  const authDir = getAuthDir();
  const pausedDir = getPausedDir();
  const tokenPath = path.join(authDir, accountMeta.tokenFile);
  const pausedPath = path.join(pausedDir, accountMeta.tokenFile);

  // Move token file to paused directory (if it exists in auth dir)
  if (fs.existsSync(tokenPath)) {
    try {
      // Create paused directory if it doesn't exist
      if (!fs.existsSync(pausedDir)) {
        fs.mkdirSync(pausedDir, { recursive: true, mode: 0o700 });
      }
      fs.renameSync(tokenPath, pausedPath);
    } catch {
      // File operation failed, but continue with registry update
      // syncRegistryWithTokenFiles() will handle recovery on next load
    }
  }

  providerAccounts.accounts[accountId].paused = true;
  providerAccounts.accounts[accountId].pausedAt = new Date().toISOString();
  saveAccountsRegistry(registry);
  return true;
}

/**
 * Resume a paused account
 * Moves token file back from paused/ to auth/ so CLIProxyAPI can discover it
 */
export function resumeAccount(provider: CLIProxyProvider, accountId: string): boolean {
  const registry = loadAccountsRegistry();
  const providerAccounts = registry.providers[provider];

  if (!providerAccounts?.accounts[accountId]) {
    return false;
  }

  const accountMeta = providerAccounts.accounts[accountId];

  // Skip if already active (idempotent)
  if (!accountMeta.paused) {
    return true;
  }

  const authDir = getAuthDir();
  const pausedDir = getPausedDir();
  const tokenPath = path.join(authDir, accountMeta.tokenFile);
  const pausedPath = path.join(pausedDir, accountMeta.tokenFile);

  // Move token file back from paused directory (if it exists in paused dir)
  if (fs.existsSync(pausedPath)) {
    try {
      fs.renameSync(pausedPath, tokenPath);
    } catch {
      // File operation failed, but continue with registry update
      // syncRegistryWithTokenFiles() will handle recovery on next load
    }
  }

  providerAccounts.accounts[accountId].paused = false;
  providerAccounts.accounts[accountId].pausedAt = undefined;
  saveAccountsRegistry(registry);
  return true;
}

/**
 * Check if an account is paused
 */
export function isAccountPaused(provider: CLIProxyProvider, accountId: string): boolean {
  const accounts = getProviderAccounts(provider);
  const account = accounts.find((a) => a.id === accountId);
  return account?.paused ?? false;
}

/**
 * Update account tier
 */
export function setAccountTier(
  provider: CLIProxyProvider,
  accountId: string,
  tier: AccountTier
): boolean {
  const registry = loadAccountsRegistry();
  const providerAccounts = registry.providers[provider];

  if (!providerAccounts?.accounts[accountId]) {
    return false;
  }

  providerAccounts.accounts[accountId].tier = tier;
  saveAccountsRegistry(registry);
  return true;
}

/**
 * Get non-paused accounts for a provider
 */
export function getActiveAccounts(provider: CLIProxyProvider): AccountInfo[] {
  return getProviderAccounts(provider).filter((a) => !a.paused);
}

/**
 * Remove an account
 */
export function removeAccount(provider: CLIProxyProvider, accountId: string): boolean {
  const registry = loadAccountsRegistry();
  const providerAccounts = registry.providers[provider];

  if (!providerAccounts || !providerAccounts.accounts[accountId]) {
    return false;
  }

  // Get token file to delete (check both auth and paused directories)
  const tokenFile = providerAccounts.accounts[accountId].tokenFile;
  const tokenPath = path.join(getAuthDir(), tokenFile);
  const pausedPath = path.join(getPausedDir(), tokenFile);

  // Delete token file from auth directory
  if (fs.existsSync(tokenPath)) {
    try {
      fs.unlinkSync(tokenPath);
    } catch {
      // Ignore deletion errors
    }
  }

  // Also delete from paused directory if it exists there
  if (fs.existsSync(pausedPath)) {
    try {
      fs.unlinkSync(pausedPath);
    } catch {
      // Ignore deletion errors
    }
  }

  // Remove from registry
  delete providerAccounts.accounts[accountId];

  // Update default if needed
  const remainingAccounts = Object.keys(providerAccounts.accounts);
  if (providerAccounts.default === accountId && remainingAccounts.length > 0) {
    providerAccounts.default = remainingAccounts[0];
  }

  saveAccountsRegistry(registry);
  return true;
}

/**
 * Rename an account's nickname
 */
export function renameAccount(
  provider: CLIProxyProvider,
  accountId: string,
  newNickname: string
): boolean {
  const validationError = validateNickname(newNickname);
  if (validationError) {
    throw new Error(validationError);
  }

  const registry = loadAccountsRegistry();
  const providerAccounts = registry.providers[provider];

  if (!providerAccounts?.accounts[accountId]) {
    return false;
  }

  // Check if nickname is already used by another account
  for (const [id, account] of Object.entries(providerAccounts.accounts)) {
    if (id !== accountId && account.nickname?.toLowerCase() === newNickname.toLowerCase()) {
      throw new Error(`Nickname "${newNickname}" is already used by another account`);
    }
  }

  providerAccounts.accounts[accountId].nickname = newNickname;
  saveAccountsRegistry(registry);
  return true;
}

/**
 * Update last used timestamp for an account
 */
export function touchAccount(provider: CLIProxyProvider, accountId: string): void {
  const registry = loadAccountsRegistry();
  const providerAccounts = registry.providers[provider];

  if (providerAccounts?.accounts[accountId]) {
    providerAccounts.accounts[accountId].lastUsedAt = new Date().toISOString();
    saveAccountsRegistry(registry);
  }
}

/**
 * Get token file path for an account
 * Returns path in paused/ dir if account is paused, otherwise auth/
 */
export function getAccountTokenPath(provider: CLIProxyProvider, accountId?: string): string | null {
  const account = accountId ? getAccount(provider, accountId) : getDefaultAccount(provider);

  if (!account) {
    return null;
  }

  // Return path from paused directory if account is paused
  const baseDir = account.paused ? getPausedDir() : getAuthDir();
  return path.join(baseDir, account.tokenFile);
}

/**
 * Auto-discover accounts from existing token files
 * Called during migration or first run to populate accounts registry
 *
 * For kiro/ghcp providers without email, generates unique accountId from:
 * 1. OAuth provider + profile ID from filename (e.g., github-ABC123)
 * 2. Fallback: provider + index (e.g., kiro-1, kiro-2)
 */
export function discoverExistingAccounts(): void {
  const authDir = getAuthDir();

  if (!fs.existsSync(authDir)) {
    return;
  }

  const registry = loadAccountsRegistry();
  const files = fs.readdirSync(authDir);

  for (const file of files) {
    if (!file.endsWith('.json')) continue;

    const filePath = path.join(authDir, file);

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);

      // Skip if no type field
      if (!data.type) continue;

      // Build reverse mapping from PROVIDER_TYPE_VALUES (type value -> provider)
      // e.g., "antigravity" -> "agy", "kiro" -> "kiro", "codewhisperer" -> "kiro"
      const typeValue = data.type.toLowerCase();
      let provider: CLIProxyProvider | undefined;
      for (const [prov, typeValues] of Object.entries(PROVIDER_TYPE_VALUES)) {
        if (typeValues.includes(typeValue)) {
          provider = prov as CLIProxyProvider;
          break;
        }
      }

      // Skip if unknown provider type
      if (!provider) {
        continue;
      }

      // Extract email if available, fallback to filename-based ID
      let email = data.email || undefined;

      // Fallback: extract email from filename (e.g., "kiro-google-user@example.com.json")
      if (!email && file.includes('@')) {
        const match = file.match(/([^-]+@[^.]+\.[^.]+)(?=\.json$)/);
        if (match) {
          email = match[1];
        }
      }

      // Initialize provider section if needed
      if (!registry.providers[provider]) {
        registry.providers[provider] = {
          default: 'default',
          accounts: {},
        };
      }

      const providerAccounts = registry.providers[provider];
      if (!providerAccounts) continue;

      // Skip if token file already registered (under any accountId)
      const existingTokenFiles = Object.values(providerAccounts.accounts).map((a) => a.tokenFile);
      if (existingTokenFiles.includes(file)) {
        // Token file exists - check if we need to update projectId for agy accounts
        const projectIdValue =
          typeof data.project_id === 'string' && data.project_id.trim()
            ? data.project_id.trim()
            : null;
        if (provider === 'agy' && projectIdValue) {
          const existingEntry = Object.entries(providerAccounts.accounts).find(
            ([, meta]) => meta.tokenFile === file
          );
          // Update if missing or changed
          if (existingEntry && existingEntry[1].projectId !== projectIdValue) {
            existingEntry[1].projectId = projectIdValue;
          }
        }
        continue;
      }

      // Determine accountId based on provider type
      let accountId: string;

      if (PROVIDERS_WITHOUT_EMAIL.includes(provider) && !email) {
        // For kiro/ghcp without email: extract from filename or generate unique
        // Pattern: kiro-github-ABC123.json -> github-ABC123
        const filenameId = extractAccountIdFromTokenFile(file, undefined);

        if (filenameId !== 'default') {
          accountId = filenameId;
        } else {
          // Generate unique ID: provider + incrementing index
          let index = 1;
          while (providerAccounts.accounts[`${provider}-${index}`]) {
            index++;
          }
          accountId = `${provider}-${index}`;
        }
      } else {
        // For providers with email: use email or filename extraction
        accountId = extractAccountIdFromTokenFile(file, email);
      }

      // Skip if account already registered
      if (providerAccounts.accounts[accountId]) {
        continue;
      }

      // Set as default if first account
      if (Object.keys(providerAccounts.accounts).length === 0) {
        providerAccounts.default = accountId;
      }

      // Get file stats for creation time
      const stats = fs.statSync(filePath);

      // Register account with auto-generated nickname
      // Use mtime as lastUsedAt (when token was last modified = last auth/refresh)
      const lastModified = stats.mtime || stats.birthtime || new Date();
      const accountMeta: Omit<AccountInfo, 'id' | 'provider' | 'isDefault'> = {
        email,
        nickname: generateNickname(email),
        tokenFile: file,
        createdAt: stats.birthtime?.toISOString() || new Date().toISOString(),
        lastUsedAt: lastModified.toISOString(),
      };

      // Read project_id for Antigravity accounts (read-only field from auth token)
      const discoveredProjectId =
        typeof data.project_id === 'string' && data.project_id.trim()
          ? data.project_id.trim()
          : null;
      if (provider === 'agy' && discoveredProjectId) {
        accountMeta.projectId = discoveredProjectId;
      }

      providerAccounts.accounts[accountId] = accountMeta;
    } catch {
      // Skip invalid files
      continue;
    }
  }

  // Reload-merge pattern: reduce race condition with concurrent OAuth registration
  // Reload fresh registry and merge discovered accounts (fresh registry wins on conflicts)
  const freshRegistry = loadAccountsRegistry();
  for (const [providerName, discovered] of Object.entries(registry.providers)) {
    if (!discovered) continue;
    const prov = providerName as CLIProxyProvider;
    if (!freshRegistry.providers[prov]) {
      freshRegistry.providers[prov] = discovered;
    } else {
      // Merge accounts, preferring fresh registry's existing entries but updating projectId
      const freshProviderAccounts = freshRegistry.providers[prov];
      if (!freshProviderAccounts) continue;
      for (const [id, meta] of Object.entries(discovered.accounts)) {
        if (!freshProviderAccounts.accounts[id]) {
          freshProviderAccounts.accounts[id] = meta;
          // Set default if none exists
          if (!freshProviderAccounts.default || freshProviderAccounts.default === 'default') {
            freshProviderAccounts.default = id;
          }
        } else if (meta.projectId && !freshProviderAccounts.accounts[id].projectId) {
          // Update existing account with projectId if discovered from auth file
          freshProviderAccounts.accounts[id].projectId = meta.projectId;
        }
      }
    }
  }
  saveAccountsRegistry(freshRegistry);
}

/** Result of bulk pause/resume operations */
export interface BulkOperationResult {
  succeeded: string[];
  failed: Array<{ id: string; reason: string }>;
}

/** Result of solo account operation */
export interface SoloOperationResult {
  activated: string;
  paused: string[];
}

/** Provider-level locks for preventing race conditions in solo mode */
const providerLocks = new Map<CLIProxyProvider, Promise<unknown>>();

/**
 * Bulk pause multiple accounts
 * Pauses each account, collecting successes and failures (no fail-fast)
 */
export function bulkPauseAccounts(
  provider: CLIProxyProvider,
  accountIds: string[]
): BulkOperationResult {
  const result: BulkOperationResult = { succeeded: [], failed: [] };

  for (const id of accountIds) {
    const success = pauseAccount(provider, id);
    if (success) {
      result.succeeded.push(id);
    } else {
      result.failed.push({ id, reason: 'Account not found' });
    }
  }

  return result;
}

/**
 * Bulk resume multiple accounts
 * Resumes each account, collecting successes and failures (no fail-fast)
 */
export function bulkResumeAccounts(
  provider: CLIProxyProvider,
  accountIds: string[]
): BulkOperationResult {
  const result: BulkOperationResult = { succeeded: [], failed: [] };

  for (const id of accountIds) {
    const success = resumeAccount(provider, id);
    if (success) {
      result.succeeded.push(id);
    } else {
      result.failed.push({ id, reason: 'Account not found' });
    }
  }

  return result;
}

/**
 * Solo mode: activate one account, pause all others in same provider
 * Per validation: auto-resumes target if paused, keeps default unchanged
 */
export async function soloAccount(
  provider: CLIProxyProvider,
  accountId: string
): Promise<SoloOperationResult | null> {
  // Wait for any pending operation on this provider
  const pending = providerLocks.get(provider);
  if (pending) await pending;

  const operation = (async () => {
    const accounts = getProviderAccounts(provider);
    const targetAccount = accounts.find((a) => a.id === accountId);

    if (!targetAccount) {
      return null;
    }

    const result: SoloOperationResult = { activated: accountId, paused: [] };

    // Resume target account if paused (per validation decision)
    if (targetAccount.paused) {
      resumeAccount(provider, accountId);
    }

    // Pause all other accounts
    for (const account of accounts) {
      if (account.id !== accountId && !account.paused) {
        const success = pauseAccount(provider, account.id);
        if (success) {
          result.paused.push(account.id);
        }
      }
    }

    return result;
  })();

  providerLocks.set(provider, operation);
  try {
    return await operation;
  } finally {
    providerLocks.delete(provider);
  }
}

/**
 * Get summary of all accounts across providers
 */
export function getAllAccountsSummary(): Record<CLIProxyProvider, AccountInfo[]> {
  const providers: CLIProxyProvider[] = ['gemini', 'codex', 'agy', 'qwen', 'iflow', 'kiro', 'ghcp'];
  const summary: Record<CLIProxyProvider, AccountInfo[]> = {} as Record<
    CLIProxyProvider,
    AccountInfo[]
  >;

  for (const provider of providers) {
    summary[provider] = getProviderAccounts(provider);
  }

  return summary;
}
