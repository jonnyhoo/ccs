/**
 * Mock Infrastructure Types
 *
 * Type definitions for test mocking utilities.
 * Used to replace real HTTP/HTTPS servers with instant mock responses.
 */

/** HTTP methods supported by mock server */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';

/** Mock response body - can be object, string, or Buffer */
export type MockResponseBody = Record<string, unknown> | string | Buffer | null;

/** Configuration for a single mock response */
export interface MockResponse {
  /** HTTP status code (default: 200) */
  status?: number;
  /** Response body - objects are JSON stringified */
  body?: MockResponseBody;
  /** Response headers */
  headers?: Record<string, string>;
  /** Delay in ms before responding (for timeout testing) */
  delay?: number;
}

/** Route key format: "METHOD /path" */
export type RouteKey = `${HttpMethod} ${string}`;

/** Configuration for createMockHttpServer */
export interface MockHttpServerConfig {
  /** Route definitions - key format: "METHOD /path" */
  routes: Record<RouteKey, MockResponse>;
  /** Default response for unmatched routes */
  defaultResponse?: MockResponse;
}

/** Mock fetch handler configuration */
export interface MockFetchHandler {
  /** URL pattern to match (string for exact, RegExp for pattern) */
  url: string | RegExp;
  /** HTTP method to match (optional, matches all if not specified) */
  method?: HttpMethod;
  /** Response to return */
  response: MockResponseBody;
  /** HTTP status code (default: 200) */
  status?: number;
  /** Response headers */
  headers?: Record<string, string>;
  /** Delay in ms before responding */
  delay?: number;
  /** Function to capture and validate request */
  onRequest?: (request: Request) => void;
}

/** Request captured by mock fetch for assertions */
export interface CapturedRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | null;
}

/** Mock HTTP server instance */
export interface MockHttpServer {
  /** Handle a request and return mock response */
  handle(method: HttpMethod, path: string, body?: unknown): MockResponse;
  /** Get all captured requests */
  getCapturedRequests(): CapturedRequest[];
  /** Clear captured requests */
  clearCapturedRequests(): void;
}
