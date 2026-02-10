/**
 * Tool Name Sanitizer
 *
 * Sanitizes tool names to a cross-provider safe format:
 * - Max 64 characters
 * - Must start with letter or underscore
 * - Only a-z A-Z 0-9 _ - allowed
 *
 * Strategies:
 * 1. Remove duplicate segments (e.g., gitmcp__foo__foo -> gitmcp__foo)
 * 2. Normalize unsupported characters to underscores
 * 3. Rewrite MCP tool names to deterministic short aliases
 * 4. Smart truncate with hash suffix if still >64 chars
 *
 * Note: Hash collision risk is very low for practical tool counts.
 */

import { createHash } from 'crypto';

/** Maximum tool name length allowed by Gemini API */
export const GEMINI_MAX_TOOL_NAME_LENGTH = 64;

/** Valid characters pattern for conservative cross-provider compatibility */
const VALID_CHARS_REGEX = /^[a-zA-Z_][a-zA-Z0-9_-]*$/;

/** Result of sanitization operation */
export interface SanitizeResult {
  /** The sanitized tool name */
  sanitized: string;
  /** Whether the name was changed */
  changed: boolean;
}

/**
 * Check if a tool name is valid.
 *
 * Requirements:
 * - Length <= 64 characters
 * - Starts with letter or underscore
 * - Contains only valid characters: a-z A-Z 0-9 _ -
 */
export function isValidToolName(name: string): boolean {
  if (!name || name.length === 0) {
    return false;
  }
  if (name.length > GEMINI_MAX_TOOL_NAME_LENGTH) {
    return false;
  }
  return VALID_CHARS_REGEX.test(name);
}

/**
 * Remove consecutive duplicate segments separated by '__'.
 *
 * Examples:
 * - 'gitmcp__foo__foo' -> 'gitmcp__foo'
 * - 'a__b__c__b__c' -> 'a__b__c'
 * - 'no_dupes' -> 'no_dupes'
 */
export function removeDuplicateSegments(name: string): string {
  const segments = name.split('__');
  const deduped: string[] = [];

  for (const segment of segments) {
    if (deduped.length === 0 || deduped[deduped.length - 1] !== segment) {
      deduped.push(segment);
    }
  }

  return deduped.join('__');
}

/**
 * Generate a short hash from a string for truncation suffix.
 * Uses first 6 characters of MD5 hash.
 */
function generateShortHash(input: string): string {
  return createHash('md5').update(input).digest('hex').slice(0, 6);
}

/**
 * Smart truncate a name to fit within maxLen.
 * Preserves start of name and appends hash suffix for uniqueness.
 *
 * Format: <prefix>_<6-char-hash>
 */
export function smartTruncate(name: string, maxLen: number = GEMINI_MAX_TOOL_NAME_LENGTH): string {
  if (name.length <= maxLen) {
    return name;
  }

  const hash = generateShortHash(name);
  const prefixLen = maxLen - 7;
  const prefix = name.slice(0, prefixLen);

  return prefix + '_' + hash;
}

function normalizeCharacters(name: string): string {
  let normalized = name.replace(/[^a-zA-Z0-9_-]/g, '_');

  if (!normalized) {
    normalized = '_tool';
  }

  if (!/^[a-zA-Z_]/.test(normalized)) {
    normalized = '_' + normalized;
  }

  return normalized;
}

function hashMcpToolName(name: string): string {
  const hash = createHash('md5').update(name).digest('hex').slice(0, 12);
  return 'mcp_' + hash;
}

/**
 * Sanitize a tool name to comply with conservative provider constraints.
 *
 * Process:
 * 1. Remove duplicate segments
 * 2. Convert mcp__* names to deterministic short aliases
 * 3. Normalize unsupported characters for other names
 * 4. Truncate if needed
 */
export function sanitizeToolName(name: string): SanitizeResult {
  let sanitized = removeDuplicateSegments(name);

  if (sanitized.startsWith('mcp__')) {
    sanitized = hashMcpToolName(sanitized);
  } else {
    sanitized = normalizeCharacters(sanitized);
  }

  if (sanitized.length > GEMINI_MAX_TOOL_NAME_LENGTH) {
    sanitized = smartTruncate(sanitized);
  }

  if (!isValidToolName(sanitized)) {
    sanitized = smartTruncate(normalizeCharacters(name));

    if (!isValidToolName(sanitized)) {
      sanitized = '_tool';
    }
  }

  return {
    sanitized,
    changed: sanitized !== name,
  };
}
