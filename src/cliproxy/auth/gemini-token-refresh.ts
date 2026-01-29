/**
 * Gemini Token Refresh
 *
 * Handles proactive token validation and refresh for Gemini OAuth tokens.
 * Prevents UND_ERR_SOCKET errors by ensuring tokens are valid before use.
 *
 * Token sources (priority order):
 * 1. CLIProxy auth dir (~/.ccs/cliproxy/auth/) - CCS-managed tokens
 * 2. Standard Gemini CLI (~/.gemini/oauth_creds.json) - backward compatibility
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { getProviderAuthDir } from '../config-generator';
import { getDefaultAccount, getProviderAccounts } from '../account-manager';
import { isTokenFileForProvider } from './token-manager';

/**
 * Gemini OAuth credentials - PUBLIC from official Gemini CLI source code
 * These are not secrets - they're public OAuth client credentials that Google
 * distributes with their official applications. See:
 * https://github.com/google/generative-ai-python (Gemini CLI source)
 *
 * GitHub secret scanning may flag these, but they are intentionally hardcoded
 * as they're required for OAuth token refresh and are publicly documented.
 */

const GEMINI_CLIENT_ID = '681255809395-oo8ft2oprdrnp9e3aqf6av3hmdib135j.apps.googleusercontent.com';

const GEMINI_CLIENT_SECRET = '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';

/** Google OAuth token endpoint */
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

/** Refresh tokens 5 minutes before expiry */
const REFRESH_LEAD_TIME_MS = 5 * 60 * 1000;

/** Gemini oauth_creds.json structure */
interface GeminiOAuthCreds {
  access_token: string;
  refresh_token?: string;
  expiry_date?: number; // Unix timestamp in milliseconds
  scope?: string;
  token_type?: string;
  id_token?: string;
}

/** Gemini credentials with source path for write-back */
interface GeminiCredsWithSource {
  creds: GeminiOAuthCreds;
  sourcePath: string;
}

/** CLIProxyAPI Gemini token structure (from GeminiTokenStorage Go struct) */
interface CliproxyGeminiToken {
  token: {
    access_token: string;
    refresh_token?: string;
    expiry?: number; // Unix timestamp in milliseconds
  };
  project_id: string;
  email: string;
  type: 'gemini';
}

/** Token refresh response from Google */
interface TokenRefreshResponse {
  access_token?: string;
  expires_in?: number;
  token_type?: string;
  error?: string;
  error_description?: string;
}

/**
 * Get path to Gemini OAuth credentials file
 */
export function getGeminiOAuthPath(): string {
  return path.join(os.homedir(), '.gemini', 'oauth_creds.json');
}

/**
 * Map CLIProxyAPI token format to internal GeminiOAuthCreds format
 */
function mapCliproxyToGeminiCreds(cliproxy: CliproxyGeminiToken): GeminiOAuthCreds {
  return {
    access_token: cliproxy.token.access_token,
    refresh_token: cliproxy.token.refresh_token,
    expiry_date: cliproxy.token.expiry,
    token_type: 'Bearer',
  };
}

/**
 * Validate CLIProxyAPI token structure has required fields
 */
function isValidCliproxyToken(data: unknown): data is CliproxyGeminiToken {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;
  if (obj.type !== 'gemini') return false;
  if (typeof obj.token !== 'object' || obj.token === null) return false;
  const token = obj.token as Record<string, unknown>;
  return typeof token.access_token === 'string';
}

/**
 * Read Gemini token from CLIProxy auth directory
 * Returns credentials with source path, or null if no valid token found
 */
function readCliproxyGeminiCreds(): GeminiCredsWithSource | null {
  const authDir = getProviderAuthDir('gemini');
  if (!fs.existsSync(authDir)) return null;

  // Try to find default account's token file
  const defaultAccount = getDefaultAccount('gemini');
  let tokenPath: string | null = null;

  if (defaultAccount) {
    tokenPath = path.join(authDir, defaultAccount.tokenFile);
    if (!fs.existsSync(tokenPath)) tokenPath = null;
  }

  // Fallback: find any gemini token file by prefix or type
  if (!tokenPath) {
    const accounts = getProviderAccounts('gemini');
    if (accounts.length > 0) {
      tokenPath = path.join(authDir, accounts[0].tokenFile);
      if (!fs.existsSync(tokenPath)) tokenPath = null;
    }
  }

  // Last fallback: scan directory for gemini token files
  if (!tokenPath) {
    try {
      const files = fs.readdirSync(authDir).filter((f) => f.endsWith('.json'));
      for (const file of files) {
        const filePath = path.join(authDir, file);
        if (file.startsWith('gemini-') || isTokenFileForProvider(filePath, 'gemini')) {
          tokenPath = filePath;
          break;
        }
      }
    } catch {
      // Directory read failed - continue to return null
      return null;
    }
  }

  if (!tokenPath) return null;

  try {
    const content = fs.readFileSync(tokenPath, 'utf8');
    const data: unknown = JSON.parse(content);

    // Validate CLIProxyAPI format with proper type checking
    if (isValidCliproxyToken(data)) {
      return {
        creds: mapCliproxyToGeminiCreds(data),
        sourcePath: tokenPath,
      };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Read Gemini OAuth credentials
 * Priority: CLIProxy auth dir first, then ~/.gemini/oauth_creds.json
 * Returns credentials with source path for correct write-back
 */
function readGeminiCreds(): GeminiCredsWithSource | null {
  // 1. Try CLIProxy auth directory first (CCS-managed tokens)
  const cliproxyResult = readCliproxyGeminiCreds();
  if (cliproxyResult) {
    return cliproxyResult;
  }

  // 2. Fall back to standard Gemini CLI location
  const oauthPath = getGeminiOAuthPath();
  if (!fs.existsSync(oauthPath)) {
    return null;
  }
  try {
    const content = fs.readFileSync(oauthPath, 'utf8');
    return {
      creds: JSON.parse(content) as GeminiOAuthCreds,
      sourcePath: oauthPath,
    };
  } catch {
    return null;
  }
}

/**
 * Write updated credentials to CLIProxy token file
 * Preserves existing fields (email, project_id), only updates token subfields
 */
function writeCliproxyGeminiCreds(tokenPath: string, creds: GeminiOAuthCreds): string | undefined {
  try {
    const existing = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
    const updated = {
      ...existing,
      token: {
        ...existing.token,
        access_token: creds.access_token,
        refresh_token: creds.refresh_token,
        expiry: creds.expiry_date,
      },
    };
    fs.writeFileSync(tokenPath, JSON.stringify(updated, null, 2), { mode: 0o600 });
    return undefined;
  } catch (err) {
    return err instanceof Error ? err.message : 'Failed to write credentials';
  }
}

/**
 * Write Gemini OAuth credentials
 * Writes back to the specified source location (CLIProxy or ~/.gemini)
 * @param creds - The credentials to write
 * @param sourcePath - The path where credentials were originally read from
 * @returns error message if write failed, undefined on success
 */
function writeGeminiCreds(creds: GeminiOAuthCreds, sourcePath: string): string | undefined {
  const geminiOAuthPath = getGeminiOAuthPath();

  // If source is not the standard Gemini path, write to CLIProxy format
  if (sourcePath !== geminiOAuthPath) {
    return writeCliproxyGeminiCreds(sourcePath, creds);
  }

  // Otherwise write to standard Gemini CLI location
  const dir = path.dirname(geminiOAuthPath);
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    }
    fs.writeFileSync(geminiOAuthPath, JSON.stringify(creds, null, 2), { mode: 0o600 });
    return undefined;
  } catch (err) {
    return err instanceof Error ? err.message : 'Failed to write credentials';
  }
}

/**
 * Check if Gemini token is expired or expiring soon
 */
export function isGeminiTokenExpiringSoon(): boolean {
  const result = readGeminiCreds();
  if (!result || !result.creds.access_token) {
    return true; // No token = needs auth
  }
  if (!result.creds.expiry_date) {
    return false; // No expiry info = assume valid
  }
  const expiresIn = result.creds.expiry_date - Date.now();
  return expiresIn < REFRESH_LEAD_TIME_MS;
}

/**
 * Refresh Gemini access token using refresh_token
 * @returns Result with success status, optional error, and expiry time
 */
export async function refreshGeminiToken(): Promise<{
  success: boolean;
  error?: string;
  expiresAt?: number;
}> {
  const result = readGeminiCreds();
  if (!result || !result.creds.refresh_token) {
    return { success: false, error: 'No refresh token available' };
  }

  const { creds, sourcePath } = result;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: creds.refresh_token as string, // Already validated above
        client_id: GEMINI_CLIENT_ID,
        client_secret: GEMINI_CLIENT_SECRET,
      }).toString(),
    });

    clearTimeout(timeoutId);

    const data = (await response.json()) as TokenRefreshResponse;

    if (!response.ok || data.error) {
      return {
        success: false,
        error: data.error_description || data.error || `OAuth error: ${response.status}`,
      };
    }

    if (!data.access_token) {
      return { success: false, error: 'No access_token in response' };
    }

    // Update credentials file with new token
    const expiresAt = Date.now() + (data.expires_in ?? 3600) * 1000;
    const updatedCreds: GeminiOAuthCreds = {
      ...creds,
      access_token: data.access_token,
      expiry_date: expiresAt,
    };
    const writeError = writeGeminiCreds(updatedCreds, sourcePath);
    if (writeError) {
      return { success: false, error: `Token refreshed but failed to save: ${writeError}` };
    }

    return { success: true, expiresAt };
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === 'AbortError') {
      return { success: false, error: 'Token refresh timeout' };
    }
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Ensure Gemini token is valid, refreshing if needed
 * @param verbose Log progress if true
 * @returns true if token is valid (or was refreshed), false if refresh failed
 */
export async function ensureGeminiTokenValid(verbose = false): Promise<{
  valid: boolean;
  refreshed: boolean;
  error?: string;
}> {
  const result = readGeminiCreds();
  if (!result || !result.creds.access_token) {
    return { valid: false, refreshed: false, error: 'No Gemini credentials found' };
  }

  if (!isGeminiTokenExpiringSoon()) {
    return { valid: true, refreshed: false };
  }

  // Token is expired or expiring soon - try to refresh
  if (verbose) {
    console.log('[i] Gemini token expired or expiring soon, refreshing...');
  }

  const refreshResult = await refreshGeminiToken();
  if (refreshResult.success) {
    if (verbose) {
      console.log('[OK] Gemini token refreshed successfully');
    }
    return { valid: true, refreshed: true };
  }

  return { valid: false, refreshed: false, error: refreshResult.error };
}
