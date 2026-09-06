---
name: scripture-lookup
description: Look up, search, and cite Bible verses via the hosted Bible MCP. Use when the user asks for Scripture, a verse or passage reference, a chapter to read, a topical or keyword Bible search, a random verse, available translations, or a list of books. Never invent verse text.
---

# Scripture lookup

Use the **Bible MCP** tools from this plugin (`bible` server). Do not fetch the REST Bible API yourself, and do not invent, paraphrase-as-quote, or complete verse text from memory.

## When to call which tool

- **`get_verse`** — default for free-form references (single verse, range, comma-separated refs, or a chapter given as a reference string).
- **`get_chapter`** — when the user wants a full chapter with prev/next navigation (book + chapter number).
- **`search_bible`** — keyword or topical discovery when there is no specific reference.
- **`list_books`** — book names, IDs, chapter counts, or testament lists (OT / NT / AP).
- **`list_translations`** — which translation IDs exist.
- **`get_random_verse`** — a random verse, optionally filtered by book or testament.

## Translations

- Default translation is **`web`** (World English Bible) when the user does not specify one.
- **`wlc`** is the Westminster Leningrad Codex: Hebrew Old Testament only. Do not use it for New Testament or Apocrypha references.

Use `list_translations` if the requested translation is unknown.

## Response shape

Passage-style results include `reference`, `translation`, `verses` (`book`, `book_name`, `chapter`, `verse`, `text`), and combined `text`. Quote only text returned by the tools. If a tool errors or returns no results, say so; do not substitute remembered Scripture.
