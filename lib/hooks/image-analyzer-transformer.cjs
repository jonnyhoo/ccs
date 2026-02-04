#!/usr/bin/env node
/**
 * CCS Image Analyzer Hook - Read Tool Interceptor
 *
 * Intercepts Claude's Read tool for image/PDF files and analyzes them via CLIProxy.
 * Returns detailed text descriptions instead of allowing direct visual access.
 *
 * Environment Variables (set by CCS):
 *   CCS_IMAGE_ANALYSIS_SKIP=1                 - Skip this hook entirely
 *   CCS_IMAGE_ANALYSIS_ENABLED=1              - Enable image analysis (default: 1)
 *   CCS_IMAGE_ANALYSIS_PROVIDER_MODELS        - Provider:model mapping (e.g., agy:gemini-2.5-flash,gemini:gemini-2.5-flash)
 *   CCS_CURRENT_PROVIDER                      - Current CLIProxy provider (e.g., agy, gemini, codex)
 *   CCS_IMAGE_ANALYSIS_TIMEOUT=60             - Timeout in seconds (default: 60)
 *   CCS_PROFILE_TYPE                          - Profile type (account/default skip)
 *   CCS_DEBUG=1                               - Enable debug output
 *
 * Exit codes:
 *   0 - Allow tool (pass-through to native Read)
 *   2 - Block tool (deny with analysis/message)
 *
 * @module hooks/image-analyzer-transformer
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

// ============================================================================
// PLATFORM DETECTION
// ============================================================================

const isWindows = process.platform === 'win32';

// ============================================================================
// CONFIGURATION
// ============================================================================

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.bmp', '.tiff'];
const PDF_EXTENSIONS = ['.pdf'];

const DEFAULT_MODEL = 'gemini-2.5-flash';
const DEFAULT_TIMEOUT_SEC = 60;
const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const CLIPROXY_HOST = '127.0.0.1';
const CLIPROXY_PORT = parseInt(process.env.CCS_CLIPROXY_PORT || '8317', 10);
const CLIPROXY_PATH = '/v1/messages';
// API key passed via env from cliproxy-executor, defaults to CCS internal key
const CLIPROXY_API_KEY = process.env.CCS_CLIPROXY_API_KEY || 'ccs-internal-managed';

// Default analysis prompt
const DEFAULT_PROMPT = `Analyze this image/document thoroughly and provide a detailed description.

Include:
1. Overall content and purpose
2. Text content (if any) - transcribe important text
3. Visual elements (diagrams, charts, UI components)
4. Layout and structure
5. Colors, styling, notable design elements
6. Any actionable information (buttons, links, code)

Be comprehensive - this description replaces direct visual access.`;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Parse provider_models env var to object
 * Format: provider:model,provider:model
 */
function parseProviderModels(envValue) {
  if (!envValue) return {};
  const result = {};
  envValue.split(',').forEach((pair) => {
    const [provider, model] = pair.split(':');
    if (provider && model && model.trim()) {
      result[provider.trim()] = model.trim();
    }
  });
  return result;
}

/**
 * Get model for current provider from provider_models mapping
 */
function getModelForProvider() {
  const currentProvider = process.env.CCS_CURRENT_PROVIDER || '';
  const providerModels = parseProviderModels(process.env.CCS_IMAGE_ANALYSIS_PROVIDER_MODELS);
  return providerModels[currentProvider] || DEFAULT_MODEL;
}

/**
 * Check if file is an analyzable image or PDF
 */
function isAnalyzableFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return IMAGE_EXTENSIONS.includes(ext) || PDF_EXTENSIONS.includes(ext);
}

/**
 * Get MIME type from file extension
 */
function getMediaType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.heic': 'image/heic',
    '.bmp': 'image/bmp',
    '.tiff': 'image/tiff',
    '.pdf': 'application/pdf',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

/**
 * Encode file to base64
 */
function encodeFileToBase64(filePath) {
  const content = fs.readFileSync(filePath);
  return content.toString('base64');
}

/**
 * Check if CLIProxy is available
 */
function isCliProxyAvailable() {
  return new Promise((resolve) => {
    const req = http.request(
      {
        hostname: CLIPROXY_HOST,
        port: CLIPROXY_PORT,
        path: '/',
        method: 'GET',
        timeout: 2000,
      },
      (res) => {
        resolve(res.statusCode >= 200 && res.statusCode < 500);
      }
    );

    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });

    req.end();
  });
}

/**
 * Analyze file via CLIProxy vision API
 */
function analyzeViaCliProxy(base64Data, mediaType, model, timeoutMs) {
  return new Promise((resolve, reject) => {
    const requestBody = JSON.stringify({
      model: model,
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: DEFAULT_PROMPT },
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: base64Data,
              },
            },
          ],
        },
      ],
    });

    const req = http.request(
      {
        hostname: CLIPROXY_HOST,
        port: CLIPROXY_PORT,
        path: CLIPROXY_PATH,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(requestBody),
          'x-api-key': CLIPROXY_API_KEY,
        },
        timeout: timeoutMs,
      },
      (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('error', (err) => {
          reject(err);
        });

        res.on('end', () => {
          if (res.statusCode !== 200) {
            reject(new Error(`CLIProxy returned status ${res.statusCode}: ${data}`));
            return;
          }

          if (!data || !data.trim()) {
            reject(new Error('Empty response from CLIProxy'));
            return;
          }

          try {
            const response = JSON.parse(data);
            const text = response.content?.[0]?.text;

            if (!text) {
              reject(new Error('No text content in response'));
              return;
            }

            resolve(text);
          } catch (err) {
            reject(new Error(`Failed to parse response: ${err.message}`));
          }
        });
      }
    );

    req.on('error', (err) => reject(err));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });

    req.write(requestBody);
    req.end();
  });
}

/**
 * Format analysis description for Claude (matches websearch format)
 */
function formatDescription(filePath, description, model, fileSize) {
  const sizeKB = fileSize ? (fileSize / 1024).toFixed(1) : '?';
  return [
    `[Image Analysis via CLIProxy]`,
    '',
    `File: ${path.basename(filePath)} (${sizeKB} KB)`,
    `Model: ${model}`,
    '',
    '---',
    '',
    description,
    '',
    '---',
    '*Use this description to understand the image content.*',
  ].join('\n');
}

/**
 * Output success response and exit
 */
function outputSuccess(filePath, description, model, fileSize) {
  const formattedDescription = formatDescription(filePath, description, model, fileSize);

  const output = {
    decision: 'block',
    reason: `Image analyzed: ${path.basename(filePath)}`,
    systemMessage: `[Image Analysis] ${path.basename(filePath)} analyzed via CLIProxy (${model})`,
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: formattedDescription,
    },
  };

  console.log(JSON.stringify(output));
  process.exit(2);
}

/**
 * Output error message
 */
function outputError(filePath, error) {
  const message = [
    `[Image Analysis - Error]`,
    '',
    `Failed to analyze: ${path.basename(filePath)}`,
    '',
    `Error: ${error}`,
    '',
    'Troubleshooting:',
    '  - Check CLIProxy is running: http://127.0.0.1:8317',
    '  - Verify you are authenticated with agy or gemini',
    '  - Check file size is under 10MB',
  ].join('\n');

  const output = {
    decision: 'block',
    reason: `Image analysis failed: ${error}`,
    systemMessage: `[Image Analysis] Failed to analyze ${path.basename(filePath)}`,
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: message,
    },
  };

  console.log(JSON.stringify(output));
  process.exit(2);
}

/**
 * Determine if hook should skip
 */
function shouldSkipHook() {
  // Explicit skip signal
  if (process.env.CCS_IMAGE_ANALYSIS_SKIP === '1') return true;

  // Explicit disable
  if (process.env.CCS_IMAGE_ANALYSIS_ENABLED === '0') return true;

  // Account/default profiles - use native Read
  const profileType = process.env.CCS_PROFILE_TYPE;
  if (profileType === 'account' || profileType === 'default') return true;

  // Check if current provider has a vision model configured
  const currentProvider = process.env.CCS_CURRENT_PROVIDER || '';
  const providerModels = parseProviderModels(process.env.CCS_IMAGE_ANALYSIS_PROVIDER_MODELS);
  if (!providerModels[currentProvider]) return true;

  return false;
}

// ============================================================================
// MAIN HOOK LOGIC
// ============================================================================

// Read input from stdin
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  input += chunk;
});
process.stdin.on('end', () => {
  processHook();
});

// Handle stdin not being available
process.stdin.on('error', () => {
  process.exit(0);
});

/**
 * Main hook processing logic
 */
async function processHook() {
  try {
    // Skip for native accounts or explicit disable
    if (shouldSkipHook()) {
      process.exit(0);
    }

    const data = JSON.parse(input);

    // Only handle Read tool
    if (data.tool_name !== 'Read') {
      process.exit(0);
    }

    const filePath = data.tool_input?.file_path || '';

    if (!filePath) {
      process.exit(0);
    }

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      // Let native Read handle the error
      process.exit(0);
    }

    // Check if file is analyzable
    if (!isAnalyzableFile(filePath)) {
      process.exit(0);
    }

    // Check file size
    const stats = fs.statSync(filePath);
    if (stats.size >= MAX_FILE_SIZE_BYTES) {
      outputError(filePath, `File too large (${(stats.size / 1024 / 1024).toFixed(2)}MB >= ${MAX_FILE_SIZE_MB}MB)`);
      return;
    }

    // Check CLIProxy availability
    const cliProxyAvailable = await isCliProxyAvailable();
    if (!cliProxyAvailable) {
      if (process.env.CCS_DEBUG) {
        console.error('[CCS Hook] CLIProxy not available, passing through');
      }
      // Pass through to native Read
      process.exit(0);
    }

    const model = getModelForProvider();
    const timeout = parseInt(process.env.CCS_IMAGE_ANALYSIS_TIMEOUT || DEFAULT_TIMEOUT_SEC, 10);
    const timeoutMs = Math.max(1, Math.min(600, timeout)) * 1000;

    if (process.env.CCS_DEBUG) {
      console.error(`[CCS Hook] Analyzing ${path.basename(filePath)} via CLIProxy (${model})`);
    }

    // Encode file to base64
    const base64Data = encodeFileToBase64(filePath);
    const mediaType = getMediaType(filePath);

    // Analyze via CLIProxy
    const description = await analyzeViaCliProxy(base64Data, mediaType, model, timeoutMs);

    // Output success
    outputSuccess(filePath, description, model, stats.size);
  } catch (err) {
    if (process.env.CCS_DEBUG) {
      console.error('[CCS Hook] Error:', err.message);
    }

    // Try to extract file path from parsed input
    let filePath = 'unknown file';
    try {
      const data = JSON.parse(input);
      filePath = data.tool_input?.file_path || 'unknown file';
    } catch {
      // Ignore parse errors
    }

    // Output error
    outputError(filePath, err.message || 'Unknown error');
  }
}
