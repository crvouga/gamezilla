# Phase 1 — expo-sqlite web verification

**Date:** 2026-08-06  
**Outcome:** Proceed with expo-sqlite web (OPFS) for Phase 2.

## Evidence already in repo

- Dev/prod isolation headers: `apps/client/scripts/expo-sqlite-web-headers.js`
  (`Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Embedder-Policy: require-corp`)
- Opener: `apps/client/src/storage/open-main-sql-client.ts` → `SqlClientImplExpoSqlite`
- Session lock: `@pkgs/sql-client/sqlite/expo-web-session-lock`
- Phase 0 `web-driver-parity` test: file-backed SQLite merge/mutate via `SqlClient` surface

## Blocking criteria (plan)

| Check                           | Status                                            |
| ------------------------------- | ------------------------------------------------- |
| Open + connect on web SqlClient | Supported by `SqlClientImplExpoSqlite.open`       |
| Migrations / framework DDL      | Same SQL as Bun harness (`ensureFrameworkSchema`) |
| Merge load                      | Phase 0 scenarios + file-backed parity green      |
| COOP/COEP headers               | Present for Expo web setup                        |

No alternate web `SqlClient` substitute selected — expo-sqlite remains the sole driver.
