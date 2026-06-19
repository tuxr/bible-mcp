# Deploy & Migration Runbook

Operational guide for shipping changes to the Bible MCP server and coordinating
the cross-repo dependency on the Bible API.

## Live targets

| What | URL |
|------|-----|
| MCP endpoint (prod) | `https://bible-mcp.dws-cloud.com/mcp` |
| Server info (JSON)  | `https://bible-mcp.dws-cloud.com` |
| Backup endpoint     | `https://bible-mcp.dws-cloud.workers.dev/mcp` |
| Docs                | `https://tuxr.github.io/bible-mcp` |
| Bible API           | `https://bible-api.dws-cloud.com` |

## Architecture & the cross-repo dependency

```
MCP Client → bible-mcp (this repo) ──[service binding]──► bible-api → D1 database
```

- `bible-mcp` and `bible-api` are **separate Workers in the same Cloudflare
  account**, wired by a **service binding** (`[[services]] binding = "BIBLE_API"`
  in `wrangler.toml`). There is no env var to flip between them in prod.
- The MCP server is **fully dynamic**: `list_translations`, the `read_bible`
  translation toggle, and RTL detection all derive from whatever the API
  returns. **Adding a translation is a bible-api/D1 task, not a code change here.**
- Deploys are **manual** (`npm run deploy` → `wrangler deploy`). There is **no
  CI/CD workflow**; deploys run from a machine with Cloudflare credentials.

### RTL/language contract (important)

The reader renders right-to-left when the API response indicates Hebrew. Detection
order (see `src/translation-utils.ts`):

1. Server-provided `direction: "rtl" | "ltr"` in structured content (authoritative).
2. Fallback: `language` is `he` / `heb` / `he-*`, **or** translation `id === "wlc"`.

**Therefore the bible-api migration should set `language: "he"` on Hebrew
translations.** The `id === "wlc"` check is only a defensive fallback for that one
ID; any *future* Hebrew translation will render LTR unless its `language` field is
populated.

## Adding a translation (e.g. WLC Hebrew) — go-live order

The gate is the **bible-api D1 migration**, not this repo. Deploying `bible-mcp`
before the API has the data is a **safe no-op** (the translation simply doesn't
appear); it cannot break existing WEB/KJV behavior.

### 1. bible-api first (owned in `tuxr/bible-api`)
- Run the D1 migration to load the translation text + metadata, including
  `language: "he"` for Hebrew.
- Deploy the `bible-api` worker.
- Verify the API directly:
  - `GET /v1/translations` lists the new id (e.g. `wlc`) with `language: "he"`.
  - `GET /v1/verses/Genesis%201:1?translation=wlc` returns Hebrew text.

### 2. bible-mcp second (this repo)
- Pre-flight: `npm test` (all green) and `npm run typecheck` (clean).
- Merge the PR to `main`.
- `npm run deploy`.
- Smoke-test prod (below).

## Pre-deploy checklist (this repo)

```bash
npm test           # full unit + integration suite, must be green
npm run typecheck  # tsc on prod + test configs, must be clean
```

- Confirm `@modelcontextprotocol/sdk` version still matches the version bundled
  in `agents` (currently 1.26.0) — see "Version Constraints" in CLAUDE.md.

## Deploy

```bash
npm run deploy     # wrangler deploy → bible-mcp.dws-cloud.com + workers.dev backup
```

## Prod smoke tests (post-deploy)

Run against the live MCP endpoint (or via a connected client):

- `list_translations` → new translation appears (e.g. WLC) with `Language: he`.
- `read_bible "Genesis 1:1" wlc` → renders **right-to-left Hebrew**; the
  translation toggle lists WLC.
- Regression: `get_verse "John 3:16"` (WEB) and `... kjv` still return English,
  left-to-right. WEB/KJV must be unaffected.

## Rollback

- No database changes are made by `bible-mcp` deploys, so rollback is code-only:
  redeploy the previous commit (`git checkout <prev> && npm run deploy`), or roll
  back the worker version in the Cloudflare dashboard
  (Workers & Pages → bible-mcp → Deployments).
- A bad bible-api migration is rolled back on the **bible-api** side; `bible-mcp`
  needs no change because it's dynamic.

## Observability

- Cloudflare dashboard → Workers & Pages → **bible-mcp** → Logs / Metrics
  (`[observability] enabled = true` in `wrangler.toml`).
