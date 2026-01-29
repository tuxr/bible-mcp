import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createMcpHandler } from "agents/mcp";
import { z } from "zod";

// Types for Bible API responses
interface BibleApiVerse {
  book_id: string;
  book_name: string;
  chapter: number;
  verse: number;
  text: string;
}

interface BibleApiResponse {
  reference: string;
  verses: BibleApiVerse[];
  text: string;
  translation_id: string;
  translation_name: string;
  translation_note: string;
}

interface BibleApiError {
  error: string;
}

// Available translations in bible-api.com
const TRANSLATIONS: Record<string, string> = {
  kjv: "King James Version",
  web: "World English Bible (default)",
  webbe: "World English Bible, British Edition",
  oeb: "Open English Bible",
  clementine: "Clementine Latin Vulgate",
  almeida: "João Ferreira de Almeida (Portuguese)",
  rccv: "Romanian Cornilescu Version",
};

// Books of the Bible for reference
const BIBLE_BOOKS = {
  oldTestament: [
    "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy",
    "Joshua", "Judges", "Ruth", "1 Samuel", "2 Samuel",
    "1 Kings", "2 Kings", "1 Chronicles", "2 Chronicles",
    "Ezra", "Nehemiah", "Esther", "Job", "Psalms", "Proverbs",
    "Ecclesiastes", "Song of Solomon", "Isaiah", "Jeremiah",
    "Lamentations", "Ezekiel", "Daniel", "Hosea", "Joel",
    "Amos", "Obadiah", "Jonah", "Micah", "Nahum", "Habakkuk",
    "Zephaniah", "Haggai", "Zechariah", "Malachi"
  ],
  newTestament: [
    "Matthew", "Mark", "Luke", "John", "Acts",
    "Romans", "1 Corinthians", "2 Corinthians", "Galatians",
    "Ephesians", "Philippians", "Colossians",
    "1 Thessalonians", "2 Thessalonians",
    "1 Timothy", "2 Timothy", "Titus", "Philemon",
    "Hebrews", "James", "1 Peter", "2 Peter",
    "1 John", "2 John", "3 John", "Jude", "Revelation"
  ]
};

// Popular verses for the random verse feature
const POPULAR_VERSES = [
  "John 3:16", "Jeremiah 29:11", "Philippians 4:13", "Romans 8:28",
  "Isaiah 41:10", "Psalm 23:1-6", "Proverbs 3:5-6", "Romans 12:2",
  "Philippians 4:6-7", "Matthew 11:28-30", "Joshua 1:9", "Isaiah 40:31",
  "Psalm 46:1", "Galatians 5:22-23", "Hebrews 11:1", "Romans 5:8",
  "2 Timothy 1:7", "1 Corinthians 13:4-7", "Ephesians 2:8-9", "Psalm 91:1-2",
  "Matthew 6:33", "Colossians 3:23", "Psalm 119:105", "James 1:5",
  "1 Peter 5:7", "Deuteronomy 31:6", "Psalm 27:1", "Isaiah 26:3",
  "Matthew 5:14-16", "Romans 15:13", "Psalm 37:4", "Proverbs 16:3"
];

// Create the MCP server
const server = new McpServer({
  name: "Bible MCP",
  version: "1.0.0",
});

/**
 * Fetch a verse or passage from bible-api.com
 */
async function fetchBibleVerse(
  reference: string,
  translation?: string
): Promise<BibleApiResponse | BibleApiError> {
  const url = new URL(`https://bible-api.com/${encodeURIComponent(reference)}`);

  if (translation && translation in TRANSLATIONS) {
    url.searchParams.set("translation", translation);
  }

  const response = await fetch(url.toString());
  return response.json() as Promise<BibleApiResponse | BibleApiError>;
}

/**
 * Format a Bible API response for display
 */
function formatVerseResponse(data: BibleApiResponse): string {
  const lines = [
    `📖 ${data.reference}`,
    `Translation: ${data.translation_name}`,
    "",
    data.text.trim(),
  ];

  if (data.translation_note) {
    lines.push("", `Note: ${data.translation_note}`);
  }

  return lines.join("\n");
}

// =============================================================================
// TOOL: Get Verse
// =============================================================================
server.tool(
  "get_verse",
  `Retrieve a Bible verse or passage by reference.

Examples:
- "John 3:16" - single verse
- "Romans 8:1-11" - verse range
- "Psalm 23" - entire chapter
- "Genesis 1:1-2:3" - cross-chapter range

Available translations: ${Object.entries(TRANSLATIONS).map(([k, v]) => `${k} (${v})`).join(", ")}`,
  {
    reference: z.string().describe("Bible reference (e.g., 'John 3:16', 'Psalm 23', 'Romans 8:1-11')"),
    translation: z.enum(["kjv", "web", "webbe", "oeb", "clementine", "almeida", "rccv"])
      .optional()
      .describe("Translation to use (default: web)"),
  },
  async ({ reference, translation }) => {
    const data = await fetchBibleVerse(reference, translation);

    if ("error" in data) {
      return {
        content: [{ type: "text", text: `Error: ${data.error}` }],
        isError: true,
      };
    }

    return {
      content: [{ type: "text", text: formatVerseResponse(data) }],
    };
  }
);

// =============================================================================
// TOOL: Get Random Verse
// =============================================================================
server.tool(
  "get_random_verse",
  "Get a random inspirational Bible verse from a curated list of popular passages.",
  {
    translation: z.enum(["kjv", "web", "webbe", "oeb", "clementine", "almeida", "rccv"])
      .optional()
      .describe("Translation to use (default: web)"),
  },
  async ({ translation }) => {
    const randomIndex = Math.floor(Math.random() * POPULAR_VERSES.length);
    const reference = POPULAR_VERSES[randomIndex];

    const data = await fetchBibleVerse(reference, translation);

    if ("error" in data) {
      return {
        content: [{ type: "text", text: `Error: ${data.error}` }],
        isError: true,
      };
    }

    return {
      content: [{ type: "text", text: formatVerseResponse(data) }],
    };
  }
);

// =============================================================================
// TOOL: Get Verse of the Day
// =============================================================================
server.tool(
  "get_verse_of_the_day",
  "Get a 'verse of the day' - a consistent verse for the current date that changes daily.",
  {
    translation: z.enum(["kjv", "web", "webbe", "oeb", "clementine", "almeida", "rccv"])
      .optional()
      .describe("Translation to use (default: web)"),
  },
  async ({ translation }) => {
    // Use the current date to deterministically select a verse
    const today = new Date();
    const dayOfYear = Math.floor(
      (today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000
    );
    const verseIndex = dayOfYear % POPULAR_VERSES.length;
    const reference = POPULAR_VERSES[verseIndex];

    const data = await fetchBibleVerse(reference, translation);

    if ("error" in data) {
      return {
        content: [{ type: "text", text: `Error: ${data.error}` }],
        isError: true,
      };
    }

    return {
      content: [{
        type: "text",
        text: `🌅 Verse of the Day (${today.toLocaleDateString()})\n\n${formatVerseResponse(data)}`
      }],
    };
  }
);

// =============================================================================
// TOOL: List Books
// =============================================================================
server.tool(
  "list_books",
  "List all books of the Bible, organized by Old and New Testament.",
  {
    testament: z.enum(["old", "new", "all"])
      .optional()
      .describe("Which testament to list (default: all)"),
  },
  async ({ testament = "all" }) => {
    let result = "";

    if (testament === "all" || testament === "old") {
      result += "📜 OLD TESTAMENT\n";
      result += "─".repeat(40) + "\n";
      result += BIBLE_BOOKS.oldTestament.map((book, i) => `${i + 1}. ${book}`).join("\n");
      result += "\n\n";
    }

    if (testament === "all" || testament === "new") {
      result += "✝️ NEW TESTAMENT\n";
      result += "─".repeat(40) + "\n";
      result += BIBLE_BOOKS.newTestament.map((book, i) => `${i + 1}. ${book}`).join("\n");
    }

    return {
      content: [{ type: "text", text: result.trim() }],
    };
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
    let result = "📚 AVAILABLE TRANSLATIONS\n";
    result += "─".repeat(40) + "\n\n";

    for (const [code, name] of Object.entries(TRANSLATIONS)) {
      const isDefault = code === "web" ? " (default)" : "";
      result += `• ${code}: ${name}${isDefault}\n`;
    }

    result += "\n💡 Use the translation code (e.g., 'kjv') when fetching verses.";

    return {
      content: [{ type: "text", text: result }],
    };
  }
);

// =============================================================================
// TOOL: Compare Translations
// =============================================================================
server.tool(
  "compare_translations",
  "Compare a verse across multiple translations to see different wordings.",
  {
    reference: z.string().describe("Bible reference to compare (e.g., 'John 3:16')"),
    translations: z.array(z.enum(["kjv", "web", "webbe", "oeb"]))
      .optional()
      .describe("Translations to compare (default: kjv, web)"),
  },
  async ({ reference, translations = ["kjv", "web"] }) => {
    const results: string[] = [
      `📖 Comparing: ${reference}`,
      "═".repeat(50),
      "",
    ];

    for (const translation of translations) {
      const data = await fetchBibleVerse(reference, translation);

      if ("error" in data) {
        results.push(`❌ ${translation.toUpperCase()}: Error - ${data.error}\n`);
      } else {
        results.push(`📜 ${data.translation_name}`);
        results.push("─".repeat(40));
        results.push(data.text.trim());
        results.push("");
      }
    }

    return {
      content: [{ type: "text", text: results.join("\n") }],
    };
  }
);

// Export the fetch handler for Cloudflare Workers
export default {
  fetch: createMcpHandler(server),
};
