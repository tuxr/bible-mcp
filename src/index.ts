import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createMcpHandler } from "agents/mcp";
import { z } from "zod";

// =============================================================================
// Configuration
// =============================================================================
const BIBLE_API_BASE = "https://bible-api.dws-cloud.workers.dev/v1";

// =============================================================================
// API Response Types
// =============================================================================
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
// API Client Functions
// =============================================================================
async function fetchApi<T>(path: string): Promise<T | ApiError> {
  const response = await fetch(`${BIBLE_API_BASE}${path}`);
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
  version: "2.0.0",
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
export default {
  fetch: createMcpHandler(server),
};
