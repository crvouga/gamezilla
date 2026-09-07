# Phase 1 — web SQLite verification

**Date:** 2026-08-06  
**Outcome:** Proceed with web SQLite (OPFS) for Phase 2.

## Evidence already in repo

- Dev/prod isolation headers: `apps/client/scripts/sqlite-web-headers.js`
  (`Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Embedder-Policy: require-corp`)
- Opener: `apps/client/src/storage/open-main-sql-client.ts` → `createWebSqlClient`
- Session lock: `@pkgs/sql-client-sqlite/web-session-lock`
- Phase 0 `web-driver-parity` test: file-backed SQLite merge/mutate via `SqlClient` surface

## Blocking criteria (plan)

| Check                           | Status                                            |
| ------------------------------- | ------------------------------------------------- |
| Open + connect on web SqlClient | Supported by `createWebSqlClient`                     |
| Migrations / framework DDL      | Same SQL as Bun harness (`ensureFrameworkSchema`) |
| Merge load                      | Phase 0 scenarios + file-backed parity green      |
| COOP/COEP headers               | Present for web SQLite setup                        |

No alternate web `SqlClient` substitute selected — web SQLite remains the sole driver.
