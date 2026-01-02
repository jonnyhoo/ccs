/**
 * API Key Pre-flight Validator
 *
 * Quick validation of API keys before Claude CLI launch.
 * Catches expired keys early with actionable error messages.
 */

import * as http from 'http';
import * as https from 'https';
import { URL } from 'url';

export interface ValidationResult {
  valid: boolean;
  error?: string;
  suggestion?: string;
}

/** Default placeholders that indicate unconfigured keys */
const DEFAULT_PLACEHOLDERS = [
  'YOUR_GLM_API_KEY_HERE',
  'YOUR_KIMI_API_KEY_HERE',
  'YOUR_MINIMAX_API_KEY_HERE',
  'YOUR_API_KEY_HERE',
  'YOUR-API-KEY-HERE',
  'PLACEHOLDER',
  '',
];

/**
 * Validate GLM API key with quick health check
 *
 * @param apiKey - The ANTHROPIC_AUTH_TOKEN value
 * @param baseUrl - Optional base URL (defaults to Z.AI)
 * @param timeoutMs - Timeout in milliseconds (default 2000)
 */
export async function validateGlmKey(
  apiKey: string,
  baseUrl?: string,
  timeoutMs = 2000
): Promise<ValidationResult> {
  // Skip if disabled
  if (process.env.CCS_SKIP_PREFLIGHT === '1') {
    return { valid: true };
  }

  // Basic format check - detect placeholders
  if (!apiKey || DEFAULT_PLACEHOLDERS.includes(apiKey.toUpperCase())) {
    return {
      valid: false,
      error: 'API key not configured',
      suggestion:
        'Set ANTHROPIC_AUTH_TOKEN in ~/.ccs/glm.settings.json\n' +
        'Or run: ccs config -> API Profiles -> GLM',
    };
  }

  // Determine validation endpoint
  // Z.AI uses /api/anthropic path, we can test with a minimal request
  const targetBase = baseUrl || 'https://api.z.ai';
  let url: URL;
  try {
    url = new URL('/api/anthropic/v1/models', targetBase);
  } catch {
    // Invalid URL - fail-open
    return { valid: true };
  }

  return new Promise((resolve) => {
    // Determine protocol - use http module for http:// URLs
    const isHttps = url.protocol === 'https:';
    const httpModule = isHttps ? https : http;
    const defaultPort = isHttps ? 443 : 80;

    const options: https.RequestOptions = {
      hostname: url.hostname,
      port: url.port || defaultPort,
      path: url.pathname,
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'User-Agent': 'CCS-Preflight/1.0',
      },
    };

    const req = httpModule.request(options, (res) => {
      clearTimeout(timeoutId);

      if (res.statusCode === 200) {
        resolve({ valid: true });
      } else if (res.statusCode === 401 || res.statusCode === 403) {
        resolve({
          valid: false,
          error: 'API key rejected by Z.AI',
          suggestion:
            'Your key may have expired. To fix:\n' +
            '  1. Go to Z.AI dashboard and regenerate your API key\n' +
            '  2. Update ~/.ccs/glm.settings.json with the new key\n' +
            '  3. Or run: ccs config -> API Profiles -> GLM',
        });
      } else {
        // Other errors (404, 500, etc.) - fail-open, let Claude CLI handle
        // Debug log for diagnostics when CCS_DEBUG is set
        if (process.env.CCS_DEBUG === '1') {
          console.error(
            `[CCS-Preflight] Unexpected status ${res.statusCode} from ${url.href} - fail-open`
          );
        }
        resolve({ valid: true });
      }

      // Consume response body to free resources
      res.resume();
    });

    req.on('error', () => {
      clearTimeout(timeoutId);
      // Network error - fail-open
      resolve({ valid: true });
    });

    // Set timeout after request is created so we can destroy it on timeout
    const timeoutId = setTimeout(() => {
      // Abort request to prevent TCP connection leak
      req.destroy();
      // Fail-open on timeout - let Claude CLI handle it
      resolve({ valid: true });
    }, timeoutMs);

    req.end();
  });
}

/**
 * Validate MiniMax API key with quick health check
 *
 * @param apiKey - The ANTHROPIC_AUTH_TOKEN value
 * @param baseUrl - Optional base URL (defaults to MiniMax)
 * @param timeoutMs - Timeout in milliseconds (default 2000)
 */
export async function validateMiniMaxKey(
  apiKey: string,
  baseUrl?: string,
  timeoutMs = 2000
): Promise<ValidationResult> {
  // Skip if disabled
  if (process.env.CCS_SKIP_PREFLIGHT === '1') {
    return { valid: true };
  }

  // Basic format check - detect placeholders
  if (!apiKey || DEFAULT_PLACEHOLDERS.includes(apiKey.toUpperCase())) {
    return {
      valid: false,
      error: 'API key not configured',
      suggestion:
        'Set ANTHROPIC_AUTH_TOKEN in ~/.ccs/mm.settings.json\n' +
        'Or run: ccs config -> API Profiles -> MiniMax',
    };
  }

  // Determine validation endpoint
  // MiniMax uses /anthropic path, we can test with a minimal request
  const targetBase = baseUrl || 'https://api.minimax.io';
  let url: URL;
  try {
    url = new URL('/anthropic/v1/models', targetBase);
  } catch {
    // Invalid URL - fail-open
    return { valid: true };
  }

  return new Promise((resolve) => {
    // Determine protocol - use http module for http:// URLs
    const isHttps = url.protocol === 'https:';
    const httpModule = isHttps ? https : http;
    const defaultPort = isHttps ? 443 : 80;

    const options: https.RequestOptions = {
      hostname: url.hostname,
      port: url.port || defaultPort,
      path: url.pathname,
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'User-Agent': 'CCS-Preflight/1.0',
      },
    };

    const req = httpModule.request(options, (res) => {
      clearTimeout(timeoutId);

      if (res.statusCode === 200) {
        resolve({ valid: true });
      } else if (res.statusCode === 401 || res.statusCode === 403) {
        resolve({
          valid: false,
          error: 'API key rejected by MiniMax',
          suggestion:
            'Your key may have expired. To fix:\n' +
            '  1. Go to platform.minimax.io and regenerate your API key\n' +
            '  2. Update ~/.ccs/mm.settings.json with new key\n' +
            '  3. Or run: ccs config -> API Profiles -> MiniMax',
        });
      } else {
        // Other errors (404, 500, etc.) - fail-open, let Claude CLI handle
        // Debug log for diagnostics when CCS_DEBUG is set
        if (process.env.CCS_DEBUG === '1') {
          console.error(
            `[CCS-Preflight] Unexpected status ${res.statusCode} from ${url.href} - fail-open`
          );
        }
        resolve({ valid: true });
      }

      // Consume response body to free resources
      res.resume();
    });

    req.on('error', () => {
      clearTimeout(timeoutId);
      // Network error - fail-open
      resolve({ valid: true });
    });

    // Set timeout after request is created so we can destroy it on timeout
    const timeoutId = setTimeout(() => {
      // Abort request to prevent TCP connection leak
      req.destroy();
      // Fail-open on timeout - let Claude CLI handle it
      resolve({ valid: true });
    }, timeoutMs);

    req.end();
  });
}
