/**
 * GLMT Retry Logic Unit Tests
 *
 * Tests for exponential backoff retry behavior on 429 rate limit errors
 */

import { describe, it, expect, beforeEach, afterEach, setDefaultTimeout } from 'bun:test';

// Increase timeout for CI - dynamic imports and proxy creation are slow on CI runners
setDefaultTimeout(30000);

// Store original env vars
const originalEnv = { ...process.env };

// Reset env before each test
beforeEach(() => {
  delete process.env.GLMT_MAX_RETRIES;
  delete process.env.GLMT_RETRY_BASE_DELAY;
  delete process.env.GLMT_DISABLE_RETRY;
});

afterEach(() => {
  // Restore original env
  Object.keys(process.env).forEach((key) => {
    if (key.startsWith('GLMT_')) {
      delete process.env[key];
    }
  });
  Object.assign(process.env, originalEnv);
});

// Helper to create proxy instance with specific config
async function createTestableProxy(config: {
  maxRetries?: number;
  baseDelay?: number;
  enabled?: boolean;
} = {}) {
  // Set env vars before import
  if (config.maxRetries !== undefined) {
    process.env.GLMT_MAX_RETRIES = String(config.maxRetries);
  }
  if (config.baseDelay !== undefined) {
    process.env.GLMT_RETRY_BASE_DELAY = String(config.baseDelay);
  }
  if (config.enabled === false) {
    process.env.GLMT_DISABLE_RETRY = '1';
  }

  // Dynamic import to pick up env changes
  const module = await import('../../../src/glmt/glmt-proxy');
  return new module.GlmtProxy({ verbose: false });
}

describe('GLMT Retry Logic', () => {
  describe('RetryConfig initialization', () => {
    it('should use default values when env vars not set', async () => {
      const proxy = await createTestableProxy();
      // Access private via type assertion for testing
      const config = (proxy as unknown as { retryConfig: { maxRetries: number; baseDelay: number; enabled: boolean } }).retryConfig;
      expect(config.maxRetries).toBe(3);
      expect(config.baseDelay).toBe(1000);
      expect(config.enabled).toBe(true);
    });

    it('should respect GLMT_MAX_RETRIES env var', async () => {
      const proxy = await createTestableProxy({ maxRetries: 5 });
      const config = (proxy as unknown as { retryConfig: { maxRetries: number } }).retryConfig;
      expect(config.maxRetries).toBe(5);
    });

    it('should respect GLMT_RETRY_BASE_DELAY env var', async () => {
      const proxy = await createTestableProxy({ baseDelay: 2000 });
      const config = (proxy as unknown as { retryConfig: { baseDelay: number } }).retryConfig;
      expect(config.baseDelay).toBe(2000);
    });

    it('should disable retry when GLMT_DISABLE_RETRY=1', async () => {
      const proxy = await createTestableProxy({ enabled: false });
      const config = (proxy as unknown as { retryConfig: { enabled: boolean } }).retryConfig;
      expect(config.enabled).toBe(false);
    });
  });

  describe('calculateRetryDelay', () => {
    it('should calculate exponential delay with jitter', async () => {
      const proxy = await createTestableProxy({ baseDelay: 1000 });
      const calcDelay = (proxy as unknown as { calculateRetryDelay: (attempt: number, retryAfter?: string) => number }).calculateRetryDelay.bind(proxy);

      // Attempt 0: 2^0 * 1000 = 1000 + jitter (0-500)
      const delay0 = calcDelay(0);
      expect(delay0).toBeGreaterThanOrEqual(1000);
      expect(delay0).toBeLessThan(1500);

      // Attempt 1: 2^1 * 1000 = 2000 + jitter (0-500)
      const delay1 = calcDelay(1);
      expect(delay1).toBeGreaterThanOrEqual(2000);
      expect(delay1).toBeLessThan(2500);

      // Attempt 2: 2^2 * 1000 = 4000 + jitter (0-500)
      const delay2 = calcDelay(2);
      expect(delay2).toBeGreaterThanOrEqual(4000);
      expect(delay2).toBeLessThan(4500);
    });

    it('should honor Retry-After header in seconds', async () => {
      const proxy = await createTestableProxy();
      const calcDelay = (proxy as unknown as { calculateRetryDelay: (attempt: number, retryAfter?: string) => number }).calculateRetryDelay.bind(proxy);

      // Retry-After: 5 seconds → 5000ms
      const delay = calcDelay(0, '5');
      expect(delay).toBe(5000);
    });

    it('should ignore invalid Retry-After header and fallback to exponential', async () => {
      const proxy = await createTestableProxy({ baseDelay: 1000 });
      const calcDelay = (proxy as unknown as { calculateRetryDelay: (attempt: number, retryAfter?: string) => number }).calculateRetryDelay.bind(proxy);

      // Invalid header falls back to exponential
      const delay = calcDelay(0, 'invalid');
      expect(delay).toBeGreaterThanOrEqual(1000);
      expect(delay).toBeLessThan(1500);
    });

    it('should ignore zero or negative Retry-After', async () => {
      const proxy = await createTestableProxy({ baseDelay: 1000 });
      const calcDelay = (proxy as unknown as { calculateRetryDelay: (attempt: number, retryAfter?: string) => number }).calculateRetryDelay.bind(proxy);

      const delay = calcDelay(0, '0');
      expect(delay).toBeGreaterThanOrEqual(1000);
      expect(delay).toBeLessThan(1500);
    });
  });

  describe('isRetryableError', () => {
    it('should return true for 429 status code', async () => {
      const proxy = await createTestableProxy();
      const isRetryable = (proxy as unknown as { isRetryableError: (error: Error) => { retryable: boolean; retryAfter?: string } }).isRetryableError.bind(proxy);

      const result = isRetryable(new Error('Upstream error: 429 Too Many Requests'));
      expect(result.retryable).toBe(true);
    });

    it('should return true for rate limit message', async () => {
      const proxy = await createTestableProxy();
      const isRetryable = (proxy as unknown as { isRetryableError: (error: Error) => { retryable: boolean; retryAfter?: string } }).isRetryableError.bind(proxy);

      const result = isRetryable(new Error('Rate limit exceeded'));
      expect(result.retryable).toBe(true);
    });

    it('should return false for non-retryable errors', async () => {
      const proxy = await createTestableProxy();
      const isRetryable = (proxy as unknown as { isRetryableError: (error: Error) => { retryable: boolean; retryAfter?: string } }).isRetryableError.bind(proxy);

      expect(isRetryable(new Error('Connection refused')).retryable).toBe(false);
      expect(isRetryable(new Error('Timeout')).retryable).toBe(false);
      expect(isRetryable(new Error('500 Internal Server Error')).retryable).toBe(false);
      expect(isRetryable(new Error('401 Unauthorized')).retryable).toBe(false);
    });

    it('should extract Retry-After from error message', async () => {
      const proxy = await createTestableProxy();
      const isRetryable = (proxy as unknown as { isRetryableError: (error: Error) => { retryable: boolean; retryAfter?: string } }).isRetryableError.bind(proxy);

      const result = isRetryable(new Error('429 Too Many Requests, Retry-After: 10'));
      expect(result.retryable).toBe(true);
      expect(result.retryAfter).toBe('10');
    });
  });

  describe('forwardWithRetry behavior', () => {
    it('should succeed on first attempt without retry', async () => {
      const proxy = await createTestableProxy();
      let attempts = 0;

      // Mock forwardToUpstream
      (proxy as unknown as { forwardToUpstream: () => Promise<unknown> }).forwardToUpstream = async () => {
        attempts++;
        return { choices: [{ message: { content: 'success' } }] };
      };

      const forwardWithRetry = (proxy as unknown as { forwardWithRetry: (req: unknown, headers: unknown) => Promise<unknown> }).forwardWithRetry.bind(proxy);
      const result = await forwardWithRetry({}, {});

      expect(attempts).toBe(1);
      expect((result as { choices: Array<{ message: { content: string } }> }).choices[0].message.content).toBe('success');
    });

    it('should retry on 429 and succeed eventually', async () => {
      const proxy = await createTestableProxy({ baseDelay: 10 }); // Fast for tests
      let attempts = 0;

      (proxy as unknown as { forwardToUpstream: () => Promise<unknown> }).forwardToUpstream = async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Upstream error: 429 Too Many Requests');
        }
        return { choices: [{ message: { content: 'success after retry' } }] };
      };

      const forwardWithRetry = (proxy as unknown as { forwardWithRetry: (req: unknown, headers: unknown) => Promise<unknown> }).forwardWithRetry.bind(proxy);
      const result = await forwardWithRetry({}, {});

      expect(attempts).toBe(3);
      expect((result as { choices: Array<{ message: { content: string } }> }).choices[0].message.content).toBe('success after retry');
    });

    it('should fail after max retries exhausted', async () => {
      const proxy = await createTestableProxy({ maxRetries: 2, baseDelay: 10 });
      let attempts = 0;

      (proxy as unknown as { forwardToUpstream: () => Promise<unknown> }).forwardToUpstream = async () => {
        attempts++;
        throw new Error('Upstream error: 429 Too Many Requests');
      };

      const forwardWithRetry = (proxy as unknown as { forwardWithRetry: (req: unknown, headers: unknown) => Promise<unknown> }).forwardWithRetry.bind(proxy);

      await expect(forwardWithRetry({}, {})).rejects.toThrow('429');
      expect(attempts).toBe(3); // Initial + 2 retries
    });

    it('should not retry when disabled', async () => {
      const proxy = await createTestableProxy({ enabled: false });
      let attempts = 0;

      (proxy as unknown as { forwardToUpstream: () => Promise<unknown> }).forwardToUpstream = async () => {
        attempts++;
        throw new Error('Upstream error: 429 Too Many Requests');
      };

      const forwardWithRetry = (proxy as unknown as { forwardWithRetry: (req: unknown, headers: unknown) => Promise<unknown> }).forwardWithRetry.bind(proxy);

      await expect(forwardWithRetry({}, {})).rejects.toThrow('429');
      expect(attempts).toBe(1);
    });

    it('should not retry non-429 errors', async () => {
      const proxy = await createTestableProxy({ baseDelay: 10 });
      let attempts = 0;

      (proxy as unknown as { forwardToUpstream: () => Promise<unknown> }).forwardToUpstream = async () => {
        attempts++;
        throw new Error('Upstream error: 500 Internal Server Error');
      };

      const forwardWithRetry = (proxy as unknown as { forwardWithRetry: (req: unknown, headers: unknown) => Promise<unknown> }).forwardWithRetry.bind(proxy);

      await expect(forwardWithRetry({}, {})).rejects.toThrow('500');
      expect(attempts).toBe(1);
    });
  });

  describe('connection pooling', () => {
    it('should create https.Agent with keepAlive enabled', async () => {
      const proxy = await createTestableProxy();
      const agent = (proxy as unknown as { httpsAgent: { options?: { keepAlive?: boolean } } }).httpsAgent;

      expect(agent).toBeDefined();
      // Agent should have keepAlive behavior (internal property)
      expect(agent.options?.keepAlive).toBe(true);
    });

    it('should destroy agent on stop', async () => {
      const proxy = await createTestableProxy();
      const agent = (proxy as unknown as { httpsAgent: { destroy: () => void; destroyed?: boolean } }).httpsAgent;

      let destroyed = false;
      const originalDestroy = agent.destroy.bind(agent);
      agent.destroy = () => {
        destroyed = true;
        originalDestroy();
      };

      proxy.stop();
      expect(destroyed).toBe(true);
    });
  });
});
