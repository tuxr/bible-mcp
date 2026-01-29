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

This is a stateless MCP server hosted on Cloudflare Workers that wraps a custom Bible API (also on Workers + D1).

```
MCP Client (Claude.ai) → This MCP Server → Bible API (bible-api.dws-cloud.workers.dev) → D1 Database
```

**Key components in `src/index.ts`:**
- `BIBLE_API_BASE` - Base URL for the Bible API
- `fetchApi<T>()` - Generic API client with error handling
- Tools registered via `server.tool(name, description, zodSchema, handler)`

**Bible API endpoints used:**
- `GET /v1/verses/{reference}?translation=...` - Fetch verses
- `GET /v1/search?q=...&book=...&testament=...&limit=...` - Full-text search
- `GET /v1/books?testament=...` - List books with chapter counts
- `GET /v1/translations` - List available translations
- `GET /v1/random?translation=...&book=...&testament=...` - Random verse

## Adding New Tools

```typescript
server.tool(
  "tool_name",
  "Description",
  { param: z.string().describe("...") },
  async ({ param }) => {
    const data = await fetchApi<ResponseType>(`/endpoint?param=${param}`);
    if (isError(data)) {
      return { content: [{ type: "text", text: `Error: ${data.error}` }], isError: true };
    }
    return { content: [{ type: "text", text: "response" }] };
  }
);
```

## Version Constraints

The `@modelcontextprotocol/sdk` version must match the version bundled in `agents` package (currently 1.25.2).
