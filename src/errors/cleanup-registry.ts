/**
 * Cleanup registry for CCS CLI
 *
 * Manages cleanup callbacks that should be run on exit or error.
 * Used to clean up resources like:
 * - Spawned processes (proxies, child processes)
 * - Temporary files
 * - Network connections
 * - Open file handles
 */

/**
 * Cleanup callback type
 * Callbacks should be synchronous and non-throwing
 */
export type CleanupCallback = () => void;

/**
 * Registry of cleanup callbacks
 * Executed in LIFO order (last registered = first executed)
 */
const cleanupCallbacks: CleanupCallback[] = [];

/**
 * Flag to prevent double execution
 */
let cleanupRan = false;

/**
 * Register a cleanup callback
 * Callbacks are executed in LIFO order (stack-like behavior)
 *
 * @param fn - Cleanup function to register
 * @returns Unregister function to remove the callback
 */
export function registerCleanup(fn: CleanupCallback): () => void {
  cleanupCallbacks.push(fn);

  // Return unregister function
  return () => {
    const index = cleanupCallbacks.indexOf(fn);
    if (index !== -1) {
      cleanupCallbacks.splice(index, 1);
    }
  };
}

/**
 * Run all registered cleanup callbacks
 * Executes in LIFO order, catches and logs individual errors
 * Can only be run once per process
 */
export function runCleanup(): void {
  if (cleanupRan) {
    return;
  }
  cleanupRan = true;

  const isDebug = process.env['CCS_DEBUG'] === '1' || process.env['CCS_DEBUG'] === 'true';

  // Execute in reverse order (LIFO)
  while (cleanupCallbacks.length > 0) {
    const callback = cleanupCallbacks.pop();
    if (callback) {
      try {
        callback();
      } catch (error) {
        // Log cleanup errors in debug mode but don't throw
        if (isDebug) {
          const message = error instanceof Error ? error.message : String(error);
          console.error(`[!] Cleanup error: ${message}`);
        }
      }
    }
  }
}

/**
 * Clear all registered cleanup callbacks
 * Primarily used for testing
 */
export function clearCleanup(): void {
  cleanupCallbacks.length = 0;
  cleanupRan = false;
}

/**
 * Get the number of registered cleanup callbacks
 * Primarily used for testing
 */
export function getCleanupCount(): number {
  return cleanupCallbacks.length;
}

/**
 * Check if cleanup has already run
 * Primarily used for testing
 */
export function hasCleanupRun(): boolean {
  return cleanupRan;
}

/**
 * Create a cleanup scope for automatic resource management
 * Resources registered within the scope are cleaned up when done
 *
 * @example
 * ```typescript
 * const scope = createCleanupScope();
 * scope.register(() => process.kill());
 * try {
 *   // ... do work
 * } finally {
 *   scope.cleanup();
 * }
 * ```
 */
export function createCleanupScope(): {
  register: (fn: CleanupCallback) => void;
  cleanup: () => void;
} {
  const scopeCallbacks: CleanupCallback[] = [];
  const unregisters: Array<() => void> = [];

  return {
    register: (fn: CleanupCallback) => {
      scopeCallbacks.push(fn);
      // Also register with global cleanup in case of unexpected exit
      const unregister = registerCleanup(fn);
      unregisters.push(unregister);
    },
    cleanup: () => {
      // Unregister from global cleanup first
      for (const unregister of unregisters) {
        unregister();
      }

      // Execute scope callbacks in LIFO order
      while (scopeCallbacks.length > 0) {
        const callback = scopeCallbacks.pop();
        if (callback) {
          try {
            callback();
          } catch (_error) {
            // Silently ignore scope cleanup errors
          }
        }
      }
    },
  };
}
