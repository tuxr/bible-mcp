import {
  createFetchApi,
  type BibleApiEnv,
  type FetchApiOptions,
} from "./api-client.ts";

/** Disable automatic 429 retries unless a test opts in explicitly. */
export function createTestFetchApi(
  fetchImpl: typeof fetch,
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

export function mockJsonResponse(body: unknown): Response {
  return mockResponse({
    ok: true,
    status: 200,
    statusText: "OK",
    body: JSON.stringify(body),
  });
}

export const MOCK_TRANSLATIONS = [
  {
    id: "web",
    name: "World English Bible",
    language: "en",
    license: "Public Domain",
    description: "Modern English translation",
  },
  {
    id: "kjv",
    name: "King James Version",
    language: "en",
    license: "Public Domain",
    description: "Classic English translation",
  },
  {
    id: "wlc",
    name: "Westminster Leningrad Codex",
    language: "he",
    license: "Public Domain",
    description: "Hebrew Old Testament text",
  },
] as const;

export const MOCK_WLC_VERSE_RESPONSE = {
  reference: "Genesis 1:1",
  translation: { id: "wlc", name: "Westminster Leningrad Codex", language: "he" },
  verses: [
    {
      book: "GEN",
      book_name: "Genesis",
      chapter: 1,
      verse: 1,
      text: "בְּרֵאשִׁית בָּרָא אֱלֹהִים אֵת הַשָּׁמַיִם וְאֵת הָאָרֶץ",
    },
  ],
  text: "בְּרֵאשִׁית בָּרָא אֱלֹהִים אֵת הַשָּׁמַיִם וְאֵת הָאָרֶץ",
};

export const MOCK_WEB_VERSE_RESPONSE = {
  reference: "John 3:16",
  translation: { id: "web", name: "World English Bible", language: "en" },
  verses: [
    {
      book: "JHN",
      book_name: "John",
      chapter: 3,
      verse: 16,
      text: "For God so loved the world, that he gave his one and only Son, that whoever believes in him should not perish, but have eternal life.",
    },
  ],
  text: "For God so loved the world, that he gave his one and only Son, that whoever believes in him should not perish, but have eternal life.",
};

export const MOCK_KJV_VERSE_RESPONSE = {
  ...MOCK_WEB_VERSE_RESPONSE,
  translation: { id: "kjv", name: "King James Version", language: "en" },
};

export const MOCK_WLC_CHAPTER_RESPONSE = {
  book: { id: "GEN", name: "Genesis", testament: "OT" as const },
  chapter: 1,
  translation: { id: "wlc", name: "Westminster Leningrad Codex", language: "he" },
  verses: [{ verse: 1, text: MOCK_WLC_VERSE_RESPONSE.text }],
  verse_count: 1,
  navigation: {
    previous: null,
    next: { book: "Genesis", chapter: 2, testament: "OT" as const },
  },
};

/** Route-aware mock fetch for integration tests (paths are /verses/..., /translations, etc.). */
export function createRouteMockFetchApi(
  handler: (path: string) => unknown,
  options: FetchApiOptions = {},
  env: BibleApiEnv = {}
) {
  const requestedPaths: string[] = [];

  const fetchApi = createTestFetchApi(async (input) => {
    const url = new URL(String(input));
    const path = url.pathname.replace(/^\/v1/, "") + url.search;
    requestedPaths.push(path);

    const data = handler(path);
    if (data === "RATE_LIMIT") {
      return mockRateLimitResponse(30);
    }
    if (data === "NOT_FOUND") {
      return mockResponse({
        ok: false,
        status: 404,
        statusText: "Not Found",
        body: '{"error":"not found"}',
      });
    }

    return mockJsonResponse(data);
  }, options, env);

  return { fetchApi, requestedPaths };
}