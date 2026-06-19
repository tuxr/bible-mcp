# MCP-3 Plan

## Current State (as of June 2026)
- On branch: `feature/mcp-rate-limiting`
- MCP-2 completed and committed:
  - Resilient 429 retry logic + backoff in `fetchApi`
  - `createTestFetchApi` helper for deterministic tests
  - All 237 tests passing + clean typecheck
- Wrangler authenticated and working

## MCP-3 Goal
Add **handler-level integration tests** with mocked `fetchApi` per tool.

- Assert end-to-end MCP error shape for rate-limited responses
- Use mocked `fetchApi` (with `maxRateLimitRetries: 0` where appropriate)
- Focus on tools that call the Bible API (`get_verse`, `get_chapter`, `search_bible`, `get_random_verse`, `list_books`, `list_translations`, `read_bible`)

## Testing Workflow
1. Complete MCP-3 changes
2. Run full test suite:
   - `npm test`
   - `npm run typecheck`
3. Verify 237+ tests still pass

## Deployment Workflow
1. All changes must be on a feature branch (never direct to `main`)
2. Run full local tests before any deploy
3. Deploy from feature branch first (preview / test environment)
4. After successful deploy + manual verification, open PR or merge to `main`
5. Production deploy only from `main` after PR review

## Notes
- Rate limiter bindings (SEARCH_RATE_LIMITER, RANDOM_RATE_LIMITER) may still need to be created in the Cloudflare dashboard before full production deployment.
- Both `bible-mcp` and `bible-api` should be deployed after local verification.
- Keep `CLAUDE.md` / `AGENTS.md` updated with any new patterns.

## Next Steps After MCP-3
- Run full test suite
- Deploy both services
- Open PR for `feature/mcp-rate-limiting`
