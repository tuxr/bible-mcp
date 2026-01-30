# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Live URLs

- **Landing Page:** https://bible-mcp.dws-cloud.com
- **MCP Endpoint:** `https://bible-mcp.dws-cloud.com/mcp`
- **Backup:** `https://bible-mcp.dws-cloud.workers.dev/mcp`
- **Bible API:** https://bible-api.dws-cloud.com

## Commands

```bash
npm run dev      # Start local dev server at http://localhost:8787/mcp
npm run deploy   # Deploy to Cloudflare Workers
npm run inspect  # Open MCP Inspector for testing
npx tsc --noEmit # Type check without emitting
```

## Architecture

This is a stateless MCP server hosted on Cloudflare Workers that communicates with a Bible API worker (also on the same Cloudflare account) via **Service Binding**.

```
MCP Client (Claude.ai) → MCP Worker ──[Service Binding]──► Bible API Worker → D1 Database
```

**Why Service Binding?** Cloudflare Workers on the same account cannot call each other via public HTTP (error 1042). Service Bindings enable direct Worker-to-Worker communication.

**Routes:**
- `/` - Landing page with setup instructions and tool documentation
- `/mcp` - MCP protocol endpoint (for Claude.ai/ChatGPT connectors)
- `/favicon.svg`, `/favicon.ico` - Book icon favicon
- `/api`, `/connect` - Redirect to `/mcp`

**Key components in `src/index.ts`:**
- `FAVICON_SVG` - Inline SVG book icon served at `/favicon.svg`
- `LANDING_PAGE_HTML` - Static HTML landing page
- `env.BIBLE_API` - Service binding to the Bible API worker (configured in `wrangler.toml`)
- `fetchApi<T>()` - Uses the service binding's `.fetch()` method
- Tools registered via `server.tool(name, description, zodSchema, handler)`
- Prompts registered via `server.registerPrompt(name, options, handler)`

**Bible API endpoints used:**
- `GET /v1/verses/{reference}?translation=...` - Fetch verses
- `GET /v1/chapters/{book}/{chapter}?translation=...` - Fetch full chapter with navigation (includes testament in prev/next)
- `GET /v1/search?q=...&book=...&testament=...&limit=...` - Full-text search
- `GET /v1/books?testament=...` - List books with chapter counts
- `GET /v1/translations` - List available translations
- `GET /v1/random?translation=...&book=...&testament=...` - Random verse

## Current Tools & Prompts

**Tools** (model-invoked):
| Tool | Description |
|------|-------------|
| `get_verse` | Retrieve verses by reference (e.g., "John 3:16", "Psalm 23") |
| `get_chapter` | Get full chapter with prev/next navigation |
| `search_bible` | Full-text search with book/testament filters |
| `list_books` | List all books with chapter counts |
| `list_translations` | List available translations (WEB, KJV) |
| `get_random_verse` | Random verse with optional filters |

**Prompts** (user-invoked templates):
| Prompt | Description |
|--------|-------------|
| `daily-verse` | Random verse with reflection prompts |
| `study-passage` | Deep dive with context and analysis |
| `topical-search` | Find and explore verses on a topic |

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

## Adding New Prompts

MCP Prompts are user-invokable templates that appear in the Claude.ai prompt picker. They expand into pre-written messages that include formatting/presentation instructions.

```typescript
import type { GetPromptResult } from "@modelcontextprotocol/sdk/types.js";

server.registerPrompt(
  "prompt-name",
  {
    title: "Human-Readable Title",
    description: "Description shown in prompt picker",
    argsSchema: {
      param: z.string().describe("Parameter description"),
    },
  },
  ({ param }): GetPromptResult => ({
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `The prompt message with ${param}`,
        },
      },
    ],
  })
);
```

## Input Normalization

All enum parameters use `z.preprocess` to normalize case before validation:
- `translation`: lowercased (accepts "KJV", "kjv", "Kjv")
- `testament`: uppercased (accepts "NT", "nt", "Nt")

## Version Constraints

The `@modelcontextprotocol/sdk` version must match the version bundled in `agents` package (currently 1.25.2).

## Local Development Note

Service bindings only work when deployed. For local dev, you may need to temporarily switch to direct HTTP fetch or use `wrangler dev --remote`.

## Observability

Logs and metrics are enabled via `[observability]` in `wrangler.toml`. View in Cloudflare dashboard under Workers & Pages → bible-mcp → Logs/Metrics.
