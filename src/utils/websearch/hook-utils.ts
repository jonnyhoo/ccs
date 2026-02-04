/**
 * WebSearch Hook Utilities
 *
 * Shared helper functions for WebSearch hook detection and deduplication.
 *
 * @module utils/websearch/hook-utils
 */

/**
 * Check if a hook entry is a CCS WebSearch hook
 * Normalizes path separators for cross-platform matching (Windows uses backslashes)
 */
export function isCcsWebSearchHook(hook: Record<string, unknown>): boolean {
  if (hook.matcher !== 'WebSearch') return false;

  const hookArray = hook.hooks as Array<Record<string, unknown>> | undefined;
  if (!hookArray?.[0]?.command) return false;

  const command = hookArray[0].command;
  if (typeof command !== 'string') return false;

  // Normalize path separators for cross-platform matching
  const normalizedCommand = command
    .replace(/\\/g, '/') // Windows backslashes
    .replace(/\/+/g, '/'); // Collapse multiple slashes
  return normalizedCommand.includes('.ccs/hooks/websearch-transformer');
}

/**
 * Remove duplicate CCS WebSearch hooks from settings, keeping only the first one
 * Returns true if duplicates were removed
 */
export function deduplicateCcsHooks(settings: Record<string, unknown>): boolean {
  const hooks = settings.hooks as Record<string, unknown[]> | undefined;
  if (!hooks?.PreToolUse) return false;

  let foundFirst = false;
  const originalLength = hooks.PreToolUse.length;

  hooks.PreToolUse = hooks.PreToolUse.filter((h: unknown) => {
    const hook = h as Record<string, unknown>;
    if (!isCcsWebSearchHook(hook)) return true; // Keep non-CCS hooks

    if (!foundFirst) {
      foundFirst = true;
      return true; // Keep first CCS hook
    }
    return false; // Remove subsequent duplicates
  });

  const newLength = hooks.PreToolUse.length;
  if (process.env.CCS_DEBUG && newLength < originalLength) {
    const removedCount = originalLength - newLength;
    console.error(`Removed ${removedCount} duplicate CCS WebSearch hook(s)`);
  }

  return newLength < originalLength;
}
