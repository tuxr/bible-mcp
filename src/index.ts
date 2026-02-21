import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createMcpHandler } from "agents/mcp";
import { z } from "zod";
import type { GetPromptResult } from "@modelcontextprotocol/sdk/types.js";
import { env } from "cloudflare:workers";
import { registerAppTool, registerAppResource, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";

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
// Bible Reader App HTML (MCP Apps)
// =============================================================================
const BIBLE_READER_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="dark light">
  <title>Bible Reader</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    :root {
      --bg-card: #16213e;
      --bg-menu: #0d1117;
      --bg-menu-item: #161b22;
      --text: #e6edf3;
      --text-muted: #8b949e;
      --accent: #58a6ff;
      --border: #30363d;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: transparent;
      color: var(--text);
      padding: 0.5rem;
    }

    body.light {
      --bg-card: #f6f8fa;
      --bg-menu: #ffffff;
      --bg-menu-item: #f0f3f6;
      --text: #1f2328;
      --text-muted: #656d76;
      --accent: #0969da;
      --border: #d0d7de;
    }


    .card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.5rem;
      max-width: 700px;
      margin: 0 auto;
    }

    .header {
      display: flex;
      align-items: center;
      margin-bottom: 1rem;
      gap: 0.75rem;
    }

    .menu-btn {
      padding: 0.5rem;
      border: 1px solid var(--border);
      background: transparent;
      color: var(--text-muted);
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.15s;
      flex-shrink: 0;
    }

    .menu-btn:hover {
      color: var(--accent);
      border-color: var(--accent);
    }

    .reference {
      font-size: 1.25rem;
      font-weight: 600;
      color: var(--accent);
      flex: 1;
    }

    .translation-toggle {
      display: flex;
      gap: 0.25rem;
      background: var(--bg-menu);
      border-radius: 6px;
      padding: 0.25rem;
      flex-shrink: 0;
    }

    .translation-btn {
      padding: 0.375rem 0.75rem;
      border: none;
      background: transparent;
      color: var(--text-muted);
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.8rem;
      font-weight: 500;
      transition: all 0.15s;
    }

    .translation-btn.active {
      background: var(--accent);
      color: white;
    }

    .translation-btn:hover:not(.active) {
      color: var(--text);
    }

    .verses {
      line-height: 1.8;
      font-size: 1.05rem;
      margin: 1rem 0;
    }

    .verse-num {
      color: var(--accent);
      font-size: 0.75rem;
      font-weight: 600;
      vertical-align: super;
      margin-right: 0.25rem;
    }

    .nav-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 1rem;
      padding-top: 1rem;
      border-top: 1px solid var(--border);
      gap: 0.5rem;
    }

    .nav-btn {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 1rem;
      border: 1px solid var(--border);
      background: transparent;
      color: var(--text);
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.9rem;
      transition: all 0.15s;
    }

    .nav-btn:hover:not(:disabled) {
      border-color: var(--accent);
      color: var(--accent);
    }

    .nav-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .nav-btn.center {
      flex: 1;
      justify-content: center;
      max-width: 200px;
    }

    .copy-btn {
      padding: 0.5rem;
      border: 1px solid var(--border);
      background: transparent;
      color: var(--text-muted);
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.15s;
    }

    .copy-btn:hover {
      color: var(--accent);
      border-color: var(--accent);
    }

    .loading {
      text-align: center;
      color: var(--text-muted);
      padding: 2rem;
    }

    .error {
      color: #f85149;
      text-align: center;
      padding: 1rem;
    }

    .error button {
      margin-top: 0.5rem;
      padding: 0.375rem 0.75rem;
      border: 1px solid var(--border);
      background: transparent;
      color: var(--text);
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.85rem;
    }

    .error button:hover {
      border-color: var(--accent);
      color: var(--accent);
    }

    /* Menu - slide-in side panel */
    .menu-backdrop {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: transparent;
      z-index: 100;
    }

    .menu-backdrop.open {
      display: block;
    }

    .menu-panel {
      position: fixed;
      top: 0.5rem;
      left: 0.5rem;
      bottom: 0.5rem;
      width: 300px;
      max-width: calc(85vw - 1rem);
      background: var(--bg-menu);
      border: 1px solid var(--border);
      border-radius: 12px;
      box-shadow: 4px 0 24px rgba(0, 0, 0, 0.4);
      z-index: 101;
      display: flex;
      flex-direction: column;
      transform: translateX(calc(-100% - 1rem));
      transition: transform 0.2s ease-out;
    }

    .menu-backdrop.open .menu-panel {
      transform: translateX(0);
    }

    .menu-header {
      padding: 1rem 1.25rem;
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .menu-header h2 {
      flex: 1;
      font-size: 1.1rem;
      font-weight: 600;
      color: var(--accent);
    }

    .close-btn {
      padding: 0.375rem;
      border: 1px solid var(--border);
      background: transparent;
      color: var(--text-muted);
      cursor: pointer;
      border-radius: 6px;
      transition: all 0.15s;
    }

    .close-btn:hover {
      color: var(--accent);
      border-color: var(--accent);
    }

    .search-box {
      padding: 0.75rem 1.25rem;
      border-bottom: 1px solid var(--border);
    }

    .search-input {
      width: 100%;
      padding: 0.5rem 0.75rem;
      border: 1px solid var(--border);
      border-radius: 6px;
      background: var(--bg-menu-item);
      color: var(--text);
      font-size: 0.9rem;
    }

    .search-input::placeholder {
      color: var(--text-muted);
    }

    .search-input:focus {
      outline: none;
      border-color: var(--accent);
    }

    .book-list {
      flex: 1;
      overflow-y: auto;
      padding: 0.5rem 0;
    }

    .testament-section {
      margin-bottom: 0.25rem;
    }

    .testament-header {
      padding: 0.75rem 1.25rem;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      color: var(--text-muted);
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      user-select: none;
    }

    .testament-header:hover {
      color: var(--text);
    }

    .testament-header .arrow {
      transition: transform 0.15s;
    }

    .testament-header.collapsed .arrow {
      transform: rotate(-90deg);
    }

    .testament-books {
      display: block;
    }

    .testament-books.collapsed {
      display: none;
    }

    .book-row {
      padding: 0.5rem 1.25rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 0.9rem;
    }

    .book-row:hover {
      background: var(--bg-menu-item);
    }

    .book-row.expanded {
      background: var(--bg-menu-item);
    }

    .book-name {
      flex: 1;
    }

    .book-chapters-count {
      color: var(--text-muted);
      font-size: 0.8rem;
    }

    .chapter-grid {
      display: none;
      padding: 0.5rem 1.25rem 0.75rem;
      background: var(--bg-menu-item);
      flex-wrap: wrap;
      gap: 0.375rem;
    }

    .chapter-grid.expanded {
      display: flex;
    }

    .chapter-btn {
      width: 2rem;
      height: 2rem;
      border: 1px solid var(--border);
      background: var(--bg-menu);
      color: var(--text);
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.8rem;
      transition: all 0.1s;
    }

    .chapter-btn:hover {
      border-color: var(--accent);
      color: var(--accent);
    }

    .no-results {
      padding: 2rem 1rem;
      text-align: center;
      color: var(--text-muted);
    }
  </style>
</head>
<body>
  <div class="card">
    <div id="content" class="loading">Loading...</div>
  </div>

  <div class="menu-backdrop" id="menuBackdrop">
    <div class="menu-panel" id="menuPanel">
      <div class="menu-header">
        <h2>Books of the Bible</h2>
        <button class="close-btn" id="closeMenuBtn" aria-label="Close menu">
          <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z"/></svg>
        </button>
      </div>
      <div class="search-box">
        <input type="text" class="search-input" id="bookSearch" placeholder="Search books...">
      </div>
      <div class="book-list" id="bookList">
        <div class="loading">Loading books...</div>
      </div>
    </div>
  </div>

  <script type="module">
    import { App } from "https://unpkg.com/@modelcontextprotocol/ext-apps@1.0.1/dist/src/app-with-deps.js";

    const app = new App({ name: "Bible Reader", version: "1.0.0" });
    const contentEl = document.getElementById("content");
    const menuBackdrop = document.getElementById("menuBackdrop");
    const bookListEl = document.getElementById("bookList");
    const bookSearchEl = document.getElementById("bookSearch");
    const closeMenuBtn = document.getElementById("closeMenuBtn");

    let currentData = null;
    let currentTranslation = "web";
    let initialReference = null;
    let bookListCache = null;
    let expandedBook = null;

    // HTML escape helper to prevent XSS
    function escapeHtml(str) {
      const div = document.createElement("div");
      div.textContent = str;
      return div.innerHTML;
    }

    function render() {
      if (!currentData) {
        contentEl.textContent = "Loading...";
        contentEl.className = "loading";
        return;
      }

      if (currentData.error) {
        contentEl.textContent = currentData.error;
        contentEl.className = "error";
        return;
      }

      contentEl.className = "";
      const { reference, translation, verses, viewType, navigation, chapterContext } = currentData;

      // Build header with menu button
      const header = document.createElement("div");
      header.className = "header";

      const menuBtn = document.createElement("button");
      menuBtn.className = "menu-btn";
      menuBtn.title = "Browse books";
      menuBtn.setAttribute("aria-label", "Browse books");
      menuBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M1 2.75A.75.75 0 0 1 1.75 2h12.5a.75.75 0 0 1 0 1.5H1.75A.75.75 0 0 1 1 2.75Zm0 5A.75.75 0 0 1 1.75 7h12.5a.75.75 0 0 1 0 1.5H1.75A.75.75 0 0 1 1 7.75ZM1.75 12h12.5a.75.75 0 0 1 0 1.5H1.75a.75.75 0 0 1 0-1.5Z"/></svg>';
      menuBtn.addEventListener("click", openMenu);
      header.appendChild(menuBtn);

      const refSpan = document.createElement("span");
      refSpan.className = "reference";
      refSpan.textContent = reference;
      header.appendChild(refSpan);

      const toggleDiv = document.createElement("div");
      toggleDiv.className = "translation-toggle";
      ["web", "kjv"].forEach(t => {
        const btn = document.createElement("button");
        btn.className = "translation-btn" + (currentTranslation === t ? " active" : "");
        btn.textContent = t.toUpperCase();
        btn.addEventListener("click", () => switchTranslation(t));
        toggleDiv.appendChild(btn);
      });
      header.appendChild(toggleDiv);

      const versesDiv = document.createElement("div");
      versesDiv.className = "verses";
      verses.forEach(v => {
        const num = document.createElement("span");
        num.className = "verse-num";
        num.textContent = v.verse;
        versesDiv.appendChild(num);
        versesDiv.appendChild(document.createTextNode(v.text + " "));
      });

      const navBar = document.createElement("div");
      navBar.className = "nav-bar";

      const hasNavigatedAway = initialReference && reference !== initialReference;

      if (viewType === "chapter" && navigation) {
        const prevBtn = document.createElement("button");
        prevBtn.className = "nav-btn";
        prevBtn.disabled = !navigation.previous;
        prevBtn.textContent = navigation.previous
          ? "← " + navigation.previous.book + " " + navigation.previous.chapter
          : "← Previous";
        prevBtn.addEventListener("click", () => {
          if (navigation.previous) loadReference(navigation.previous.book + " " + navigation.previous.chapter);
        });

        const middleContainer = document.createElement("div");
        middleContainer.style.display = "flex";
        middleContainer.style.gap = "0.5rem";
        middleContainer.style.alignItems = "center";

        if (hasNavigatedAway) {
          const resetBtn = document.createElement("button");
          resetBtn.className = "nav-btn";
          resetBtn.textContent = "↩ " + initialReference;
          resetBtn.title = "Return to original passage";
          resetBtn.addEventListener("click", () => loadReference(initialReference));
          middleContainer.appendChild(resetBtn);
        }

        const copyBtn = document.createElement("button");
        copyBtn.className = "copy-btn";
        copyBtn.title = "Copy verses";
        copyBtn.setAttribute("aria-label", "Copy verses");
        copyBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z"/><path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"/></svg>';
        copyBtn.addEventListener("click", () => copyVerses(copyBtn));
        middleContainer.appendChild(copyBtn);

        const nextBtn = document.createElement("button");
        nextBtn.className = "nav-btn";
        nextBtn.disabled = !navigation.next;
        nextBtn.textContent = navigation.next
          ? navigation.next.book + " " + navigation.next.chapter + " →"
          : "Next →";
        nextBtn.addEventListener("click", () => {
          if (navigation.next) loadReference(navigation.next.book + " " + navigation.next.chapter);
        });

        navBar.appendChild(prevBtn);
        navBar.appendChild(middleContainer);
        navBar.appendChild(nextBtn);
      } else {
        if (chapterContext) {
          const viewChapterBtn = document.createElement("button");
          viewChapterBtn.className = "nav-btn center";
          viewChapterBtn.textContent = "View " + chapterContext.bookName + " " + chapterContext.chapter;
          viewChapterBtn.addEventListener("click", () => {
            loadReference(chapterContext.bookName + " " + chapterContext.chapter);
          });
          navBar.appendChild(viewChapterBtn);
        }

        const copyBtn = document.createElement("button");
        copyBtn.className = "copy-btn";
        copyBtn.title = "Copy verses";
        copyBtn.setAttribute("aria-label", "Copy verses");
        copyBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z"/><path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"/></svg>';
        copyBtn.addEventListener("click", () => copyVerses(copyBtn));
        navBar.appendChild(copyBtn);
      }

      contentEl.replaceChildren(header, versesDiv, navBar);
    }

    // Retry helper for cold start resilience
    async function withRetry(fn, retries = 1) {
      let lastError;
      for (let i = 0; i <= retries; i++) {
        try {
          return await fn();
        } catch (err) {
          lastError = err;
          if (i < retries) {
            await new Promise(r => setTimeout(r, 500)); // Brief delay before retry
          }
        }
      }
      throw lastError;
    }

    async function loadReference(reference) {
      contentEl.innerHTML = '<div class="loading">Loading...</div>';
      try {
        const result = await withRetry(async () => {
          return await app.callServerTool({
            name: "read_bible",
            arguments: { reference, translation: currentTranslation }
          });
        });
        if (result.structuredContent) {
          currentData = result.structuredContent;
          render();
        }
      } catch (err) {
        const errorDiv = document.createElement("div");
        errorDiv.className = "error";
        errorDiv.textContent = "Failed to load passage. ";
        const retryBtn = document.createElement("button");
        retryBtn.textContent = "Retry";
        retryBtn.addEventListener("click", () => loadReference(reference));
        errorDiv.appendChild(retryBtn);
        contentEl.replaceChildren(errorDiv);
      }
    }

    async function switchTranslation(translation) {
      if (translation === currentTranslation) return;
      currentTranslation = translation;
      if (currentData?.reference) {
        loadReference(currentData.reference);
      }
    }

    function copyVerses(btn) {
      if (!currentData) return;
      const text = currentData.reference + " (" + currentData.translation.name + ")\\n\\n" +
        currentData.verses.map(v => v.verse + ". " + v.text).join("\\n");
      navigator.clipboard.writeText(text);
      btn.textContent = "✓";
      setTimeout(() => {
        btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z"/><path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"/></svg>';
      }, 1500);
    }

    // Menu functions
    async function openMenu() {
      menuBackdrop.classList.add("open");
      bookSearchEl.value = "";
      setTimeout(() => bookSearchEl.focus(), 100);
      if (!bookListCache) {
        await loadBookList();
      }
      renderBookList();
    }

    function closeMenu() {
      menuBackdrop.classList.remove("open");
      expandedBook = null;
    }

    async function loadBookList() {
      bookListEl.innerHTML = '<div class="loading">Loading books...</div>';
      try {
        const result = await withRetry(async () => {
          return await app.callServerTool({
            name: "list_books",
            arguments: {}
          });
        });
        // Parse the text response to extract book data
        const text = result.content?.[0]?.text || "";
        bookListCache = parseBookList(text);
        renderBookList();
      } catch (err) {
        const errorDiv = document.createElement("div");
        errorDiv.className = "error";
        errorDiv.textContent = "Failed to load books. ";
        const retryBtn = document.createElement("button");
        retryBtn.textContent = "Retry";
        retryBtn.addEventListener("click", () => loadBookList());
        errorDiv.appendChild(retryBtn);
        bookListEl.replaceChildren(errorDiv);
      }
    }

    function parseBookList(text) {
      const books = { OT: [], NT: [], AP: [] };
      let currentTestament = null;
      const lines = text.split("\\n");

      for (const line of lines) {
        if (line.includes("OLD TESTAMENT")) currentTestament = "OT";
        else if (line.includes("NEW TESTAMENT")) currentTestament = "NT";
        else if (line.includes("APOCRYPHA")) currentTestament = "AP";
        else if (currentTestament && line.match(/^[A-Z0-9]+\\s+.+\\(\\d+/)) {
          const match = line.match(/^([A-Z0-9]+)\\s+(.+?)\\s+\\((\\d+)/);
          if (match) {
            books[currentTestament].push({
              id: match[1],
              name: match[2].trim(),
              chapters: parseInt(match[3])
            });
          }
        }
      }
      return books;
    }

    function renderBookList(filter = "") {
      if (!bookListCache) return;

      const filterLower = filter.toLowerCase();
      const testaments = [
        { key: "OT", label: "Old Testament", icon: "📜" },
        { key: "NT", label: "New Testament", icon: "✝️" },
        { key: "AP", label: "Apocrypha", icon: "📚" }
      ];

      let html = "";
      let hasResults = false;

      for (const t of testaments) {
        const books = bookListCache[t.key] || [];
        const filtered = filter
          ? books.filter(b => b.name.toLowerCase().includes(filterLower) || b.id.toLowerCase().includes(filterLower))
          : books;

        if (filtered.length === 0) continue;
        hasResults = true;

        html += '<div class="testament-section">';
        html += '<div class="testament-header" data-testament="' + t.key + '">';
        html += '<span class="arrow">▼</span> ' + t.icon + ' ' + t.label + ' (' + filtered.length + ')';
        html += '</div>';
        html += '<div class="testament-books" data-testament-books="' + t.key + '">';

        for (const book of filtered) {
          const isExpanded = expandedBook === book.id;
          // Escape API data to prevent XSS if backend is compromised
          const safeId = escapeHtml(book.id);
          const safeName = escapeHtml(book.name);
          html += '<div class="book-row' + (isExpanded ? ' expanded' : '') + '" data-book="' + safeId + '" data-name="' + safeName + '" data-chapters="' + book.chapters + '">';
          html += '<span class="book-name">' + safeName + '</span>';
          html += '<span class="book-chapters-count">' + book.chapters + ' ch</span>';
          html += '</div>';
          html += '<div class="chapter-grid' + (isExpanded ? ' expanded' : '') + '" data-book-chapters="' + safeId + '">';
          for (let i = 1; i <= book.chapters; i++) {
            html += '<button class="chapter-btn" data-book-name="' + safeName + '" data-chapter="' + i + '">' + i + '</button>';
          }
          html += '</div>';
        }

        html += '</div></div>';
      }

      if (!hasResults) {
        // Use DOM API to safely display user input (prevents XSS)
        bookListEl.innerHTML = "";
        const noResults = document.createElement("div");
        noResults.className = "no-results";
        noResults.textContent = 'No books found for "' + filter + '"';
        bookListEl.appendChild(noResults);
        return;
      }

      bookListEl.innerHTML = html;

      // Add event listeners
      bookListEl.querySelectorAll(".testament-header").forEach(el => {
        el.addEventListener("click", () => {
          const testament = el.dataset.testament;
          const booksEl = bookListEl.querySelector('[data-testament-books="' + testament + '"]');
          el.classList.toggle("collapsed");
          booksEl.classList.toggle("collapsed");
        });
      });

      bookListEl.querySelectorAll(".book-row").forEach(el => {
        el.addEventListener("click", () => {
          const bookId = el.dataset.book;
          const wasExpanded = expandedBook === bookId;

          // Collapse previous
          if (expandedBook) {
            bookListEl.querySelector('.book-row[data-book="' + expandedBook + '"]')?.classList.remove("expanded");
            bookListEl.querySelector('[data-book-chapters="' + expandedBook + '"]')?.classList.remove("expanded");
          }

          // Expand new (if different)
          if (!wasExpanded) {
            el.classList.add("expanded");
            bookListEl.querySelector('[data-book-chapters="' + bookId + '"]')?.classList.add("expanded");
            expandedBook = bookId;
          } else {
            expandedBook = null;
          }
        });
      });

      bookListEl.querySelectorAll(".chapter-btn").forEach(el => {
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          const bookName = el.dataset.bookName;
          const chapter = el.dataset.chapter;
          closeMenu();
          loadReference(bookName + " " + chapter);
        });
      });
    }

    // Event listeners
    closeMenuBtn.addEventListener("click", closeMenu);
    menuBackdrop.addEventListener("click", (e) => {
      if (e.target === menuBackdrop) closeMenu();
    });
    bookSearchEl.addEventListener("input", (e) => {
      renderBookList(e.target.value);
    });
    // ESC key closes menu
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && menuBackdrop.classList.contains("open")) {
        closeMenu();
      }
    });

    app.ontoolresult = (result) => {
      if (result.structuredContent) {
        currentData = result.structuredContent;
        currentTranslation = result.structuredContent.translation?.id || "web";
        initialReference = result.structuredContent.reference;
        render();
      }
    };

    app.onhostcontextchanged = (ctx) => {
      if (ctx.theme) {
        document.body.classList.toggle("light", ctx.theme === "light");
      }
    };

    await app.connect();

    const ctx = app.getHostContext();
    if (ctx?.theme) {
      document.body.classList.toggle("light", ctx.theme === "light");
    }
  </script>
</body>
</html>`;

// =============================================================================
// Types
// =============================================================================

// Environment bindings
interface Env {
  // Service binding for same-account Worker-to-Worker communication (optional)
  BIBLE_API?: Fetcher;
  // Public API URL for cross-account usage (fallback when no service binding)
  BIBLE_API_URL?: string;
}

// Default public API URL
const DEFAULT_BIBLE_API_URL = "https://bible-api.dws-cloud.com";

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

interface ApiError {
  error: string;
}

// =============================================================================
// API Client - Uses Service Binding (same account) or Public API (cross-account)
// =============================================================================
async function fetchApi<T>(path: string): Promise<T | ApiError> {
  const envBindings = env as unknown as Env;

  let response: Response;

  if (envBindings.BIBLE_API) {
    // Service binding: direct Worker-to-Worker communication (same Cloudflare account)
    // The URL host doesn't matter for service bindings - it's routed internally
    response = await envBindings.BIBLE_API.fetch(`https://internal/v1${path}`);
  } else {
    // Public API: standard HTTPS fetch (cross-account or local development)
    const baseUrl = envBindings.BIBLE_API_URL || DEFAULT_BIBLE_API_URL;
    response = await fetch(`${baseUrl}/v1${path}`);
  }

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
  `Retrieve verse text by reference. Returns formatted text with reference and translation.

Examples: "John 3:16", "Romans 8:28-39", "Psalm 23"

Supports comma-separated references with context inheritance:
- "Romans 14:14, 22-23" (inherits book and chapter)
- "Psalm 23, 24" (inherits book)
- "Genesis 1:1, 2:3" (inherits book, new chapter)
- "John 3:16, Romans 8:28" (independent references)`,
  {
    reference: z.string().describe("Bible reference (e.g., 'John 3:16', 'Psalm 23', 'Romans 8:28-39', 'Romans 14:14, 22-23')"),
    translation: z.preprocess(
      (val) => (typeof val === "string" ? val.toLowerCase() : val),
      z.enum(["web", "kjv"]).optional()
    ).describe("Translation: 'web' (World English Bible, default) or 'kjv' (King James Version)"),
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
// TOOL: Get Chapter
// =============================================================================
server.tool(
  "get_chapter",
  `Get full chapter text with verse numbers and prev/next navigation hints.

Examples: ("Genesis", 1), ("PSA", 23), ("ROM", 8)`,
  {
    book: z.string().describe("Book name, abbreviation, or ID (e.g., 'Genesis', 'Gen', 'GEN')"),
    chapter: z.number().describe("Chapter number"),
    translation: z.preprocess(
      (val) => (typeof val === "string" ? val.toLowerCase() : val),
      z.enum(["web", "kjv"]).optional()
    ).describe("Translation: 'web' (default) or 'kjv'"),
  },
  async ({ book, chapter, translation }) => {
    const params = new URLSearchParams();
    if (translation) params.set("translation", translation);

    const query = params.toString();
    const path = `/chapters/${encodeURIComponent(book)}/${chapter}${query ? `?${query}` : ""}`;
    const data = await fetchApi<ChapterResponse>(path);

    if (isError(data)) {
      return {
        content: [{ type: "text", text: `Error: ${data.error}` }],
        isError: true,
      };
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
  `Get a random verse for inspiration. Returns verse text with reference.

Filters: book="PSA" (Psalms only), testament="NT" (New Testament only)`,
  {
    translation: z.preprocess(
      (val) => (typeof val === "string" ? val.toLowerCase() : val),
      z.enum(["web", "kjv"]).optional()
    ).describe("Translation: 'web' (default) or 'kjv'"),
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
    },
  },
  ({ testament }): GetPromptResult => {
    const testamentText = testament === "OT" ? " from the Old Testament" :
                          testament === "NT" ? " from the New Testament" :
                          testament === "AP" ? " from the Apocrypha" : "";

    return {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Get me a random verse${testamentText} for today.

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
      translation: z.preprocess(
        (val) => (typeof val === "string" ? val.toLowerCase() : val),
        z.enum(["web", "kjv"]).optional()
      ).describe("Translation: 'web' (default) or 'kjv'"),
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
    },
  },
  ({ topic, testament }): GetPromptResult => {
    const testamentText = testament === "OT" ? " in the Old Testament" :
                          testament === "NT" ? " in the New Testament" :
                          testament === "AP" ? " in the Apocrypha" : "";

    return {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Search the Bible for verses about "${topic}"${testamentText}.

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
      translation: z.preprocess(
        (val) => (typeof val === "string" ? val.toLowerCase() : val),
        z.enum(["web", "kjv"]).optional()
      ).describe("Translation (default: web)"),
    },
    _meta: {
      ui: {
        resourceUri: BIBLE_READER_RESOURCE_URI,
        csp: {
          resourceDomains: ["https://unpkg.com"],
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
        return {
          content: [{ type: "text", text: `Error: ${data.error}` }],
          structuredContent: { error: data.error },
          isError: true,
        };
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
        structuredContent: {
          viewType: "chapter",
          reference: `${data.book.name} ${data.chapter}`,
          book: data.book,
          chapter: data.chapter,
          translation: data.translation,
          verses: data.verses,
          navigation: data.navigation,
        },
      };
    } else {
      // Verse reference - use verse API
      const path = `/verses/${encodeURIComponent(reference)}?${params.toString()}`;
      const data = await fetchApi<VerseResponse>(path);

      if (isError(data)) {
        return {
          content: [{ type: "text", text: `Error: ${data.error}` }],
          structuredContent: { error: data.error },
          isError: true,
        };
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
        structuredContent: {
          viewType: "verses",
          reference: data.reference,
          translation: data.translation,
          verses: data.verses.map(v => ({ verse: v.verse, text: v.text })),
          chapterContext,
        },
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
              resourceDomains: ["https://unpkg.com"],
            },
          },
        },
      },
    ],
  })
);

// =============================================================================
// Export Handler
// =============================================================================
const mcpHandler = createMcpHandler(server);

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
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
