import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createMcpHandler } from "agents/mcp";
import { z } from "zod";
import { env } from "cloudflare:workers";

// =============================================================================
// Landing Page HTML
// =============================================================================
const LANDING_PAGE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bible MCP - Bible Tools for Claude.ai</title>
  <style>
    :root {
      --bg-primary: #0d1117;
      --bg-secondary: #161b22;
      --bg-tertiary: #21262d;
      --text-primary: #e6edf3;
      --text-secondary: #8b949e;
      --accent-blue: #58a6ff;
      --accent-green: #3fb950;
      --accent-purple: #a371f7;
      --border-color: #30363d;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      background: var(--bg-primary);
      color: var(--text-primary);
      line-height: 1.6;
      min-height: 100vh;
    }

    .container {
      max-width: 900px;
      margin: 0 auto;
      padding: 2rem;
    }

    header {
      text-align: center;
      padding: 3rem 0;
      border-bottom: 1px solid var(--border-color);
      margin-bottom: 2rem;
    }

    h1 {
      font-size: 2.5rem;
      margin-bottom: 0.5rem;
    }

    .subtitle {
      color: var(--text-secondary);
      font-size: 1.2rem;
    }

    .badge {
      display: inline-block;
      background: var(--accent-green);
      color: var(--bg-primary);
      padding: 0.25rem 0.75rem;
      border-radius: 1rem;
      font-size: 0.8rem;
      font-weight: 600;
      margin-top: 1rem;
    }

    section {
      margin-bottom: 2.5rem;
    }

    h2 {
      font-size: 1.4rem;
      margin-bottom: 1rem;
      color: var(--accent-blue);
    }

    .card {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 1.5rem;
      margin-bottom: 1rem;
    }

    .url-box {
      display: flex;
      align-items: center;
      gap: 1rem;
      background: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      padding: 1rem;
      font-family: 'SF Mono', Monaco, 'Courier New', monospace;
      font-size: 0.95rem;
    }

    .url-box code {
      flex: 1;
      color: var(--accent-green);
      word-break: break-all;
    }

    .copy-btn {
      background: var(--accent-blue);
      color: var(--bg-primary);
      border: none;
      padding: 0.5rem 1rem;
      border-radius: 4px;
      cursor: pointer;
      font-weight: 600;
      font-size: 0.85rem;
      transition: opacity 0.2s;
    }

    .copy-btn:hover {
      opacity: 0.9;
    }

    .steps {
      counter-reset: step;
    }

    .step {
      display: flex;
      gap: 1rem;
      margin-bottom: 1rem;
      align-items: flex-start;
    }

    .step-number {
      background: var(--accent-blue);
      color: var(--bg-primary);
      width: 28px;
      height: 28px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      font-size: 0.85rem;
      flex-shrink: 0;
    }

    .step-content {
      padding-top: 2px;
    }

    .tool {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 1.25rem;
      margin-bottom: 1rem;
    }

    .tool-header {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 0.5rem;
    }

    .tool-name {
      font-family: 'SF Mono', Monaco, 'Courier New', monospace;
      background: var(--bg-tertiary);
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      color: var(--accent-purple);
      font-size: 0.9rem;
    }

    .tool-desc {
      color: var(--text-secondary);
      font-size: 0.95rem;
    }

    .tool-examples {
      margin-top: 0.75rem;
      padding-top: 0.75rem;
      border-top: 1px solid var(--border-color);
      font-size: 0.9rem;
      color: var(--text-secondary);
    }

    .tool-examples code {
      color: var(--text-primary);
      background: var(--bg-tertiary);
      padding: 0.1rem 0.3rem;
      border-radius: 3px;
    }

    .prompts-grid {
      display: grid;
      gap: 0.75rem;
    }

    .prompt {
      background: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      padding: 0.75rem 1rem;
      font-size: 0.95rem;
      color: var(--text-primary);
    }

    .prompt::before {
      content: '"';
      color: var(--accent-blue);
    }

    .prompt::after {
      content: '"';
      color: var(--accent-blue);
    }

    .translations-list {
      display: flex;
      gap: 1rem;
      flex-wrap: wrap;
    }

    .translation {
      background: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      padding: 0.75rem 1rem;
    }

    .translation-id {
      font-family: 'SF Mono', Monaco, 'Courier New', monospace;
      color: var(--accent-green);
      font-weight: 600;
    }

    .translation-name {
      color: var(--text-secondary);
      font-size: 0.9rem;
    }

    .links {
      display: flex;
      gap: 1rem;
      flex-wrap: wrap;
    }

    .link {
      color: var(--accent-blue);
      text-decoration: none;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .link:hover {
      text-decoration: underline;
    }

    footer {
      border-top: 1px solid var(--border-color);
      padding-top: 2rem;
      margin-top: 2rem;
      text-align: center;
      color: var(--text-secondary);
      font-size: 0.9rem;
    }

    footer a {
      color: var(--accent-blue);
      text-decoration: none;
    }

    footer a:hover {
      text-decoration: underline;
    }

    @media (max-width: 600px) {
      .container {
        padding: 1rem;
      }

      h1 {
        font-size: 2rem;
      }

      .url-box {
        flex-direction: column;
        align-items: stretch;
      }

      .copy-btn {
        text-align: center;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>📖 Bible MCP</h1>
      <p class="subtitle">Bible tools for Claude.ai</p>
      <span class="badge">Public MCP Server</span>
    </header>

    <section>
      <h2>🚀 Quick Start</h2>
      <div class="card">
        <p style="margin-bottom: 1rem; color: var(--text-secondary);">Add this URL to Claude.ai to enable Bible tools:</p>
        <div class="url-box">
          <code id="mcp-url">https://bible-mcp.dws-cloud.com/mcp</code>
          <button class="copy-btn" onclick="copyUrl()">Copy</button>
        </div>

        <div class="steps" style="margin-top: 1.5rem;">
          <div class="step">
            <span class="step-number">1</span>
            <span class="step-content">Go to <strong>Claude.ai Settings → Connectors</strong></span>
          </div>
          <div class="step">
            <span class="step-number">2</span>
            <span class="step-content">Click <strong>"Add Connector"</strong> and select <strong>"MCP Server"</strong></span>
          </div>
          <div class="step">
            <span class="step-number">3</span>
            <span class="step-content">Paste the URL above and click <strong>"Add"</strong></span>
          </div>
          <div class="step">
            <span class="step-number">4</span>
            <span class="step-content">Start asking Claude about the Bible!</span>
          </div>
        </div>
      </div>
    </section>

    <section>
      <h2>🛠️ Available Tools</h2>

      <div class="tool">
        <div class="tool-header">
          <span class="tool-name">get_verse</span>
        </div>
        <p class="tool-desc">Retrieve any Bible verse, range, or entire chapter by reference.</p>
        <div class="tool-examples">
          Examples: <code>John 3:16</code>, <code>Psalm 23</code>, <code>Romans 8:28-39</code>, <code>Genesis 1:1-2:3</code>
        </div>
      </div>

      <div class="tool">
        <div class="tool-header">
          <span class="tool-name">search_bible</span>
        </div>
        <p class="tool-desc">Full-text search across all 74,000+ verses. Filter by book or testament.</p>
        <div class="tool-examples">
          Examples: Search for <code>love</code>, <code>faith</code> in Romans, <code>peace</code> in New Testament
        </div>
      </div>

      <div class="tool">
        <div class="tool-header">
          <span class="tool-name">list_books</span>
        </div>
        <p class="tool-desc">List all 86 books of the Bible including Apocrypha, with chapter counts.</p>
        <div class="tool-examples">
          Filter by: <code>OT</code> (Old Testament), <code>NT</code> (New Testament), <code>AP</code> (Apocrypha)
        </div>
      </div>

      <div class="tool">
        <div class="tool-header">
          <span class="tool-name">list_translations</span>
        </div>
        <p class="tool-desc">View all available Bible translations with details.</p>
      </div>

      <div class="tool">
        <div class="tool-header">
          <span class="tool-name">get_random_verse</span>
        </div>
        <p class="tool-desc">Get a random verse for inspiration. Filter by book or testament.</p>
        <div class="tool-examples">
          Examples: Random <code>Psalm</code>, random from <code>New Testament</code>, random <code>Proverb</code>
        </div>
      </div>
    </section>

    <section>
      <h2>💬 Example Prompts</h2>
      <div class="prompts-grid">
        <div class="prompt">Look up John 3:16</div>
        <div class="prompt">Search the Bible for 'faith' in the New Testament</div>
        <div class="prompt">Show me a random Psalm</div>
        <div class="prompt">Get Romans 8:28-39 in KJV</div>
        <div class="prompt">What does the Bible say about love?</div>
        <div class="prompt">List the books of the Apocrypha</div>
        <div class="prompt">Find verses about forgiveness in Matthew</div>
        <div class="prompt">Give me an encouraging verse from Proverbs</div>
      </div>
    </section>

    <section>
      <h2>📚 Translations</h2>
      <div class="translations-list">
        <div class="translation">
          <span class="translation-id">WEB</span>
          <span class="translation-name">World English Bible (default)</span>
        </div>
        <div class="translation">
          <span class="translation-id">KJV</span>
          <span class="translation-name">King James Version</span>
        </div>
      </div>
    </section>

    <section>
      <h2>🔗 Links</h2>
      <div class="links">
        <a href="https://github.com/tuxr/bible-mcp" class="link" target="_blank">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
          GitHub
        </a>
        <a href="https://bible-api.dws-cloud.com" class="link" target="_blank">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
          Bible API
        </a>
      </div>
    </section>

    <footer>
      <p>Powered by <a href="https://bible-api.dws-cloud.com">Bible API</a> on Cloudflare Workers + D1</p>
      <p style="margin-top: 0.5rem;">Built with the <a href="https://modelcontextprotocol.io">Model Context Protocol</a></p>
    </footer>
  </div>

  <script>
    function copyUrl() {
      const url = document.getElementById('mcp-url').textContent;
      navigator.clipboard.writeText(url).then(() => {
        const btn = document.querySelector('.copy-btn');
        btn.textContent = 'Copied!';
        setTimeout(() => {
          btn.textContent = 'Copy';
        }, 2000);
      });
    }
  </script>
</body>
</html>
`;

// =============================================================================
// Types
// =============================================================================

// Service binding type for the Bible API worker
interface Env {
  BIBLE_API: Fetcher;
}

interface Translation {
  id: string;
  name: string;
}

interface Verse {
  book: string;
  book_name: string;
  chapter: number;
  verse: number;
  text: string;
  reference?: string;
}

interface VerseResponse {
  reference: string;
  translation: Translation;
  verses: Verse[];
  text: string;
}

interface SearchResponse {
  query: string;
  translation: string;
  total: number;
  results: Verse[];
}

interface Book {
  id: string;
  name: string;
  testament: string;
  chapters: number;
  aliases: string[];
}

interface TranslationInfo {
  id: string;
  name: string;
  language: string;
  license: string;
  description: string;
}

interface ApiError {
  error: string;
}

// =============================================================================
// API Client - Uses Service Binding for Worker-to-Worker communication
// =============================================================================
async function fetchApi<T>(path: string): Promise<T | ApiError> {
  const bibleApi = (env as unknown as Env).BIBLE_API;

  // Service bindings require a full URL, but it's routed internally
  const url = `https://bible-api.internal/v1${path}`;
  const response = await bibleApi.fetch(url);

  return response.json() as Promise<T | ApiError>;
}

function isError(data: unknown): data is ApiError {
  return typeof data === "object" && data !== null && "error" in data;
}

// =============================================================================
// MCP Server
// =============================================================================
const server = new McpServer({
  name: "Bible MCP",
  version: "2.1.0",
});

// =============================================================================
// TOOL: Get Verse
// =============================================================================
server.tool(
  "get_verse",
  `Retrieve a Bible verse or passage by reference.

Examples:
- "John 3:16" - single verse
- "Romans 8:28-39" - verse range
- "Psalm 23" - entire chapter
- "Genesis 1:1-2:3" - multi-chapter range
- "Tobit 1:1" - Apocrypha supported`,
  {
    reference: z.string().describe("Bible reference (e.g., 'John 3:16', 'Psalm 23', 'Romans 8:28-39')"),
    translation: z.enum(["web", "kjv"])
      .optional()
      .describe("Translation: 'web' (World English Bible, default) or 'kjv' (King James Version)"),
  },
  async ({ reference, translation }) => {
    const params = new URLSearchParams();
    if (translation) params.set("translation", translation);

    const query = params.toString();
    const path = `/verses/${encodeURIComponent(reference)}${query ? `?${query}` : ""}`;
    const data = await fetchApi<VerseResponse>(path);

    if (isError(data)) {
      return {
        content: [{ type: "text", text: `Error: ${data.error}` }],
        isError: true,
      };
    }

    const output = [
      `📖 ${data.reference}`,
      `Translation: ${data.translation.name}`,
      "",
      data.text,
    ].join("\n");

    return { content: [{ type: "text", text: output }] };
  }
);

// =============================================================================
// TOOL: Search Bible
// =============================================================================
server.tool(
  "search_bible",
  `Search the Bible for words or phrases. Returns matching verses with references.

Examples:
- Search all: q="love"
- Filter by book: q="faith", book="ROM"
- Filter by testament: q="peace", testament="NT"`,
  {
    query: z.string().describe("Search term or phrase"),
    book: z.string()
      .optional()
      .describe("Filter by book code (e.g., 'GEN', 'ROM', 'PSA')"),
    testament: z.enum(["OT", "NT", "AP"])
      .optional()
      .describe("Filter by testament: OT (Old), NT (New), AP (Apocrypha)"),
    limit: z.number()
      .min(1)
      .max(50)
      .optional()
      .describe("Max results to return (default: 20, max: 50)"),
  },
  async ({ query, book, testament, limit }) => {
    const params = new URLSearchParams({ q: query });
    if (book) params.set("book", book);
    if (testament) params.set("testament", testament);
    if (limit) params.set("limit", String(limit));

    const data = await fetchApi<SearchResponse>(`/search?${params.toString()}`);

    if (isError(data)) {
      return {
        content: [{ type: "text", text: `Error: ${data.error}` }],
        isError: true,
      };
    }

    if (data.results.length === 0) {
      return {
        content: [{ type: "text", text: `No results found for "${query}"` }],
      };
    }

    const lines = [
      `🔍 Search: "${data.query}"`,
      `Found: ${data.total} results (showing ${data.results.length})`,
      "",
    ];

    for (const verse of data.results) {
      lines.push(`📖 ${verse.reference}`);
      lines.push(verse.text);
      lines.push("");
    }

    return { content: [{ type: "text", text: lines.join("\n").trim() }] };
  }
);

// =============================================================================
// TOOL: List Books
// =============================================================================
server.tool(
  "list_books",
  "List all books of the Bible with chapter counts. Can filter by testament.",
  {
    testament: z.enum(["OT", "NT", "AP", "all"])
      .optional()
      .describe("Filter: OT (Old Testament), NT (New Testament), AP (Apocrypha), all (default)"),
  },
  async ({ testament }) => {
    const params = testament && testament !== "all"
      ? `?testament=${testament}`
      : "";

    const data = await fetchApi<Book[]>(`/books${params}`);

    if (isError(data)) {
      return {
        content: [{ type: "text", text: `Error: ${data.error}` }],
        isError: true,
      };
    }

    // Group by testament
    const grouped: Record<string, Book[]> = {};
    for (const book of data) {
      if (!grouped[book.testament]) grouped[book.testament] = [];
      grouped[book.testament].push(book);
    }

    const testamentNames: Record<string, string> = {
      OT: "📜 OLD TESTAMENT",
      NT: "✝️ NEW TESTAMENT",
      AP: "📚 APOCRYPHA",
    };

    const lines: string[] = [];
    for (const [key, books] of Object.entries(grouped)) {
      lines.push(testamentNames[key] || key);
      lines.push("─".repeat(40));
      for (const book of books) {
        lines.push(`${book.id.padEnd(4)} ${book.name} (${book.chapters} ch)`);
      }
      lines.push("");
    }

    return { content: [{ type: "text", text: lines.join("\n").trim() }] };
  }
);

// =============================================================================
// TOOL: List Translations
// =============================================================================
server.tool(
  "list_translations",
  "List all available Bible translations.",
  {},
  async () => {
    const data = await fetchApi<TranslationInfo[]>("/translations");

    if (isError(data)) {
      return {
        content: [{ type: "text", text: `Error: ${data.error}` }],
        isError: true,
      };
    }

    const lines = ["📚 AVAILABLE TRANSLATIONS", "─".repeat(40), ""];

    for (const t of data) {
      lines.push(`• ${t.id.toUpperCase()} - ${t.name}`);
      lines.push(`  ${t.description}`);
      lines.push(`  Language: ${t.language} | License: ${t.license}`);
      lines.push("");
    }

    return { content: [{ type: "text", text: lines.join("\n").trim() }] };
  }
);

// =============================================================================
// TOOL: Get Random Verse
// =============================================================================
server.tool(
  "get_random_verse",
  `Get a random Bible verse. Can filter by book or testament.

Examples:
- Random from anywhere: no params
- Random Psalm: book="PSA"
- Random from New Testament: testament="NT"`,
  {
    translation: z.enum(["web", "kjv"])
      .optional()
      .describe("Translation: 'web' (default) or 'kjv'"),
    book: z.string()
      .optional()
      .describe("Filter by book code (e.g., 'PSA', 'PRO', 'ROM')"),
    testament: z.enum(["OT", "NT", "AP"])
      .optional()
      .describe("Filter by testament: OT, NT, or AP (Apocrypha)"),
  },
  async ({ translation, book, testament }) => {
    const params = new URLSearchParams();
    if (translation) params.set("translation", translation);
    if (book) params.set("book", book);
    if (testament) params.set("testament", testament);

    const query = params.toString();
    const data = await fetchApi<VerseResponse>(`/random${query ? `?${query}` : ""}`);

    if (isError(data)) {
      return {
        content: [{ type: "text", text: `Error: ${data.error}` }],
        isError: true,
      };
    }

    const output = [
      `🎲 Random Verse`,
      "",
      `📖 ${data.reference}`,
      `Translation: ${data.translation.name}`,
      "",
      data.text,
    ].join("\n");

    return { content: [{ type: "text", text: output }] };
  }
);

// =============================================================================
// Export Handler
// =============================================================================
const mcpHandler = createMcpHandler(server);

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Landing page at root
    if (path === "/" || path === "") {
      return new Response(LANDING_PAGE_HTML, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "public, max-age=3600",
        },
      });
    }

    // MCP protocol handler
    if (path === "/mcp" || path.startsWith("/mcp/")) {
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
