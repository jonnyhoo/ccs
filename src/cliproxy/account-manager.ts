/**
 * Account Manager for CLIProxyAPI Multi-Account Support
 *
 * Manages multiple OAuth accounts per provider (Gemini, Codex, etc.).
 * Each provider can have multiple accounts, with one designated as default.
 *
 * Account storage: ~/.ccs/cliproxy/accounts.json
 * Token storage: ~/.ccs/cliproxy/auth/ (flat structure, CLIProxyAPI discovers by type field)
 */

import * as fs from 'fs';
import * as path from 'path';
import { CLIProxyProvider } from './types';
import { getCliproxyDir, getAuthDir } from './config-generator';

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
 * Rules: 1-50 chars, any non-whitespace allowed (permissive)
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
  return null;
}

/**
 * Get path to accounts registry file
 */
export function getAccountsRegistryPath(): string {
  return path.join(getCliproxyDir(), 'accounts.json');
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
 * Called automatically when loading accounts
 */
function syncRegistryWithTokenFiles(registry: AccountsRegistry): boolean {
  const authDir = getAuthDir();
  let modified = false;

  for (const [_providerName, providerAccounts] of Object.entries(registry.providers)) {
    if (!providerAccounts) continue;

    const staleIds: string[] = [];

    for (const [accountId, meta] of Object.entries(providerAccounts.accounts)) {
      const tokenPath = path.join(authDir, meta.tokenFile);
      if (!fs.existsSync(tokenPath)) {
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
 */
export function registerAccount(
  provider: CLIProxyProvider,
  tokenFile: string,
  email?: string,
  nickname?: string
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

  // Determine account ID
  const accountId = email || 'default';
  const isFirstAccount = Object.keys(providerAccounts.accounts).length === 0;

  // Generate nickname if not provided
  const accountNickname = nickname || generateNickname(email);

  // Create or update account
  providerAccounts.accounts[accountId] = {
    email,
    nickname: accountNickname,
    tokenFile,
    createdAt: new Date().toISOString(),
    lastUsedAt: new Date().toISOString(),
  };

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
 * Remove an account
 */
export function removeAccount(provider: CLIProxyProvider, accountId: string): boolean {
  const registry = loadAccountsRegistry();
  const providerAccounts = registry.providers[provider];

  if (!providerAccounts || !providerAccounts.accounts[accountId]) {
    return false;
  }

  // Get token file to delete
  const tokenFile = providerAccounts.accounts[accountId].tokenFile;
  const tokenPath = path.join(getAuthDir(), tokenFile);

  // Delete token file
  if (fs.existsSync(tokenPath)) {
    try {
      fs.unlinkSync(tokenPath);
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
 */
export function getAccountTokenPath(provider: CLIProxyProvider, accountId?: string): string | null {
  const account = accountId ? getAccount(provider, accountId) : getDefaultAccount(provider);

  if (!account) {
    return null;
  }

  return path.join(getAuthDir(), account.tokenFile);
}

/**
 * Auto-discover accounts from existing token files
 * Called during migration or first run to populate accounts registry
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

      // Map token type values to internal provider names
      // CLIProxyAPI uses different type values in tokens (e.g., "antigravity" vs "agy")
      const typeToProvider: Record<string, CLIProxyProvider> = {
        gemini: 'gemini',
        antigravity: 'agy',
        codex: 'codex',
        qwen: 'qwen',
        iflow: 'iflow',
      };

      const typeValue = data.type.toLowerCase();
      const provider = typeToProvider[typeValue];

      // Skip if unknown provider type
      if (!provider) {
        continue;
      }

      // Extract email if available
      const email = data.email || undefined;
      const accountId = email || 'default';

      // Initialize provider section if needed
      if (!registry.providers[provider]) {
        registry.providers[provider] = {
          default: accountId,
          accounts: {},
        };
      }

      const providerAccounts = registry.providers[provider];
      if (!providerAccounts) continue;

      // Skip if account already registered
      if (providerAccounts.accounts[accountId]) {
        continue;
      }

      // Get file stats for creation time
      const stats = fs.statSync(filePath);

      // Register account with auto-generated nickname
      providerAccounts.accounts[accountId] = {
        email,
        nickname: generateNickname(email),
        tokenFile: file,
        createdAt: stats.birthtime?.toISOString() || new Date().toISOString(),
        lastUsedAt: stats.mtime?.toISOString(),
      };
    } catch {
      // Skip invalid files
      continue;
    }
  }

  saveAccountsRegistry(registry);
}

/**
 * Get summary of all accounts across providers
 */
export function getAllAccountsSummary(): Record<CLIProxyProvider, AccountInfo[]> {
  const providers: CLIProxyProvider[] = ['gemini', 'codex', 'agy', 'qwen', 'iflow'];
  const summary: Record<CLIProxyProvider, AccountInfo[]> = {} as Record<
    CLIProxyProvider,
    AccountInfo[]
  >;

  for (const provider of providers) {
    summary[provider] = getProviderAccounts(provider);
  }

  return summary;
}
