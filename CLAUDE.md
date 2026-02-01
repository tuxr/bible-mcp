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

This is a stateless MCP server hosted on Cloudflare Workers that communicates with a Bible API ([GitHub](https://github.com/tuxr/bible-api)).

```
MCP Client (Claude.ai) → MCP Worker ──[HTTPS or Service Binding]──► Bible API → D1 Database
```

**API Connection Options:**
- **Public API:** Set `BIBLE_API_URL` in wrangler.toml - works across Cloudflare accounts
- **Service Binding:** Configure `[[services]]` in wrangler.toml - faster, same account only

The `fetchApi<T>()` function automatically detects which mode to use based on available environment bindings.

**Routes:**
- `/` - Landing page with setup instructions and tool documentation
- `/mcp` - MCP protocol endpoint (for Claude.ai/ChatGPT connectors)
- `/favicon.svg`, `/favicon.ico` - Book icon favicon
- `/api`, `/connect` - Redirect to `/mcp`

**Key components in `src/index.ts`:**
- `FAVICON_SVG` - Inline SVG book icon served at `/favicon.svg`
- `LANDING_PAGE_HTML` - Static HTML landing page
- `env.BIBLE_API` - Service binding (optional, for same-account deployments)
- `env.BIBLE_API_URL` - Public API URL (optional, defaults to hosted API)
- `fetchApi<T>()` - Calls API via service binding or public HTTPS
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
| `read_bible` | Interactive reader with navigation and translation toggle |
| `get_verse` | Retrieve verse text by reference |
| `get_chapter` | Get full chapter with verse numbers and nav hints |
| `search_bible` | Search for verses by keyword |
| `get_random_verse` | Get a random verse for inspiration |
| `list_books` | List all books with chapter counts |
| `list_translations` | List available translations (WEB, KJV) |

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

## MCP Apps (Interactive UIs)

MCP Apps render interactive HTML interfaces directly in Claude.ai. The `read_bible` tool demonstrates this pattern.

**`read_bible` accepts flexible references:**
- Verses: `"John 3:16"` → Shows verse with "View John 3" button
- Ranges: `"Romans 8:28-39"` → Shows range with "View Romans 8" button
- Chapters: `"Genesis 1"` → Shows chapter with prev/next navigation

**Interactive UI features:**
- **Hamburger menu** - Browse all 86 books organized by testament (OT, NT, Apocrypha)
- **Search** - Filter books by name as you type
- **Chapter grid** - Click a book to expand chapter buttons, click to navigate
- **Translation toggle** - Switch between WEB and KJV
- **Reset button** - Returns to original passage after navigating away
- **Copy button** - Copy verses with reference to clipboard
- **Keyboard support** - ESC key closes the menu

**Key components:**
- `registerAppTool()` - Registers a tool with UI metadata (`_meta.ui.resourceUri`)
- `registerAppResource()` - Serves the HTML resource at a `ui://` URI
- `RESOURCE_MIME_TYPE` - Required MIME type (`text/html;profile=mcp-app`)
- `structuredContent` - Data passed to the UI in tool responses

**Adding a new MCP App:**

```typescript
import { registerAppTool, registerAppResource, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";

const RESOURCE_URI = "ui://myapp/view.html";

// Register the tool
registerAppTool(
  server,
  "my_app_tool",
  {
    title: "My App",
    description: "Description of what this app does",
    inputSchema: { param: z.string() },
    _meta: {
      ui: {
        resourceUri: RESOURCE_URI,
        csp: {
          resourceDomains: ["https://cdn.example.com"],  // For external scripts/styles
          connectDomains: ["https://api.example.com"],   // For fetch/WebSocket
        },
      },
    },
  },
  async (args) => ({
    content: [{ type: "text", text: "Fallback text for non-UI clients" }],
    structuredContent: { /* data for the UI */ },
  })
);

// Register the HTML resource
registerAppResource(
  server,
  "My App View",
  RESOURCE_URI,
  { mimeType: RESOURCE_MIME_TYPE },
  async () => ({
    contents: [{
      uri: RESOURCE_URI,
      mimeType: RESOURCE_MIME_TYPE,
      text: MY_APP_HTML,  // Inline HTML string
    }],
  })
);
```

**CSP field names** (use correct names or UI won't load):
- `resourceDomains` - for scripts, images, styles, fonts
- `connectDomains` - for fetch/XHR/WebSocket requests
- `frameDomains` - for nested iframes

**In the HTML**, use the ext-apps SDK:
```html
<script type="module">
  import { App } from "https://unpkg.com/@modelcontextprotocol/ext-apps@1.0.1/dist/src/app-with-deps.js";
  const app = new App({ name: "My App", version: "1.0.0" });
  app.ontoolresult = (result) => { /* render result.structuredContent */ };
  await app.connect();
</script>
```

**Cross-browser transparency**: Add `<meta name="color-scheme" content="dark light">` to prevent Safari from rendering transparent backgrounds as white in iframes.

**Cold start resilience**: Use retry logic for `app.callServerTool()` calls to handle transient timeouts:
```javascript
async function withRetry(fn, retries = 1) {
  for (let i = 0; i <= retries; i++) {
    try { return await fn(); }
    catch (err) {
      if (i < retries) await new Promise(r => setTimeout(r, 500));
      else throw err;
    }
  }
}
```

**Security (XSS prevention)**: Use DOM APIs to prevent cross-site scripting:
```javascript
// For displaying user input or API data as text content:
element.textContent = userInput;  // Safe - never parsed as HTML

// For building HTML strings with API data, escape first:
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
html += '<span>' + escapeHtml(apiData) + '</span>';

// For error handlers with retry buttons, use event listeners:
const retryBtn = document.createElement("button");
retryBtn.textContent = "Retry";
retryBtn.addEventListener("click", () => loadData(param));  // Safe closure
```

**Accessibility**: Add ARIA attributes to icon-only buttons:
```html
<button aria-label="Close menu">
  <svg aria-hidden="true">...</svg>
</button>
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
