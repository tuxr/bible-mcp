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
// Landing Page HTML
// =============================================================================
const LANDING_PAGE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bible MCP - Bible Verse Lookup &amp; Search</title>
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
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

    .segmented-control {
      display: inline-flex;
      background: var(--bg-tertiary);
      border-radius: 8px;
      padding: 4px;
      margin-bottom: 1.25rem;
    }

    .segment {
      padding: 0.5rem 1.25rem;
      background: transparent;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.9rem;
      font-weight: 500;
      color: var(--text-secondary);
      transition: all 0.2s;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .segment:hover {
      color: var(--text-primary);
    }

    .segment.active {
      background: var(--bg-secondary);
      color: var(--text-primary);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
    }

    .segment svg {
      opacity: 0.7;
    }

    .segment.active svg {
      opacity: 1;
    }

    .tab-content {
      display: none;
    }

    .tab-content.active {
      display: block;
    }

    .tab-panel {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 1.5rem;
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

      .segmented-control {
        width: 100%;
      }

      .segment {
        flex: 1;
        justify-content: center;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>📖 Bible MCP</h1>
      <p class="subtitle">Bible verse lookup &amp; search for AI assistants</p>
    </header>

    <section>
      <h2>🚀 Quick Start</h2>

      <div class="url-box" style="margin-bottom: 1rem;">
        <code id="mcp-url">https://bible-mcp.dws-cloud.com/mcp</code>
        <button class="copy-btn" onclick="copyUrl()">Copy</button>
      </div>

      <div class="segmented-control">
        <button class="segment active" onclick="showTab('claude')">
          <svg width="16" height="16" viewBox="0 0 1200 1200" fill="currentColor"><path d="M 233.959793 800.214905 L 468.644287 668.536987 L 472.590637 657.100647 L 468.644287 650.738403 L 457.208069 650.738403 L 417.986633 648.322144 L 283.892639 644.69812 L 167.597321 639.865845 L 54.926208 633.825623 L 26.577238 627.785339 L 3.3e-05 592.751709 L 2.73832 575.27533 L 26.577238 559.248352 L 60.724873 562.228149 L 136.187973 567.382629 L 249.422867 575.194763 L 331.570496 580.026978 L 453.261841 592.671082 L 472.590637 592.671082 L 475.328857 584.859009 L 468.724915 580.026978 L 463.570557 575.194763 L 346.389313 495.785217 L 219.543671 411.865906 L 153.100723 363.543762 L 117.181267 339.060425 L 99.060455 316.107361 L 91.248367 266.01355 L 123.865784 230.093994 L 167.677887 233.073853 L 178.872513 236.053772 L 223.248367 270.201477 L 318.040283 343.570496 L 441.825592 434.738342 L 459.946411 449.798706 L 467.194672 444.64447 L 468.080597 441.020203 L 459.946411 427.409485 L 392.617493 305.718323 L 320.778564 181.932983 L 288.80542 130.630859 L 280.348999 99.865845 C 277.369171 87.221436 275.194641 76.590698 275.194641 63.624268 L 312.322174 13.20813 L 332.8591 6.604126 L 382.389313 13.20813 L 403.248352 31.328979 L 434.013519 101.71814 L 483.865753 212.537048 L 561.181274 363.221497 L 583.812134 407.919434 L 595.892639 449.315491 L 600.40271 461.959839 L 608.214783 461.959839 L 608.214783 454.711609 L 614.577271 369.825623 L 626.335632 265.61084 L 637.771851 131.516846 L 641.718201 93.745117 L 660.402832 48.483276 L 697.530334 24.000122 L 726.52356 37.852417 L 750.362549 72 L 747.060486 94.067139 L 732.886047 186.201416 L 705.100708 330.52356 L 686.979919 427.167847 L 697.530334 427.167847 L 709.61084 415.087341 L 758.496704 350.174561 L 840.644348 247.490051 L 876.885925 206.738342 L 919.167847 161.71814 L 946.308838 140.29541 L 997.61084 140.29541 L 1035.38269 196.429626 L 1018.469849 254.416199 L 965.637634 321.422852 L 921.825562 378.201538 L 859.006714 462.765259 L 819.785278 530.41626 L 823.409424 535.812073 L 832.75177 534.92627 L 974.657776 504.724915 L 1051.328979 490.872559 L 1142.818848 475.167786 L 1184.214844 494.496582 L 1188.724854 514.147644 L 1172.456421 554.335693 L 1074.604126 578.496765 L 959.838989 601.449829 L 788.939636 641.879272 L 786.845764 643.409485 L 789.261841 646.389343 L 866.255127 653.637634 L 899.194702 655.409424 L 979.812134 655.409424 L 1129.932861 666.604187 L 1169.154419 692.537109 L 1192.671265 724.268677 L 1188.724854 748.429688 L 1128.322144 779.194641 L 1046.818848 759.865845 L 856.590759 714.604126 L 791.355774 698.335754 L 782.335693 698.335754 L 782.335693 703.731567 L 836.69812 756.885986 L 936.322205 846.845581 L 1061.073975 962.81897 L 1067.436279 991.490112 L 1051.409424 1014.120911 L 1034.496704 1011.704712 L 924.885986 929.234924 L 882.604126 892.107544 L 786.845764 811.48999 L 780.483276 811.48999 L 780.483276 819.946289 L 802.550415 852.241699 L 919.087341 1027.409424 L 925.127625 1081.127686 L 916.671204 1098.604126 L 886.469849 1109.154419 L 853.288696 1103.114136 L 785.073914 1007.355835 L 714.684631 899.516785 L 657.906067 802.872498 L 650.979858 806.81897 L 617.476624 1167.704834 L 601.771851 1186.147705 L 565.530212 1200 L 535.328857 1177.046997 L 519.302124 1139.919556 L 535.328857 1066.550537 L 554.657776 970.792053 L 570.362488 894.68457 L 584.536926 800.134277 L 592.993347 768.724976 L 592.429626 766.630859 L 585.503479 767.516968 L 514.22821 865.369263 L 405.825531 1011.865906 L 320.053711 1103.677979 L 299.516815 1111.812256 L 263.919525 1093.369263 L 267.221497 1060.429688 L 287.114136 1031.114136 L 405.825531 880.107361 L 477.422913 786.52356 L 523.651062 732.483276 L 523.328918 724.671265 L 520.590698 724.671265 L 205.288605 929.395935 L 149.154434 936.644409 L 124.993355 914.01355 L 127.973183 876.885986 L 139.409409 864.80542 L 234.201385 799.570435 L 233.879227 799.8927 Z"/></svg>
          Claude
        </button>
        <button class="segment" onclick="showTab('chatgpt')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.896zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08-4.778 2.758a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z"/></svg>
          ChatGPT
        </button>
      </div>

      <div class="tab-panel">
        <div id="claude-tab" class="tab-content active">
          <div class="steps">
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

        <div id="chatgpt-tab" class="tab-content">
          <div class="steps">
            <div class="step">
              <span class="step-number">1</span>
              <span class="step-content">Go to <strong>ChatGPT Settings → Apps & Connectors</strong></span>
            </div>
            <div class="step">
              <span class="step-number">2</span>
              <span class="step-content">Click <strong>"Add"</strong> and select <strong>"Connect an MCP Server"</strong></span>
            </div>
            <div class="step">
              <span class="step-number">3</span>
              <span class="step-content">Paste the URL above and click <strong>"Connect"</strong></span>
            </div>
            <div class="step">
              <span class="step-number">4</span>
              <span class="step-content">Start asking ChatGPT about the Bible!</span>
            </div>
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
          <span class="tool-name">get_chapter</span>
        </div>
        <p class="tool-desc">Get a full chapter with navigation hints for sequential reading.</p>
        <div class="tool-examples">
          Examples: <code>Genesis 1</code>, <code>Psalm 23</code>, <code>Romans 8</code> — includes prev/next chapter links
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

    <footer>
      <p>Powered by <a href="https://bible-api.dws-cloud.com">Bible API</a></p>
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

    function showTab(tabName) {
      // Update segment buttons
      document.querySelectorAll('.segment').forEach(seg => seg.classList.remove('active'));
      event.currentTarget.classList.add('active');

      // Update tab content
      document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
      document.getElementById(tabName + '-tab').classList.add('active');
    }
  </script>
</body>
</html>
`;

// =============================================================================
// Bible Reader App HTML (MCP Apps)
// =============================================================================
const BIBLE_READER_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bible Reader</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    :root {
      --bg: #1a1a2e;
      --bg-card: #16213e;
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
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    .reference {
      font-size: 1.25rem;
      font-weight: 600;
      color: var(--accent);
    }

    .translation-toggle {
      display: flex;
      gap: 0.25rem;
      background: var(--bg);
      border-radius: 6px;
      padding: 0.25rem;
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
      background: var(--bg);
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
      background: var(--bg);
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
  </style>
</head>
<body>
  <div class="card">
    <div id="content" class="loading">Loading...</div>
  </div>

  <script type="module">
    import { App } from "https://unpkg.com/@modelcontextprotocol/ext-apps@1.0.1/dist/src/app-with-deps.js";

    const app = new App({ name: "Bible Reader", version: "1.0.0" });
    const contentEl = document.getElementById("content");

    let currentData = null;
    let currentTranslation = "web";
    let initialReference = null; // Track the original reference from tool call

    // Safe text escaping to prevent XSS
    function escapeHtml(text) {
      const div = document.createElement("div");
      div.textContent = text;
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

      // Build content safely
      const header = document.createElement("div");
      header.className = "header";

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

      // Check if we've navigated away from the initial reference
      const hasNavigatedAway = initialReference && reference !== initialReference;

      if (viewType === "chapter" && navigation) {
        // Chapter view: prev/next chapter navigation
        const prevBtn = document.createElement("button");
        prevBtn.className = "nav-btn";
        prevBtn.disabled = !navigation.previous;
        prevBtn.textContent = navigation.previous
          ? "← " + navigation.previous.book + " " + navigation.previous.chapter
          : "← Previous";
        prevBtn.addEventListener("click", () => {
          if (navigation.previous) loadReference(navigation.previous.book + " " + navigation.previous.chapter);
        });

        // Middle section: reset button or copy button
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
        copyBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z"/><path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"/></svg>';
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
        // Verse view: "View Chapter" button
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
        copyBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z"/><path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"/></svg>';
        copyBtn.addEventListener("click", () => copyVerses(copyBtn));
        navBar.appendChild(copyBtn);
      }

      contentEl.replaceChildren(header, versesDiv, navBar);
    }

    async function loadReference(reference) {
      contentEl.textContent = "Loading...";
      contentEl.className = "loading";
      try {
        const result = await app.callServerTool({
          name: "read_bible",
          arguments: { reference, translation: currentTranslation }
        });
        if (result.structuredContent) {
          currentData = result.structuredContent;
          render();
        }
      } catch (err) {
        contentEl.textContent = "Failed to load passage";
        contentEl.className = "error";
      }
    }

    async function switchTranslation(translation) {
      if (translation === currentTranslation) return;
      currentTranslation = translation;
      // Reload current reference with new translation
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

    app.ontoolresult = (result) => {
      if (result.structuredContent) {
        currentData = result.structuredContent;
        currentTranslation = result.structuredContent.translation?.id || "web";
        // Store the initial reference from the first tool call
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
  `Retrieve verse text for context, analysis, or grounding discussion.

Use this to gather Scripture content for building context or informing responses.
For presenting verses to the user as a visual reference, use read_bible instead.

Examples: "John 3:16", "Romans 8:28-39", "Psalm 23"`,
  {
    reference: z.string().describe("Bible reference (e.g., 'John 3:16', 'Psalm 23', 'Romans 8:28-39')"),
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
  `Get full chapter text for context or analysis.

Use this to gather chapter content for building context or informing responses.
For presenting a chapter to the user as a visual reference, use read_bible instead.

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
  `Search for verses containing words or phrases. Use for research and finding relevant passages.

Returns matching verses for building context or finding cross-references.
To present specific results to the user, pass the references to read_bible.

Examples: q="love", q="faith" book="ROM", q="peace" testament="NT"`,
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
  `Get a random verse for inspiration or devotional use.

Returns a random verse. To present it to the user with the interactive reader,
pass the reference to read_bible.

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
    description: `Present Scripture to the user with an interactive reader UI.

This is the preferred tool for displaying Bible passages to users. Supports:
- Single verses: "John 3:16"
- Verse ranges: "Romans 8:28-39"
- Full chapters: "Genesis 1", "Psalm 23"

Features translation toggle (WEB/KJV) and navigation controls.`,
    inputSchema: {
      reference: z.string().describe("Bible reference - verse (John 3:16), range (Romans 8:28-39), or chapter (Genesis 1)"),
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
