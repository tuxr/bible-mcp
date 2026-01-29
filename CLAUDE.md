# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start local dev server at http://localhost:8787/mcp
npm run deploy   # Deploy to Cloudflare Workers
npm run inspect  # Open MCP Inspector for testing
npx tsc --noEmit # Type check without emitting
```

## Architecture

This is a stateless MCP (Model Context Protocol) server hosted on Cloudflare Workers that wraps the bible-api.com REST API.

**Key components in `src/index.ts`:**
- `McpServer` from `@modelcontextprotocol/sdk` - creates the MCP server instance
- `createMcpHandler` from `agents/mcp` - Cloudflare's handler that implements Streamable HTTP transport
- Tools are registered via `server.tool(name, description, zodSchema, handler)`

**Data flow:**
```
MCP Client (Claude.ai) → Cloudflare Worker → bible-api.com → Response formatted and returned
```

**External dependency:** All Bible data comes from `https://bible-api.com/{reference}?translation={code}`

## Adding New Tools

Register tools using the `server.tool()` pattern with Zod schemas for input validation:

```typescript
server.tool(
  "tool_name",
  "Description of what it does",
  { param: z.string().describe("Parameter description") },
  async ({ param }) => {
    return { content: [{ type: "text", text: "response" }] };
  }
);
```

## Version Constraints

The `@modelcontextprotocol/sdk` version must match the version bundled in `agents` package (currently 1.25.2) to avoid type conflicts.
