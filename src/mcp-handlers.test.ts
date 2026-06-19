import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createServer } from "./mcp-server.ts";
import {
  createRouteMockFetchApi,
  createTestFetchApi,
  MOCK_TRANSLATIONS,
  MOCK_WEB_VERSE_RESPONSE,
  MOCK_WLC_VERSE_RESPONSE,
  mockRateLimitResponse,
} from "./test-helpers.ts";

const RATE_LIMIT_MESSAGE =
  "Rate limit exceeded. Please try again in 30 seconds.";

const expectedMcpError = {
  content: [{ type: "text", text: `Error: ${RATE_LIMIT_MESSAGE}` }],
  isError: true,
};

const expectedMcpAppError = {
  ...expectedMcpError,
  structuredContent: { error: RATE_LIMIT_MESSAGE },
};

async function callMcpTool(
  server: McpServer,
  name: string,
  args: Record<string, unknown> = {}
) {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-client", version: "1.0.0" });

  await server.connect(serverTransport);
  await client.connect(clientTransport);

  try {
    return await client.callTool({ name, arguments: args });
  } finally {
    await client.close();
    await server.close();
  }
}

function createRateLimitedServer() {
  const fetchApi = createTestFetchApi(async () => mockRateLimitResponse(30));
  return createServer(fetchApi);
}

function createBibleDataServer() {
  const { fetchApi } = createRouteMockFetchApi((path) => {
    if (path === "/translations") {
      return MOCK_TRANSLATIONS;
    }
    if (path.startsWith("/verses/") && path.includes("translation=wlc")) {
      return MOCK_WLC_VERSE_RESPONSE;
    }
    if (path.startsWith("/verses/") && path.includes("translation=custom")) {
      return {
        ...MOCK_WEB_VERSE_RESPONSE,
        translation: { id: "custom", name: "Custom Translation" },
      };
    }
    if (path.startsWith("/verses/")) {
      return MOCK_WEB_VERSE_RESPONSE;
    }
    if (path.startsWith("/search?") && path.includes("translation=wlc")) {
      return {
        query: "אלהים",
        translation: "wlc",
        total: 1,
        results: [
          {
            reference: "Genesis 1:1",
            book: "GEN",
            book_name: "Genesis",
            chapter: 1,
            verse: 1,
            text: MOCK_WLC_VERSE_RESPONSE.text,
          },
        ],
      };
    }
    if (path.startsWith("/search?")) {
      return {
        query: "love",
        translation: "web",
        total: 1,
        results: [
          {
            reference: "John 3:16",
            book: "JHN",
            book_name: "John",
            chapter: 3,
            verse: 16,
            text: MOCK_WEB_VERSE_RESPONSE.text,
          },
        ],
      };
    }
    return "NOT_FOUND";
  });

  return createServer(fetchApi);
}

describe("MCP tool handlers (integration)", () => {
  const rateLimitedTools: Array<{
    tool: string;
    args: Record<string, unknown>;
    expected: typeof expectedMcpError | typeof expectedMcpAppError;
  }> = [
    {
      tool: "get_verse",
      args: { reference: "John 3:16" },
      expected: expectedMcpError,
    },
    {
      tool: "get_chapter",
      args: { book: "John", chapter: 3 },
      expected: expectedMcpError,
    },
    {
      tool: "search_bible",
      args: { query: "love" },
      expected: expectedMcpError,
    },
    {
      tool: "get_random_verse",
      args: {},
      expected: expectedMcpError,
    },
    {
      tool: "list_books",
      args: {},
      expected: expectedMcpError,
    },
    {
      tool: "list_translations",
      args: {},
      expected: expectedMcpError,
    },
    {
      tool: "read_bible",
      args: { reference: "John 3:16" },
      expected: expectedMcpAppError,
    },
    {
      tool: "read_bible",
      args: { reference: "Genesis 1" },
      expected: expectedMcpAppError,
    },
  ];

  for (const { tool, args, expected } of rateLimitedTools) {
    const label =
      tool === "read_bible"
        ? `${tool} (${args.reference})`
        : tool;

    it(`returns MCP error shape for rate-limited ${label}`, async () => {
      const result = await callMcpTool(createRateLimitedServer(), tool, args);

      assert.equal(result.isError, true);
      assert.deepEqual(result.content, expected.content);

      if ("structuredContent" in expected) {
        assert.deepEqual(result.structuredContent, expected.structuredContent);
      } else {
        assert.equal(result.structuredContent, undefined);
      }
    });
  }
});

describe("MCP translation support", () => {
  it("list_translations includes WLC in mocked API data", async () => {
    const result = await callMcpTool(createBibleDataServer(), "list_translations");

    assert.equal(result.isError, undefined);
    const content = result.content as Array<{ type: string; text: string }>;
    const text = content[0].text;
    assert.match(text, /WLC/);
    assert.match(text, /Westminster Leningrad Codex/);
    assert.match(text, /Language: he/);
  });

  it("get_verse accepts translation=wlc and returns Hebrew text", async () => {
    const { fetchApi, requestedPaths } = createRouteMockFetchApi((path) => {
      if (path.startsWith("/verses/")) {
        return MOCK_WLC_VERSE_RESPONSE;
      }
      return "NOT_FOUND";
    });
    const result = await callMcpTool(createServer(fetchApi), "get_verse", {
      reference: "Genesis 1:1",
      translation: "wlc",
    });

    assert.equal(result.isError, undefined);
    const content = result.content as Array<{ type: string; text: string }>;
    const text = content[0].text;
    assert.match(text, /Genesis 1:1/);
    assert.match(text, /Westminster Leningrad Codex/);
    assert.match(text, /בְּרֵאשִׁית/);
    assert.ok(requestedPaths.some((path) => path.includes("translation=wlc")));
  });

  it("normalizes translation parameter to lowercase", async () => {
    const { fetchApi, requestedPaths } = createRouteMockFetchApi((path) => {
      if (path.startsWith("/verses/")) {
        return MOCK_WEB_VERSE_RESPONSE;
      }
      return "NOT_FOUND";
    });
    await callMcpTool(createServer(fetchApi), "get_verse", {
      reference: "John 3:16",
      translation: "KJV",
    });

    assert.ok(requestedPaths.some((path) => path.includes("translation=kjv")));
  });

  it("accepts arbitrary translation IDs as lowercase strings", async () => {
    const { fetchApi, requestedPaths } = createRouteMockFetchApi((path) => {
      if (path.startsWith("/verses/")) {
        return {
          ...MOCK_WEB_VERSE_RESPONSE,
          translation: { id: "custom", name: "Custom Translation" },
        };
      }
      return "NOT_FOUND";
    });
    const result = await callMcpTool(createServer(fetchApi), "get_verse", {
      reference: "John 3:16",
      translation: "Custom",
    });

    assert.equal(result.isError, undefined);
    const content = result.content as Array<{ type: string; text: string }>;
    const text = content[0].text;
    assert.match(text, /Custom Translation/);
    assert.ok(requestedPaths.some((path) => path.includes("translation=custom")));
  });

  it("search_bible forwards translation parameter to the API", async () => {
    const { fetchApi, requestedPaths } = createRouteMockFetchApi((path) => {
      if (path.startsWith("/search?")) {
        return {
          query: "אלהים",
          translation: "wlc",
          total: 1,
          results: [
            {
              ...MOCK_WLC_VERSE_RESPONSE.verses[0],
              reference: "Genesis 1:1",
            },
          ],
        };
      }
      return "NOT_FOUND";
    });
    const result = await callMcpTool(createServer(fetchApi), "search_bible", {
      query: "אלהים",
      translation: "wlc",
    });

    assert.equal(result.isError, undefined);
    const content = result.content as Array<{ type: string; text: string }>;
    const text = content[0].text;
    assert.match(text, /Genesis 1:1/);
    assert.ok(requestedPaths.some((path) => path.includes("translation=wlc")));
  });

  it("read_bible includes RTL direction metadata for WLC", async () => {
    const result = await callMcpTool(createBibleDataServer(), "read_bible", {
      reference: "Genesis 1:1",
      translation: "wlc",
    });

    assert.equal(result.isError, undefined);
    const structured = result.structuredContent as {
      direction?: string;
      language?: string;
      translation?: { id: string };
      verses?: Array<{ text: string }>;
    };
    assert.equal(structured.direction, "rtl");
    assert.equal(structured.language, "he");
    assert.equal(structured.translation?.id, "wlc");
    assert.match(structured.verses?.[0]?.text ?? "", /בְּרֵאשִׁית/);
  });
});