export const BIBLE_READER_HTML = `<!DOCTYPE html>
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
