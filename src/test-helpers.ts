import {
  createFetchApi,
  type BibleApiEnv,
  type FetchApiOptions,
} from "./api-client.ts";

/** Disable automatic 429 retries unless a test opts in explicitly. */
export function createTestFetchApi(
  fetchImpl: () => Promise<Response>,
  options: FetchApiOptions = {},
  env: BibleApiEnv = {}
) {
  return createFetchApi(env, fetchImpl, {
    maxRateLimitRetries: 0,
    sleep: async () => {},
    ...options,
  });
}

export function mockResponse(options: {
  ok: boolean;
  status: number;
  statusText: string;
  body: string;
  textThrows?: boolean;
  headers?: Record<string, string>;
}): Response {
  const headers = new Headers(options.headers);
  return {
    ok: options.ok,
    status: options.status,
    statusText: options.statusText,
    headers,
    text: async () => {
      if (options.textThrows) {
        throw new Error("read failed");
      }
      return options.body;
    },
  } as Response;
}

export function mockRateLimitResponse(retryAfterSeconds = 30): Response {
  return mockResponse({
    ok: false,
    status: 429,
    statusText: "Too Many Requests",
    body: "",
    headers: { "Retry-After": String(retryAfterSeconds) },
  });
}