import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { GetPromptResult } from "@modelcontextprotocol/sdk/types.js";
import {
  registerAppTool,
  registerAppResource,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
import {
  formatToolError,
  isApiError as isError,
  type FetchApi,
} from "./api-client.ts";
import { BIBLE_READER_HTML } from "./bible-reader-html.ts";
import { readerStructuredContent } from "./translation-utils.ts";

// =============================================================================
// Types
// =============================================================================

interface Translation {
  id: string;
  name: string;
  language?: string;
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

interface ChapterResponse {
  book: { id: string; name: string; testament: "OT" | "NT" | "AP" };
  chapter: number;
  translation: Translation;
  verses: Array<{ verse: number; text: string }>;
  verse_count: number;
  navigation: {
    previous: { book: string; chapter: number; testament: "OT" | "NT" | "AP" } | null;
    next: { book: string; chapter: number; testament: "OT" | "NT" | "AP" } | null;
  };
}

export const TRANSLATION_DESCRIPTION =
  "Translation ID: 'web' (World English Bible, default), 'kjv' (King James Version), 'wlc' (Westminster Leningrad Codex — Hebrew Old Testament only; NT references return no results), or any available translation from list_translations";

const translationSchema = z.preprocess(
  (val) => (typeof val === "string" ? val.toLowerCase() : val),
  z.string().optional()
).describe(TRANSLATION_DESCRIPTION);

// =============================================================================
// MCP Server Factory (new instance per request to avoid cross-client data leaks)
// =============================================================================
export function createServer(fetchApi: FetchApi) {
  const server = new McpServer({
    name: "Bible MCP",
    version: "2.1.0",
  });
  
  // =============================================================================
  // TOOL: Get Verse
  // =============================================================================
  server.tool(
    "get_verse",
    `Retrieve verse text by reference. Returns formatted text with reference and translation.
  
  Examples: "John 3:16", "Romans 8:28-39", "Psalm 23"
  
  Supports comma-separated references with context inheritance:
  - "Romans 14:14, 22-23" (inherits book and chapter)
  - "Psalm 23, 24" (inherits book)
  - "Genesis 1:1, 2:3" (inherits book, new chapter)
  - "John 3:16, Romans 8:28" (independent references)`,
    {
      reference: z.string().describe("Bible reference (e.g., 'John 3:16', 'Psalm 23', 'Romans 8:28-39', 'Romans 14:14, 22-23')"),
      translation: translationSchema,
    },
    async ({ reference, translation }) => {
      const params = new URLSearchParams();
      if (translation) params.set("translation", translation);
  
      const query = params.toString();
      const path = `/verses/${encodeURIComponent(reference)}${query ? `?${query}` : ""}`;
      const data = await fetchApi<VerseResponse>(path);
  
      if (isError(data)) {
        return formatToolError(data, { reference });
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
  // TOOL: Get Chapter
  // =============================================================================
  server.tool(
    "get_chapter",
    `Get full chapter text with verse numbers and prev/next navigation hints.
  
  Examples: ("Genesis", 1), ("PSA", 23), ("ROM", 8)`,
    {
      book: z.string().describe("Book name, abbreviation, or ID (e.g., 'Genesis', 'Gen', 'GEN')"),
      chapter: z.number().describe("Chapter number"),
      translation: translationSchema,
    },
    async ({ book, chapter, translation }) => {
      const params = new URLSearchParams();
      if (translation) params.set("translation", translation);
  
      const query = params.toString();
      const path = `/chapters/${encodeURIComponent(book)}/${chapter}${query ? `?${query}` : ""}`;
      const data = await fetchApi<ChapterResponse>(path);
  
      if (isError(data)) {
        return formatToolError(data, { book, chapter });
      }
  
      // Format verses
      const verseLines = data.verses.map((v) => `${v.verse}. ${v.text}`);
  
      // Testament labels for display
      const testamentLabel: Record<string, string> = {
        OT: "Old Testament",
        NT: "New Testament",
        AP: "Apocrypha",
      };
  
      // Build navigation hint with testament info
      const navParts: string[] = [];
      if (data.navigation.previous) {
        const prev = data.navigation.previous;
        const crossesTestament = prev.testament !== data.book.testament;
        const label = crossesTestament ? ` [${prev.testament}]` : "";
        navParts.push(`← ${prev.book} ${prev.chapter}${label}`);
      }
      if (data.navigation.next) {
        const next = data.navigation.next;
        const crossesTestament = next.testament !== data.book.testament;
        const label = crossesTestament ? ` [${next.testament}]` : "";
        navParts.push(`${next.book} ${next.chapter}${label} →`);
      }
  
      const output = [
        `📖 ${data.book.name} ${data.chapter}`,
        `${testamentLabel[data.book.testament]} | ${data.translation.name} | ${data.verse_count} verses`,
        "",
        ...verseLines,
        "",
        `Navigation: ${navParts.join(" | ") || "End of " + testamentLabel[data.book.testament]}`,
      ].join("\n");
  
      return { content: [{ type: "text", text: output }] };
    }
  );
  
  // =============================================================================
  // TOOL: Search Bible
  // =============================================================================
  server.tool(
    "search_bible",
    `Search for verses containing words or phrases. Returns matching verses with full text.
  
  Examples: "love", "faith" in Romans, "peace" in New Testament`,
    {
      query: z.string().describe("Search term or phrase"),
      book: z.string()
        .optional()
        .describe("Filter by book code (e.g., 'GEN', 'ROM', 'PSA')"),
      testament: z.preprocess(
        (val) => (typeof val === "string" ? val.toUpperCase() : val),
        z.enum(["OT", "NT", "AP"]).optional()
      ).describe("Filter by testament: OT (Old), NT (New), AP (Apocrypha)"),
      limit: z.number()
        .min(1)
        .max(50)
        .optional()
        .describe("Max results to return (default: 20, max: 50)"),
      translation: translationSchema,
    },
    async ({ query, book, testament, limit, translation }) => {
      const params = new URLSearchParams({ q: query });
      if (book) params.set("book", book);
      if (testament) params.set("testament", testament);
      if (limit) params.set("limit", String(limit));
      if (translation) params.set("translation", translation);
  
      const data = await fetchApi<SearchResponse>(`/search?${params.toString()}`);
  
      if (isError(data)) {
        return formatToolError(data, { query });
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
      testament: z.preprocess(
        (val) => (typeof val === "string" ? val.toUpperCase() : val),
        z.enum(["OT", "NT", "AP", "ALL"]).optional()
      ).describe("Filter: OT (Old Testament), NT (New Testament), AP (Apocrypha), all (default)"),
    },
    async ({ testament }) => {
      const params = testament && testament !== "ALL"
        ? `?testament=${testament}`
        : "";
  
      const data = await fetchApi<Book[]>(`/books${params}`);
  
      if (isError(data)) {
        return formatToolError(
          data,
          testament && testament !== "ALL" ? { testament } : undefined
        );
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
    "List all available Bible translations (WEB, KJV, WLC Hebrew, and others).",
    {},
    async () => {
      const data = await fetchApi<TranslationInfo[]>("/translations");
  
      if (isError(data)) {
        return formatToolError(data);
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
    `Get a random verse for inspiration. Returns verse text with reference.
  
  Filters: book="PSA" (Psalms only), testament="NT" (New Testament only)`,
    {
      translation: translationSchema,
      book: z.string()
        .optional()
        .describe("Filter by book code (e.g., 'PSA', 'PRO', 'ROM')"),
      testament: z.preprocess(
        (val) => (typeof val === "string" ? val.toUpperCase() : val),
        z.enum(["OT", "NT", "AP"]).optional()
      ).describe("Filter by testament: OT, NT, or AP (Apocrypha)"),
    },
    async ({ translation, book, testament }) => {
      const params = new URLSearchParams();
      if (translation) params.set("translation", translation);
      if (book) params.set("book", book);
      if (testament) params.set("testament", testament);
  
      const query = params.toString();
      const data = await fetchApi<VerseResponse>(`/random${query ? `?${query}` : ""}`);
  
      if (isError(data)) {
        return formatToolError(data, { book, testament });
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
  // PROMPT: Daily Verse
  // =============================================================================
  server.registerPrompt(
    "daily-verse",
    {
      title: "Daily Verse",
      description: "Get a random verse with reflection prompts for your day",
      argsSchema: {
        testament: z.preprocess(
          (val) => (typeof val === "string" ? val.toUpperCase() : val),
          z.enum(["OT", "NT", "AP"]).optional()
        ).describe("Filter by testament: OT (Old), NT (New), AP (Apocrypha)"),
        translation: translationSchema,
      },
    },
    ({ testament, translation }): GetPromptResult => {
      const testamentText = testament === "OT" ? " from the Old Testament" :
                            testament === "NT" ? " from the New Testament" :
                            testament === "AP" ? " from the Apocrypha" : "";
      const translationText = translation ? ` in ${translation.toUpperCase()}` : "";
  
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Get me a random verse${testamentText}${translationText} for today.
  
  Please:
  1. Display the complete verse in a blockquote with the reference and translation
  2. Share a brief reflection on its meaning
  3. Suggest one way I might apply it today`,
            },
          },
        ],
      };
    }
  );
  
  // =============================================================================
  // PROMPT: Study Passage
  // =============================================================================
  server.registerPrompt(
    "study-passage",
    {
      title: "Study a Passage",
      description: "Deep dive into a Bible passage with context and analysis",
      argsSchema: {
        reference: z.string().describe("Bible reference (e.g., 'Romans 8:28-39', 'Psalm 23')"),
        translation: translationSchema,
      },
    },
    ({ reference, translation }): GetPromptResult => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `I want to study ${reference}${translation ? ` in ${translation.toUpperCase()}` : ""}.
  
  Please:
  1. Display the complete passage text in a blockquote, with verse numbers
  2. Explain the historical and literary context
  3. Highlight key themes and important words
  4. Share how this passage connects to other parts of Scripture
  5. Suggest questions for personal reflection`,
          },
        },
      ],
    })
  );
  
  // =============================================================================
  // PROMPT: Topical Search
  // =============================================================================
  server.registerPrompt(
    "topical-search",
    {
      title: "Topical Search",
      description: "Find and explore verses on a specific topic",
      argsSchema: {
        topic: z.string().describe("Topic to search (e.g., 'forgiveness', 'faith', 'love')"),
        testament: z.preprocess(
          (val) => (typeof val === "string" ? val.toUpperCase() : val),
          z.enum(["OT", "NT", "AP"]).optional()
        ).describe("Filter by testament: OT (Old), NT (New), AP (Apocrypha)"),
        translation: translationSchema,
      },
    },
    ({ topic, testament, translation }): GetPromptResult => {
      const testamentText = testament === "OT" ? " in the Old Testament" :
                            testament === "NT" ? " in the New Testament" :
                            testament === "AP" ? " in the Apocrypha" : "";
      const translationText = translation ? ` using the ${translation.toUpperCase()} translation` : "";
  
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Search the Bible for verses about "${topic}"${testamentText}${translationText}.
  
  Please:
  1. Find relevant verses using the search tool
  2. Display each verse in full with its reference in a blockquote
  3. Group them by theme or book if helpful
  4. Briefly explain how each verse relates to the topic`,
            },
          },
        ],
      };
    }
  );
  
  // =============================================================================
  // MCP APP: Interactive Bible Reader
  // =============================================================================
  const BIBLE_READER_RESOURCE_URI = "ui://bible/reader.html";
  
  // Helper to detect if a reference is a chapter-only reference (e.g., "Genesis 1" vs "Genesis 1:1")
  function isChapterReference(reference: string): { isChapter: boolean; book?: string; chapter?: number } {
    // Patterns like "Genesis 1", "Psalm 23", "1 John 3" (no colon = chapter reference)
    // vs "John 3:16", "Romans 8:28-39" (has colon = verse reference)
    const normalized = reference.trim();
  
    // If it contains a colon, it's a verse reference
    if (normalized.includes(":")) {
      return { isChapter: false };
    }
  
    // Try to extract book and chapter for chapter references
    // Match patterns like "Genesis 1", "1 John 3", "Psalm 23"
    const match = normalized.match(/^(.+?)\s+(\d+)$/);
    if (match) {
      return { isChapter: true, book: match[1], chapter: parseInt(match[2], 10) };
    }
  
    // If no chapter number found, treat as verse reference (API will handle it)
    return { isChapter: false };
  }
  
  registerAppTool(
    server,
    "read_bible",
    {
      title: "Bible Reader",
      description: `Open Scripture in an interactive reader with navigation and translation toggle.
  
  Supports: verses ("John 3:16"), ranges ("Romans 8:28-39"), chapters ("Genesis 1"), comma-separated ("Romans 14:14, 22-23")`,
      inputSchema: {
        reference: z.string().describe("Bible reference - verse (John 3:16), range (Romans 8:28-39), chapter (Genesis 1), or comma-separated (Romans 14:14, 22-23)"),
        translation: translationSchema,
      },
      _meta: {
        ui: {
          resourceUri: BIBLE_READER_RESOURCE_URI,
          csp: {
            resourceDomains: [
              "https://unpkg.com",
              "https://fonts.googleapis.com",
              "https://fonts.gstatic.com",
            ],
            connectDomains: [
              "https://fonts.googleapis.com",
              "https://fonts.gstatic.com",
            ],
          },
        },
      },
    },
    async (args: { reference: string; translation?: string }) => {
      const { reference, translation = "web" } = args;
      const params = new URLSearchParams();
      params.set("translation", translation.toLowerCase());
  
      const chapterInfo = isChapterReference(reference);
  
      if (chapterInfo.isChapter && chapterInfo.book && chapterInfo.chapter) {
        // Chapter reference - use chapter API for navigation support
        const path = `/chapters/${encodeURIComponent(chapterInfo.book)}/${chapterInfo.chapter}?${params.toString()}`;
        const data = await fetchApi<ChapterResponse>(path);
  
        if (isError(data)) {
          return formatToolError(
            data,
            { book: chapterInfo.book, chapter: chapterInfo.chapter },
            { includeStructuredContent: true }
          );
        }
  
        // Text fallback for non-MCP-Apps clients
        const verseLines = data.verses.map((v) => `${v.verse}. ${v.text}`);
        const textOutput = [
          `📖 ${data.book.name} ${data.chapter}`,
          `Translation: ${data.translation.name}`,
          "",
          ...verseLines,
        ].join("\n");
  
        // Structured content for the UI - chapter view with navigation
        return {
          content: [{ type: "text", text: textOutput }],
          structuredContent: readerStructuredContent(
            {
              viewType: "chapter",
              reference: `${data.book.name} ${data.chapter}`,
              book: data.book,
              chapter: data.chapter,
              verses: data.verses,
              navigation: data.navigation,
            },
            data.translation,
            data.translation.language
          ),
        };
      } else {
        // Verse reference - use verse API
        const path = `/verses/${encodeURIComponent(reference)}?${params.toString()}`;
        const data = await fetchApi<VerseResponse>(path);
  
        if (isError(data)) {
          return formatToolError(data, { reference }, { includeStructuredContent: true });
        }
  
        // Text fallback for non-MCP-Apps clients
        const textOutput = [
          `📖 ${data.reference}`,
          `Translation: ${data.translation.name}`,
          "",
          data.text,
        ].join("\n");
  
        // Extract book and chapter from the first verse for "View Chapter" button
        const firstVerse = data.verses[0];
        const chapterContext = firstVerse ? {
          book: firstVerse.book,
          bookName: firstVerse.book_name,
          chapter: firstVerse.chapter,
        } : null;
  
        // Structured content for the UI - verse view with chapter context
        return {
          content: [{ type: "text", text: textOutput }],
          structuredContent: readerStructuredContent(
            {
              viewType: "verses",
              reference: data.reference,
              verses: data.verses.map(v => ({ verse: v.verse, text: v.text })),
              chapterContext,
            },
            data.translation,
            data.translation.language
          ),
        };
      }
    }
  );
  
  registerAppResource(
    server,
    "Bible Reader",
    BIBLE_READER_RESOURCE_URI,
    { mimeType: RESOURCE_MIME_TYPE },
    async () => ({
      contents: [
        {
          uri: BIBLE_READER_RESOURCE_URI,
          mimeType: RESOURCE_MIME_TYPE,
          text: BIBLE_READER_HTML,
          _meta: {
            ui: {
              csp: {
                resourceDomains: [
                  "https://unpkg.com",
                  "https://fonts.googleapis.com",
                  "https://fonts.gstatic.com",
                ],
                connectDomains: [
                  "https://fonts.googleapis.com",
                  "https://fonts.gstatic.com",
                ],
              },
            },
          },
        },
      ],
    })
  );
  
  return server;
}
