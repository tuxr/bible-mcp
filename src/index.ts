import { createMcpHandler } from "agents/mcp";
import { env } from "cloudflare:workers";
import {
  createFetchApi,
  type BibleApiEnv,
} from "./api-client.js";
import { createServer } from "./mcp-server.js";

// =============================================================================
// Favicon SVG - Simple book icon
// =============================================================================
const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="12" fill="#1a1a2e"/>
  <g fill="#e6edf3">
    <!-- Left page -->
    <path d="M12 16c8-4 16-2 20 0v32c-4-2-12-3-20 0V16z" opacity="0.9"/>
    <!-- Right page -->
    <path d="M52 16c-8-4-16-2-20 0v32c4-2 12-3 20 0V16z" opacity="0.7"/>
    <!-- Spine -->
    <rect x="30" y="14" width="4" height="36" rx="1" opacity="0.5"/>
  </g>
</svg>`;

// =============================================================================
// Server Info JSON (returned at root)
// =============================================================================
const SERVER_INFO = {
  name: "Bible MCP",
  version: "1.0.0",
  description: "MCP server for Bible verse lookup and search",
  documentation: "https://tuxr.github.io/bible-mcp",
  mcp_endpoint: "/mcp",
  tools: [
    "read_bible",
    "get_verse",
    "get_chapter",
    "search_bible",
    "get_random_verse",
    "list_books",
    "list_translations",
  ],
  prompts: ["daily-verse", "study-passage", "topical-search"],
};

// =============================================================================
// API Client - Uses Service Binding (same account) or Public API (cross-account)
// =============================================================================
const fetchApi = createFetchApi(env as unknown as BibleApiEnv);

// =============================================================================
// Export Handler
// =============================================================================
export default {
  async fetch(request: Request, env: BibleApiEnv, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Favicon
    if (path === "/favicon.svg" || path === "/favicon.ico") {
      return new Response(FAVICON_SVG, {
        headers: {
          "Content-Type": "image/svg+xml",
          "Cache-Control": "public, max-age=86400",
        },
      });
    }

    // Server info at root
    if (path === "/" || path === "") {
      return new Response(JSON.stringify(SERVER_INFO, null, 2), {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=3600",
        },
      });
    }

    // MCP protocol handler - new server instance per request
    if (path === "/mcp" || path.startsWith("/mcp/")) {
      const server = createServer(fetchApi);
      const mcpHandler = createMcpHandler(server);
      return mcpHandler(request, env, ctx);
    }

    // Redirect common variations to the right place
    if (path === "/api" || path === "/connect") {
      return Response.redirect(`${url.origin}/mcp`, 301);
    }

    // 404 for other paths
    return new Response("Not Found. Visit / for info or /mcp for the MCP endpoint.", {
      status: 404,
      headers: { "Content-Type": "text/plain" },
    });
  },
};

