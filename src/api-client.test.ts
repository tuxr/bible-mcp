import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  apiErrorFromBody,
  computeRetryDelayMs,
  createFetchApi,
  DEFAULT_MAX_RATE_LIMIT_RETRIES,
  formatApiError,
  formatMcpError,
  formatRateLimitMessage,
  formatToolError,
  friendlyHttpStatusMessage,
  GENERIC_EMPTY_RESPONSE,
  GENERIC_INVALID_RESPONSE,
  GENERIC_NOT_FOUND,
  GENERIC_UNREACHABLE,
  GENERIC_UNAVAILABLE,
  isApiError,
  isRateLimitError,
  parseRetryAfter,
} from "./api-client.ts";
import { createTestFetchApi, mockResponse } from "./test-helpers.ts";

describe("isApiError", () => {
  it("returns true for objects with a string error field", () => {
    assert.equal(isApiError({ error: "not found" }), true);
  });

  it("returns false for objects with non-string error fields", () => {
    assert.equal(isApiError({ error: 123 }), false);
    assert.equal(isApiError({ error: null }), false);
  });

  it("returns false for null and primitives", () => {
    assert.equal(isApiError(null), false);
    assert.equal(isApiError("error"), false);
  });
});

describe("parseRetryAfter", () => {
  it("parses integer delay-seconds values", () => {
    assert.equal(parseRetryAfter("60"), 60);
  });

  it("parses HTTP-date values as seconds until retry", () => {
    const retryAt = new Date(Date.now() + 90_000);
    const seconds = parseRetryAfter(retryAt.toUTCString());
    assert.ok(seconds !== undefined);
    assert.ok(seconds >= 89 && seconds <= 91);
  });

  it("returns undefined for missing or invalid values", () => {
    assert.equal(parseRetryAfter(null), undefined);
    assert.equal(parseRetryAfter(""), undefined);
    assert.equal(parseRetryAfter("not-a-date"), undefined);
  });
});

describe("formatRateLimitMessage", () => {
  it("includes retry timing when Retry-After is present", () => {
    assert.equal(
      formatRateLimitMessage(undefined, 30),
      "Rate limit exceeded. Please try again in 30 seconds."
    );
  });

  it("uses a fallback message when Retry-After is absent", () => {
    assert.equal(
      formatRateLimitMessage(),
      "Rate limit exceeded. Please try again later."
    );
  });

  it("incorporates API detail while staying user-friendly", () => {
    assert.equal(
      formatRateLimitMessage("too many requests", 10),
      "Rate limit exceeded. Please try again in 10 seconds. (too many requests)"
    );
  });
});

describe("isRateLimitError", () => {
  it("detects rate-limited API errors", () => {
    assert.equal(isRateLimitError({ error: "Rate limit exceeded", rateLimited: true }), true);
    assert.equal(isRateLimitError({ error: "not found" }), false);
  });
});

describe("formatMcpError", () => {
  it("formats MCP tool errors consistently", () => {
    assert.deepEqual(formatMcpError({ error: "not found" }), {
      content: [{ type: "text", text: "Error: not found" }],
      isError: true,
    });
  });

  it("can include structured content for MCP apps", () => {
    assert.deepEqual(
      formatMcpError({ error: "not found" }, { includeStructuredContent: true }),
      {
        content: [{ type: "text", text: "Error: not found" }],
        structuredContent: { error: "not found" },
        isError: true,
      }
    );
  });
});

describe("formatApiError", () => {
  it("contextualizes not-found errors for passages", () => {
    assert.deepEqual(
      formatApiError({ error: GENERIC_NOT_FOUND }, { reference: "John 3:16" }),
      { error: "Could not find passage: John 3:16" }
    );
  });

  it("contextualizes not-found errors for chapters", () => {
    assert.deepEqual(
      formatApiError({ error: "not found" }, { book: "Genesis", chapter: 99 }),
      { error: "Could not find chapter: Genesis 99" }
    );
  });

  it("contextualizes not-found errors for string chapters", () => {
    assert.deepEqual(
      formatApiError({ error: GENERIC_NOT_FOUND }, { book: "Genesis", chapter: "99" }),
      { error: "Could not find chapter: Genesis 99" }
    );
  });

  it("adds query context to search failures", () => {
    assert.deepEqual(
      formatApiError({ error: GENERIC_UNAVAILABLE }, { query: "love" }),
      {
        error:
          'Search failed for "love": Bible API is temporarily unavailable. Please try again later.',
      }
    );
  });

  it("contextualizes not-found search errors", () => {
    assert.deepEqual(
      formatApiError({ error: GENERIC_NOT_FOUND }, { query: "zzzznotreal" }),
      { error: 'Search failed for "zzzznotreal": no matching verses found' }
    );
  });

  it("contextualizes not-found errors for testament-filtered book lists", () => {
    assert.deepEqual(
      formatApiError({ error: GENERIC_NOT_FOUND }, { testament: "OT" }),
      { error: "Could not list books for the Old Testament" }
    );
  });

  it("contextualizes not-found errors for book-only random verse filters", () => {
    assert.deepEqual(
      formatApiError({ error: GENERIC_NOT_FOUND }, { book: "PSA" }),
      { error: "Could not find a random verse in PSA" }
    );
  });

  it("contextualizes not-found errors for book and testament random verse filters", () => {
    assert.deepEqual(
      formatApiError({ error: GENERIC_NOT_FOUND }, { book: "PSA", testament: "OT" }),
      { error: "Could not find a random verse in PSA (Old Testament)" }
    );
  });

  it("contextualizes unavailable errors for passages", () => {
    assert.deepEqual(
      formatApiError({ error: GENERIC_UNREACHABLE }, { reference: "John 3:16" }),
      {
        error: `Unable to look up passage "John 3:16". ${GENERIC_UNREACHABLE}`,
      }
    );
  });

  it("contextualizes unavailable errors for chapters", () => {
    assert.deepEqual(
      formatApiError({ error: GENERIC_UNAVAILABLE }, { book: "Genesis", chapter: 1 }),
      {
        error: `Unable to look up Genesis 1. ${GENERIC_UNAVAILABLE}`,
      }
    );
  });

  it("contextualizes unavailable errors for testament-filtered book lists", () => {
    assert.deepEqual(
      formatApiError({ error: GENERIC_UNAVAILABLE }, { testament: "NT" }),
      {
        error: `Unable to list books for the New Testament. ${GENERIC_UNAVAILABLE}`,
      }
    );
  });

  it("contextualizes unavailable errors for book-only random verse filters", () => {
    assert.deepEqual(
      formatApiError({ error: GENERIC_UNAVAILABLE }, { book: "PSA" }),
      {
        error: `Unable to get a random verse from PSA. ${GENERIC_UNAVAILABLE}`,
      }
    );
  });

  it("preserves rate-limit metadata when adding context", () => {
    assert.deepEqual(
      formatApiError(
        {
          error: "Rate limit exceeded. Please try again in 10 seconds.",
          rateLimited: true,
          retryAfterSeconds: 10,
        },
        { reference: "John 3:16" }
      ),
      {
        error: "Rate limit exceeded. Please try again in 10 seconds.",
        rateLimited: true,
        retryAfterSeconds: 10,
      }
    );
  });

  it("does not rewrite rate-limit errors for search context", () => {
    assert.deepEqual(
      formatApiError(
        {
          error: "Rate limit exceeded. Please try again in 10 seconds.",
          rateLimited: true,
          retryAfterSeconds: 10,
        },
        { query: "love" }
      ),
      {
        error: "Rate limit exceeded. Please try again in 10 seconds.",
        rateLimited: true,
        retryAfterSeconds: 10,
      }
    );
  });

  it("preserves specific API not-found wording outside the allowlist", () => {
    const apiMessage = "Verse not found in requested translation";
    assert.deepEqual(
      formatApiError({ error: apiMessage }, { reference: "John 3:16" }),
      { error: apiMessage }
    );
  });

  it("prefers reference context over book, chapter, and query", () => {
    assert.deepEqual(
      formatApiError(
        { error: GENERIC_NOT_FOUND },
        {
          reference: "John 3:16",
          book: "Genesis",
          chapter: 1,
          query: "love",
        }
      ),
      { error: "Could not find passage: John 3:16" }
    );
  });

  it("returns the original error when no context is provided", () => {
    assert.deepEqual(formatApiError({ error: GENERIC_UNAVAILABLE }), {
      error: GENERIC_UNAVAILABLE,
    });
  });
});

describe("friendlyHttpStatusMessage", () => {
  const cases: Array<[number, string]> = [
    [400, "Invalid request"],
    [401, "Access denied"],
    [403, "Access denied"],
    [404, GENERIC_NOT_FOUND],
    [408, "The request timed out"],
    [429, "Rate limit exceeded. Please try again later."],
    [500, GENERIC_UNAVAILABLE],
    [502, GENERIC_UNAVAILABLE],
    [503, GENERIC_UNAVAILABLE],
    [504, GENERIC_UNAVAILABLE],
    [418, "Unable to complete request"],
    [599, GENERIC_UNAVAILABLE],
  ];

  for (const [status, expected] of cases) {
    it(`maps HTTP ${status} to a friendly message`, () => {
      assert.equal(friendlyHttpStatusMessage(status), expected);
    });
  }
});

describe("formatToolError", () => {
  it("composes contextualized MCP tool errors", () => {
    assert.deepEqual(formatToolError({ error: GENERIC_NOT_FOUND }, { reference: "John 3:16" }), {
      content: [{ type: "text", text: "Error: Could not find passage: John 3:16" }],
      isError: true,
    });
  });

  it("includes structured content for MCP apps", () => {
    assert.deepEqual(
      formatToolError(
        { error: GENERIC_NOT_FOUND },
        { reference: "John 3:16" },
        { includeStructuredContent: true }
      ),
      {
        content: [{ type: "text", text: "Error: Could not find passage: John 3:16" }],
        structuredContent: { error: "Could not find passage: John 3:16" },
        isError: true,
      }
    );
  });
});

describe("tool error responses", () => {
  const toolCases: Array<{
    tool: string;
    apiError: { error: string };
    context: Parameters<typeof formatToolError>[1];
    expectedMessage: string;
  }> = [
    {
      tool: "get_verse",
      apiError: { error: GENERIC_NOT_FOUND },
      context: { reference: "John 3:16" },
      expectedMessage: "Could not find passage: John 3:16",
    },
    {
      tool: "get_chapter",
      apiError: { error: GENERIC_NOT_FOUND },
      context: { book: "Genesis", chapter: 99 },
      expectedMessage: "Could not find chapter: Genesis 99",
    },
    {
      tool: "search_bible",
      apiError: { error: GENERIC_UNAVAILABLE },
      context: { query: "love" },
      expectedMessage:
        'Search failed for "love": Bible API is temporarily unavailable. Please try again later.',
    },
    {
      tool: "list_books",
      apiError: { error: GENERIC_UNAVAILABLE },
      context: { testament: "OT" },
      expectedMessage:
        "Unable to list books for the Old Testament. Bible API is temporarily unavailable. Please try again later.",
    },
    {
      tool: "get_random_verse",
      apiError: { error: GENERIC_NOT_FOUND },
      context: { book: "PSA", testament: "OT" },
      expectedMessage: "Could not find a random verse in PSA (Old Testament)",
    },
    {
      tool: "read_bible",
      apiError: { error: GENERIC_NOT_FOUND },
      context: { reference: "Romans 8:28" },
      expectedMessage: "Could not find passage: Romans 8:28",
    },
    {
      tool: "list_translations",
      apiError: { error: GENERIC_UNAVAILABLE },
      context: undefined,
      expectedMessage: GENERIC_UNAVAILABLE,
    },
  ];

  for (const { tool, apiError, context, expectedMessage } of toolCases) {
    it(`formats ${tool} errors for MCP clients`, () => {
      const result = formatToolError(apiError, context);
      assert.deepEqual(result, {
        content: [{ type: "text", text: `Error: ${expectedMessage}` }],
        isError: true,
      });
    });
  }
});

describe("apiErrorFromBody", () => {
  it("extracts string error fields from the body", () => {
    assert.deepEqual(apiErrorFromBody({ error: "rate limited" }, "fallback"), {
      error: "rate limited",
    });
  });

  it("uses fallback when the body is not a valid API error", () => {
    assert.deepEqual(apiErrorFromBody({ error: 123 }, "fallback"), {
      error: "fallback",
    });
  });
});

describe("computeRetryDelayMs", () => {
  it("uses Retry-After seconds converted to milliseconds", () => {
    assert.equal(computeRetryDelayMs(3, 0), 3000);
  });

  it("caps Retry-After delay at maxRetryDelayMs", () => {
    assert.equal(
      computeRetryDelayMs(120, 0, { maxRetryDelayMs: 5000 }),
      5000
    );
  });

  it("treats zero Retry-After as immediate retry", () => {
    assert.equal(computeRetryDelayMs(0, 0), 0);
  });

  it("uses exponential backoff when Retry-After is absent", () => {
    assert.equal(
      computeRetryDelayMs(undefined, 0, { retryBaseDelayMs: 500 }),
      500
    );
    assert.equal(
      computeRetryDelayMs(undefined, 1, { retryBaseDelayMs: 500 }),
      1000
    );
    assert.equal(
      computeRetryDelayMs(undefined, 2, { retryBaseDelayMs: 500, maxRetryDelayMs: 1200 }),
      1200
    );
  });
});

describe("createFetchApi rate-limit retries", () => {
  it("retries after 429 and returns success when the next attempt succeeds", async () => {
    let callCount = 0;
    const fetchApi = createFetchApi(
      {},
      async () => {
        callCount++;
        if (callCount === 1) {
          return mockResponse({
            ok: false,
            status: 429,
            statusText: "Too Many Requests",
            body: "",
            headers: { "Retry-After": "1" },
          });
        }
        return mockResponse({
          ok: true,
          status: 200,
          statusText: "OK",
          body: '{"reference":"John 3:16"}',
        });
      },
      {
        maxRateLimitRetries: 2,
        sleep: async () => {},
      }
    );

    const result = await fetchApi<{ reference: string }>("/verses/John%203:16");

    assert.equal(callCount, 2);
    assert.deepEqual(result, { reference: "John 3:16" });
  });

  it("returns the last rate-limit error after exhausting retries", async () => {
    let callCount = 0;
    const delays: number[] = [];
    const fetchApi = createFetchApi(
      {},
      async () => {
        callCount++;
        return mockResponse({
          ok: false,
          status: 429,
          statusText: "Too Many Requests",
          body: "",
          headers: { "Retry-After": "2" },
        });
      },
      {
        maxRateLimitRetries: 2,
        sleep: async (ms) => {
          delays.push(ms);
        },
      }
    );

    const result = await fetchApi("/test");

    assert.equal(callCount, DEFAULT_MAX_RATE_LIMIT_RETRIES + 1);
    assert.deepEqual(result, {
      error: "Rate limit exceeded. Please try again in 2 seconds.",
      rateLimited: true,
      retryAfterSeconds: 2,
    });
    assert.deepEqual(delays, [2000, 2000]);
  });

  it("does not retry non-rate-limit errors", async () => {
    let callCount = 0;
    const fetchApi = createFetchApi(
      {},
      async () => {
        callCount++;
        return mockResponse({
          ok: false,
          status: 404,
          statusText: "Not Found",
          body: "",
        });
      },
      {
        maxRateLimitRetries: 2,
        sleep: async () => {
          throw new Error("sleep should not be called");
        },
      }
    );

    const result = await fetchApi("/test");

    assert.equal(callCount, 1);
    assert.deepEqual(result, { error: GENERIC_NOT_FOUND });
  });

  it("uses exponential backoff when Retry-After is absent", async () => {
    let callCount = 0;
    const delays: number[] = [];
    const fetchApi = createFetchApi(
      {},
      async () => {
        callCount++;
        return mockResponse({
          ok: false,
          status: 429,
          statusText: "Too Many Requests",
          body: "",
        });
      },
      {
        maxRateLimitRetries: 2,
        retryBaseDelayMs: 100,
        sleep: async (ms) => {
          delays.push(ms);
        },
      }
    );

    await fetchApi("/test");

    assert.equal(callCount, 3);
    assert.deepEqual(delays, [100, 200]);
  });

  it("caps Retry-After delay at maxRetryDelayMs during retries", async () => {
    const delays: number[] = [];
    const fetchApi = createFetchApi(
      {},
      async () =>
        mockResponse({
          ok: false,
          status: 429,
          statusText: "Too Many Requests",
          body: "",
          headers: { "Retry-After": "120" },
        }),
      {
        maxRateLimitRetries: 2,
        sleep: async (ms) => {
          delays.push(ms);
        },
      }
    );

    await fetchApi("/test");

    assert.deepEqual(delays, [5000, 5000]);
  });

  it("retries immediately when Retry-After is zero", async () => {
    let callCount = 0;
    const delays: number[] = [];
    const fetchApi = createFetchApi(
      {},
      async () => {
        callCount++;
        if (callCount === 1) {
          return mockResponse({
            ok: false,
            status: 429,
            statusText: "Too Many Requests",
            body: "",
            headers: { "Retry-After": "0" },
          });
        }
        return mockResponse({
          ok: true,
          status: 200,
          statusText: "OK",
          body: '{"reference":"John 3:16"}',
        });
      },
      {
        maxRateLimitRetries: 2,
        sleep: async (ms) => {
          delays.push(ms);
        },
      }
    );

    const result = await fetchApi<{ reference: string }>("/verses/John%203:16");

    assert.equal(callCount, 2);
    assert.deepEqual(delays, [0]);
    assert.deepEqual(result, { reference: "John 3:16" });
  });

  it("stops retrying when a subsequent attempt returns a non-rate-limit error", async () => {
    let callCount = 0;
    const fetchApi = createFetchApi(
      {},
      async () => {
        callCount++;
        if (callCount === 1) {
          return mockResponse({
            ok: false,
            status: 429,
            statusText: "Too Many Requests",
            body: "",
            headers: { "Retry-After": "1" },
          });
        }
        throw new Error("network down");
      },
      {
        maxRateLimitRetries: 2,
        sleep: async () => {},
      }
    );

    const result = await fetchApi("/test");

    assert.equal(callCount, 2);
    assert.deepEqual(result, { error: GENERIC_UNREACHABLE });
  });
});

describe("createFetchApi", () => {
  it("returns a structured error when fetch rejects", async () => {
    const fetchApi = createTestFetchApi(async () => {
      throw new Error("fetch failed");
    });

    const result = await fetchApi("/test");

    assert.deepEqual(result, { error: "Unable to reach Bible API" });
  });

  it("returns a friendly rate-limit error with Retry-After seconds", async () => {
    const fetchApi = createTestFetchApi(async () =>
      mockResponse({
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
        body: "",
        headers: { "Retry-After": "45" },
      })
    );

    const result = await fetchApi("/test");

    assert.deepEqual(result, {
      error: "Rate limit exceeded. Please try again in 45 seconds.",
      rateLimited: true,
      retryAfterSeconds: 45,
    });
  });

  it("returns a friendly rate-limit error with Retry-After HTTP-date", async () => {
    const retryAt = new Date(Date.now() + 120_000);
    const fetchApi = createTestFetchApi(async () =>
      mockResponse({
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
        body: "",
        headers: { "Retry-After": retryAt.toUTCString() },
      })
    );

    const result = await fetchApi("/test");

    assert.equal(isApiError(result), true);
    if (isApiError(result)) {
      assert.equal(result.rateLimited, true);
      assert.ok(result.retryAfterSeconds !== undefined);
      assert.ok(result.retryAfterSeconds >= 119 && result.retryAfterSeconds <= 121);
      assert.match(
        result.error,
        /Rate limit exceeded\. Please try again in (119|120|121) seconds\./
      );
    }
  });

  it("returns a fallback rate-limit error without Retry-After", async () => {
    const fetchApi = createTestFetchApi(async () =>
      mockResponse({
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
        body: "",
      })
    );

    const result = await fetchApi("/test");

    assert.deepEqual(result, {
      error: "Rate limit exceeded. Please try again later.",
      rateLimited: true,
    });
  });

  it("incorporates JSON API detail on 429 responses", async () => {
    const fetchApi = createTestFetchApi(async () =>
      mockResponse({
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
        body: '{"error":"rate limited"}',
        headers: { "Retry-After": "10" },
      })
    );

    const result = await fetchApi("/test");

    assert.deepEqual(result, {
      error:
        "Rate limit exceeded. Please try again in 10 seconds. (rate limited)",
      rateLimited: true,
      retryAfterSeconds: 10,
    });
  });

  it("returns a friendly message for non-JSON 404 responses", async () => {
    const fetchApi = createTestFetchApi(async () =>
      mockResponse({
        ok: false,
        status: 404,
        statusText: "Not Found",
        body: "Not Found",
      })
    );

    const result = await fetchApi("/test");

    assert.deepEqual(result, { error: GENERIC_NOT_FOUND });
  });

  it("returns parsed API errors on 2xx responses for backward compatibility", async () => {
    const fetchApi = createTestFetchApi(async () =>
      mockResponse({
        ok: true,
        status: 200,
        statusText: "OK",
        body: '{"error":"not found"}',
      })
    );

    const result = await fetchApi("/test");

    assert.equal(isApiError(result), true);
    if (isApiError(result)) {
      assert.equal(result.error, "not found");
    }
  });

  it("returns a structured error for empty 2xx bodies", async () => {
    const fetchApi = createTestFetchApi(async () =>
      mockResponse({
        ok: true,
        status: 200,
        statusText: "OK",
        body: "",
      })
    );

    const result = await fetchApi("/test");

    assert.deepEqual(result, {
      error: GENERIC_EMPTY_RESPONSE,
    });
  });

  it("returns a structured error for null JSON on 2xx responses", async () => {
    const fetchApi = createTestFetchApi(async () =>
      mockResponse({
        ok: true,
        status: 200,
        statusText: "OK",
        body: "null",
      })
    );

    const result = await fetchApi("/test");

    assert.deepEqual(result, {
      error: GENERIC_EMPTY_RESPONSE,
    });
  });

  it("returns structured errors for malformed JSON on 2xx responses", async () => {
    const fetchApi = createTestFetchApi(async () =>
      mockResponse({
        ok: true,
        status: 200,
        statusText: "OK",
        body: "{invalid",
      })
    );

    const result = await fetchApi("/test");

    assert.deepEqual(result, { error: GENERIC_INVALID_RESPONSE });
    if (isApiError(result)) {
      assert.doesNotMatch(result.error, /\{invalid/);
      assert.doesNotMatch(result.error, /HTTP \d+/);
    }
  });

  it("returns friendly fallback for non-2xx responses with empty bodies", async () => {
    const fetchApi = createTestFetchApi(async () =>
      mockResponse({
        ok: false,
        status: 404,
        statusText: "Not Found",
        body: "",
      })
    );

    const result = await fetchApi("/test");

    assert.deepEqual(result, { error: GENERIC_NOT_FOUND });
  });

  it("returns parsed JSON on successful 2xx responses", async () => {
    const fetchApi = createTestFetchApi(async () =>
      mockResponse({
        ok: true,
        status: 200,
        statusText: "OK",
        body: '{"reference":"John 3:16","text":"For God so loved the world"}',
      })
    );

    const result = await fetchApi<{ reference: string; text: string }>("/verses/John%203:16");

    assert.deepEqual(result, {
      reference: "John 3:16",
      text: "For God so loved the world",
    });
  });

  it("uses the service binding fetcher when BIBLE_API is configured", async () => {
    let bindingPath = "";
    const fetchApi = createTestFetchApi(
      async () => {
        throw new Error("public fetch should not be used");
      },
      {},
      {
        BIBLE_API: {
          fetch: async (input: RequestInfo | URL) => {
            bindingPath = String(input);
            return mockResponse({
              ok: true,
              status: 200,
              statusText: "OK",
              body: '{"reference":"John 3:16"}',
            });
          },
        } as Fetcher,
      }
    );

    const result = await fetchApi<{ reference: string }>("/verses/John%203:16");

    assert.equal(bindingPath, "https://internal/v1/verses/John%203:16");
    assert.deepEqual(result, { reference: "John 3:16" });
  });

  it("returns a structured error for 2xx bodies with non-string error fields", async () => {
    const fetchApi = createTestFetchApi(async () =>
      mockResponse({
        ok: true,
        status: 200,
        statusText: "OK",
        body: '{"error":123}',
      })
    );

    const result = await fetchApi("/test");

    assert.deepEqual(result, { error: GENERIC_INVALID_RESPONSE });
  });

  it("returns friendly errors for malformed JSON on 5xx responses", async () => {
    const fetchApi = createTestFetchApi(async () =>
      mockResponse({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        body: "{invalid",
      })
    );

    const result = await fetchApi("/test");

    assert.deepEqual(result, { error: GENERIC_UNAVAILABLE });
    if (isApiError(result)) {
      assert.doesNotMatch(result.error, /\{invalid/);
      assert.doesNotMatch(result.error, /HTTP 500/);
    }
  });

  it("returns API-provided JSON error strings on non-2xx responses", async () => {
    const fetchApi = createTestFetchApi(async () =>
      mockResponse({
        ok: false,
        status: 404,
        statusText: "Not Found",
        body: '{"error":"Unknown book: XYZ"}',
      })
    );

    const result = await fetchApi("/test");

    assert.deepEqual(result, { error: "Unknown book: XYZ" });
  });

  it("does not leak plaintext bodies on 429 responses", async () => {
    const fetchApi = createTestFetchApi(async () =>
      mockResponse({
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
        body: "<html>rate limited</html>",
        headers: { "Retry-After": "15" },
      })
    );

    const result = await fetchApi("/test");

    assert.deepEqual(result, {
      error: "Rate limit exceeded. Please try again in 15 seconds.",
      rateLimited: true,
      retryAfterSeconds: 15,
    });
    if (isApiError(result)) {
      assert.doesNotMatch(result.error, /<html>/);
    }
  });

  it("does not leak malformed JSON bodies on 429 responses", async () => {
    const fetchApi = createTestFetchApi(async () =>
      mockResponse({
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
        body: "{not-json",
        headers: { "Retry-After": "5" },
      })
    );

    const result = await fetchApi("/test");

    assert.deepEqual(result, {
      error: "Rate limit exceeded. Please try again in 5 seconds.",
      rateLimited: true,
      retryAfterSeconds: 5,
    });
    if (isApiError(result)) {
      assert.doesNotMatch(result.error, /\{not-json/);
    }
  });

  it("returns a stable message when response.text() fails", async () => {
    const fetchApi = createTestFetchApi(async () =>
      mockResponse({
        ok: true,
        status: 200,
        statusText: "OK",
        body: "",
        textThrows: true,
      })
    );

    const result = await fetchApi("/test");

    assert.deepEqual(result, { error: "Failed to read API response" });
  });

});