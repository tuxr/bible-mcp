export interface ApiError {
  error: string;
  rateLimited?: boolean;
  retryAfterSeconds?: number;
}

export interface BibleApiEnv {
  BIBLE_API?: Fetcher;
  BIBLE_API_URL?: string;
}

export interface FetchApiOptions {
  /** Max automatic retries after HTTP 429 (default 2 → 3 total attempts). */
  maxRateLimitRetries?: number;
  /** Base delay for exponential backoff when Retry-After is absent (default 500ms). */
  retryBaseDelayMs?: number;
  /** Cap per-retry wait time to stay within Worker CPU limits (default 5000ms). */
  maxRetryDelayMs?: number;
  /** Injectable sleep for tests; defaults to setTimeout-based delay. */
  sleep?: (ms: number) => Promise<void>;
}

export const DEFAULT_BIBLE_API_URL = "https://bible-api.dws-cloud.com";
export const DEFAULT_MAX_RATE_LIMIT_RETRIES = 2;
export const DEFAULT_RETRY_BASE_DELAY_MS = 500;
export const DEFAULT_MAX_RETRY_DELAY_MS = 5000;

export function isApiError(data: unknown): data is ApiError {
  return (
    typeof data === "object" &&
    data !== null &&
    "error" in data &&
    typeof (data as ApiError).error === "string"
  );
}

export function apiErrorFromBody(body: unknown, fallback: string): ApiError {
  if (isApiError(body)) {
    return { error: body.error };
  }
  return { error: fallback };
}

export function isRateLimitError(data: ApiError): boolean {
  return data.rateLimited === true;
}

/** Parse Retry-After as delay-seconds or HTTP-date per RFC 7231. */
export function parseRetryAfter(header: string | null): number | undefined {
  if (!header) {
    return undefined;
  }

  const trimmed = header.trim();
  if (!trimmed) {
    return undefined;
  }

  if (/^\d+$/.test(trimmed)) {
    return Number.parseInt(trimmed, 10);
  }

  const retryAt = Date.parse(trimmed);
  if (!Number.isNaN(retryAt)) {
    const secondsUntilRetry = Math.ceil((retryAt - Date.now()) / 1000);
    return Math.max(0, secondsUntilRetry);
  }

  return undefined;
}

export function formatRateLimitMessage(
  apiDetail?: string,
  retryAfterSeconds?: number
): string {
  let message: string;

  if (retryAfterSeconds !== undefined) {
    if (retryAfterSeconds <= 0) {
      message = "Rate limit exceeded. Please try again shortly.";
    } else {
      const unit = retryAfterSeconds === 1 ? "second" : "seconds";
      message = `Rate limit exceeded. Please try again in ${retryAfterSeconds} ${unit}.`;
    }
  } else {
    message = "Rate limit exceeded. Please try again later.";
  }

  if (apiDetail) {
    return `${message} (${apiDetail})`;
  }

  return message;
}

function rateLimitErrorFromResponse(
  response: Response,
  body: unknown,
  _text: string
): ApiError {
  const retryAfterSeconds = parseRetryAfter(response.headers.get("Retry-After"));
  const apiDetail = isApiError(body) ? body.error : undefined;

  const error: ApiError = {
    error: formatRateLimitMessage(apiDetail, retryAfterSeconds),
    rateLimited: true,
  };

  if (retryAfterSeconds !== undefined) {
    error.retryAfterSeconds = retryAfterSeconds;
  }

  return error;
}

export const GENERIC_NOT_FOUND = "The requested resource was not found";
export const GENERIC_UNAVAILABLE =
  "Bible API is temporarily unavailable. Please try again later.";
export const GENERIC_INVALID_RESPONSE = "Received an invalid response from Bible API";
export const GENERIC_EMPTY_RESPONSE = "Received an empty response from Bible API";
export const GENERIC_UNREACHABLE = "Unable to reach Bible API";
export const GENERIC_READ_FAILED = "Failed to read API response";
export const GENERIC_REQUEST_FAILED = "Unable to complete request";

export interface ApiErrorContext {
  reference?: string;
  book?: string;
  chapter?: number | string;
  query?: string;
  testament?: string;
}

const NOT_FOUND_MESSAGES = new Set([
  GENERIC_NOT_FOUND,
  "not found",
  "Not Found",
]);

const TESTAMENT_LABELS: Record<string, string> = {
  OT: "Old Testament",
  NT: "New Testament",
  AP: "Apocrypha",
};

function formatTestamentLabel(testament?: string): string | undefined {
  if (!testament) {
    return undefined;
  }
  return TESTAMENT_LABELS[testament] ?? testament;
}

function isNotFoundMessage(message: string): boolean {
  return NOT_FOUND_MESSAGES.has(message);
}

function isUnavailableMessage(message: string): boolean {
  return (
    message === GENERIC_UNAVAILABLE ||
    message === GENERIC_UNREACHABLE ||
    message === GENERIC_READ_FAILED ||
    /temporarily unavailable/i.test(message) ||
    /unable to reach/i.test(message)
  );
}

/** Add tool-specific context to API errors without leaking internal details. */
export function formatApiError(data: ApiError, context?: ApiErrorContext): ApiError {
  if (!context) {
    return { ...data };
  }

  if (data.rateLimited === true) {
    return { ...data };
  }

  let message = data.error;
  const testamentLabel = formatTestamentLabel(context.testament);

  if (isNotFoundMessage(message)) {
    if (context.reference) {
      message = `Could not find passage: ${context.reference}`;
    } else if (context.book !== undefined && context.chapter !== undefined) {
      message = `Could not find chapter: ${context.book} ${context.chapter}`;
    } else if (context.book !== undefined) {
      message = testamentLabel
        ? `Could not find a random verse in ${context.book} (${testamentLabel})`
        : `Could not find a random verse in ${context.book}`;
    } else if (context.query) {
      message = `Search failed for "${context.query}": no matching verses found`;
    } else if (testamentLabel) {
      message = `Could not list books for the ${testamentLabel}`;
    }
  } else if (context.query) {
    message = `Search failed for "${context.query}": ${message}`;
  } else if (context.reference && isUnavailableMessage(message)) {
    message = `Unable to look up passage "${context.reference}". ${message}`;
  } else if (
    context.book !== undefined &&
    context.chapter !== undefined &&
    isUnavailableMessage(message)
  ) {
    message = `Unable to look up ${context.book} ${context.chapter}. ${message}`;
  } else if (context.book !== undefined && isUnavailableMessage(message)) {
    message = testamentLabel
      ? `Unable to get a random verse from ${context.book} (${testamentLabel}). ${message}`
      : `Unable to get a random verse from ${context.book}. ${message}`;
  } else if (testamentLabel && isUnavailableMessage(message)) {
    message = `Unable to list books for the ${testamentLabel}. ${message}`;
  }

  return { ...data, error: message };
}

/** Standard MCP tool error response: contextualize then format. */
export function formatToolError(
  data: ApiError,
  context?: ApiErrorContext,
  options?: { includeStructuredContent?: boolean }
) {
  return formatMcpError(formatApiError(data, context), options);
}

export function formatMcpError(
  data: ApiError,
  options?: { includeStructuredContent?: boolean }
) {
  const result = {
    content: [{ type: "text" as const, text: `Error: ${data.error}` }],
    isError: true as const,
  };

  if (options?.includeStructuredContent) {
    return {
      ...result,
      structuredContent: { error: data.error },
    };
  }

  return result;
}

/** True when a 2xx body has an `error` key whose value is not a string. */
function hasMalformedErrorField(body: unknown): boolean {
  return (
    typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof (body as ApiError).error !== "string"
  );
}

/**
 * Compute wait time before retrying a 429, honoring Retry-After with a cap.
 * User-facing retryAfterSeconds may exceed actual sleep when Retry-After is large;
 * we cap per-retry delay to stay within Worker CPU limits.
 */
export function computeRetryDelayMs(
  retryAfterSeconds: number | undefined,
  attempt: number,
  options?: { retryBaseDelayMs?: number; maxRetryDelayMs?: number }
): number {
  const baseDelayMs = options?.retryBaseDelayMs ?? DEFAULT_RETRY_BASE_DELAY_MS;
  const maxDelayMs = options?.maxRetryDelayMs ?? DEFAULT_MAX_RETRY_DELAY_MS;

  if (retryAfterSeconds !== undefined) {
    return Math.min(Math.max(0, retryAfterSeconds) * 1000, maxDelayMs);
  }

  const exponentialDelay = baseDelayMs * 2 ** attempt;
  return Math.min(exponentialDelay, maxDelayMs);
}

async function fetchOnce<T>(
  env: BibleApiEnv,
  fetchImpl: typeof fetch,
  path: string
): Promise<T | ApiError> {
  let response: Response;

  try {
    if (env.BIBLE_API) {
      // Service binding: direct Worker-to-Worker communication (same Cloudflare account)
      // The URL host doesn't matter for service bindings - it's routed internally
      response = await env.BIBLE_API.fetch(`https://internal/v1${path}`);
    } else {
      // Public API: standard HTTPS fetch (cross-account or local development)
      const baseUrl = env.BIBLE_API_URL || DEFAULT_BIBLE_API_URL;
      response = await fetchImpl(`${baseUrl}/v1${path}`);
    }
  } catch {
    return { error: GENERIC_UNREACHABLE };
  }

  let text: string;
  try {
    text = await response.text();
  } catch {
    return { error: GENERIC_READ_FAILED };
  }

  let body: unknown;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    if (response.ok) {
      return { error: GENERIC_INVALID_RESPONSE };
    }
    if (response.status === 429) {
      return rateLimitErrorFromResponse(response, null, text);
    }
    return {
      error: friendlyHttpStatusMessage(response.status),
    };
  }

  if (!response.ok) {
    if (response.status === 429) {
      return rateLimitErrorFromResponse(response, body, text);
    }
    return apiErrorFromBody(body, friendlyHttpStatusMessage(response.status));
  }

  if (body === null) {
    return { error: GENERIC_EMPTY_RESPONSE };
  }

  // Reject 2xx bodies with a non-string `error` field so callers do not
  // dereference `data.error` as a string. Other unexpected JSON shapes are
  // left to endpoint callers and `isApiError()`.
  if (hasMalformedErrorField(body)) {
    return { error: GENERIC_INVALID_RESPONSE };
  }

  return body as T | ApiError;
}

export function friendlyHttpStatusMessage(status: number): string {
  switch (status) {
    case 400:
      return "Invalid request";
    case 401:
    case 403:
      return "Access denied";
    case 404:
      return GENERIC_NOT_FOUND;
    case 408:
      return "The request timed out";
    case 429:
      return "Rate limit exceeded. Please try again later.";
    case 500:
    case 502:
    case 503:
    case 504:
      return GENERIC_UNAVAILABLE;
    default:
      if (status >= 500) {
        return GENERIC_UNAVAILABLE;
      }
      if (status >= 400) {
        return GENERIC_REQUEST_FAILED;
      }
      return GENERIC_INVALID_RESPONSE;
  }
}

export function createFetchApi(
  env: BibleApiEnv,
  fetchImpl: typeof fetch = fetch,
  options: FetchApiOptions = {}
) {
  const maxRateLimitRetries = options.maxRateLimitRetries ?? DEFAULT_MAX_RATE_LIMIT_RETRIES;
  const retryBaseDelayMs = options.retryBaseDelayMs ?? DEFAULT_RETRY_BASE_DELAY_MS;
  const maxRetryDelayMs = options.maxRetryDelayMs ?? DEFAULT_MAX_RETRY_DELAY_MS;
  const sleep =
    options.sleep ??
    ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));

  return async function fetchApi<T>(path: string): Promise<T | ApiError> {
    let lastRateLimitError: ApiError | undefined;

    for (let attempt = 0; attempt <= maxRateLimitRetries; attempt++) {
      const result = await fetchOnce<T>(env, fetchImpl, path);

      if (!isApiError(result) || !isRateLimitError(result)) {
        return result;
      }

      lastRateLimitError = result;

      if (attempt >= maxRateLimitRetries) {
        break;
      }

      const delayMs = computeRetryDelayMs(result.retryAfterSeconds, attempt, {
        retryBaseDelayMs,
        maxRetryDelayMs,
      });
      await sleep(delayMs);
    }

    return lastRateLimitError!;
  };
}