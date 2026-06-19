import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createServer } from "./mcp-server.ts";
import {
  createTestFetchApi,
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