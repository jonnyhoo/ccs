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

/** Tracks the source path of the last read token (for write-back) */
let lastTokenSourcePath: string | null = null;

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
 * Read Gemini token from CLIProxy auth directory
 * Returns null if no valid token found
 */
function readCliproxyGeminiCreds(): GeminiOAuthCreds | null {
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
      return null;
    }
  }

  if (!tokenPath) return null;

  try {
    const content = fs.readFileSync(tokenPath, 'utf8');
    const data = JSON.parse(content);

    // Check if this is CLIProxyAPI format (has nested token object)
    if (data.type === 'gemini' && data.token) {
      lastTokenSourcePath = tokenPath;
      return mapCliproxyToGeminiCreds(data as CliproxyGeminiToken);
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Read Gemini OAuth credentials
 * Priority: CLIProxy auth dir first, then ~/.gemini/oauth_creds.json
 */
function readGeminiCreds(): GeminiOAuthCreds | null {
  // 1. Try CLIProxy auth directory first (CCS-managed tokens)
  const cliproxyCreds = readCliproxyGeminiCreds();
  if (cliproxyCreds) {
    return cliproxyCreds;
  }

  // 2. Fall back to standard Gemini CLI location
  const oauthPath = getGeminiOAuthPath();
  if (!fs.existsSync(oauthPath)) {
    return null;
  }
  try {
    lastTokenSourcePath = oauthPath;
    const content = fs.readFileSync(oauthPath, 'utf8');
    return JSON.parse(content) as GeminiOAuthCreds;
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
 * Writes back to the source location (CLIProxy or ~/.gemini)
 * @returns error message if write failed, undefined on success
 */
function writeGeminiCreds(creds: GeminiOAuthCreds): string | undefined {
  // If we read from CLIProxy, write back there in CLIProxy format
  if (lastTokenSourcePath && !lastTokenSourcePath.includes('.gemini')) {
    return writeCliproxyGeminiCreds(lastTokenSourcePath, creds);
  }

  // Otherwise write to standard Gemini CLI location
  const oauthPath = getGeminiOAuthPath();
  const dir = path.dirname(oauthPath);
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    }
    fs.writeFileSync(oauthPath, JSON.stringify(creds, null, 2), { mode: 0o600 });
    return undefined;
  } catch (err) {
    return err instanceof Error ? err.message : 'Failed to write credentials';
  }
}

/**
 * Check if Gemini token is expired or expiring soon
 */
export function isGeminiTokenExpiringSoon(): boolean {
  const creds = readGeminiCreds();
  if (!creds || !creds.access_token) {
    return true; // No token = needs auth
  }
  if (!creds.expiry_date) {
    return false; // No expiry info = assume valid
  }
  const expiresIn = creds.expiry_date - Date.now();
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
  const creds = readGeminiCreds();
  if (!creds || !creds.refresh_token) {
    return { success: false, error: 'No refresh token available' };
  }

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
        refresh_token: creds.refresh_token,
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
    const writeError = writeGeminiCreds(updatedCreds);
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
  const creds = readGeminiCreds();
  if (!creds || !creds.access_token) {
    return { valid: false, refreshed: false, error: 'No Gemini credentials found' };
  }

  if (!isGeminiTokenExpiringSoon()) {
    return { valid: true, refreshed: false };
  }

  // Token is expired or expiring soon - try to refresh
  if (verbose) {
    console.log('[i] Gemini token expired or expiring soon, refreshing...');
  }

  const result = await refreshGeminiToken();
  if (result.success) {
    if (verbose) {
      console.log('[OK] Gemini token refreshed successfully');
    }
    return { valid: true, refreshed: true };
  }

  return { valid: false, refreshed: false, error: result.error };
}
