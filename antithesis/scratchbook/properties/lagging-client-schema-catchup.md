# lagging-client-schema-catchup

Focus: Version Compatibility (db-schema expand/contract; lagging client catch-up).

## Why this property

`@pkgs/db-schema` claims a compatible catalog chain is catch-up-safe: a peer whose declared schema is behind the server can apply additive/expand operations and end aligned, without DROP/ALTER TYPE/RENAME. The DST invariant is explicit:

```26:45:pkgs/db-schema/src/tests/system/invariants.ts
/** Lagging clients stay valid: they must be able to catch up to the server. */
export async function assertClientAlignedWithServer(...)
```

If `client.version < server.version`, settle calls `advancePeer` through each intermediate catalog. A scripted pin (`schema-world.system.pbt.test.ts` “server ahead of lagging client stays valid”) advances server to v2, client-0 only to v1, then settle brings client-0 to v2.

This is **planner/reconcile** catch-up, not sync-engine merge. A lagging *binary* that never ships the new `defineTable` stays on mixed-schema merge (`mixed-schema-column-intersect-merge`). Catch-up starts when that binary is replaced and `SqliteSchemaDatabaseMigration` / Postgres reconcile runs against the new declared catalog.

Historical planner bugs that made “catch-up” data-losing (`pkgs/db-schema/src/tests/bugs-found.md` BUG-1..5: indexes lost after rebuild, backfill omitted, `copyColumns: []`, in-place type change, `_meta` ident) are marked fixed with pins. Antithesis is for the same planner under concurrent traffic, crash mid-rebuild, and real SQLite/Postgres — the class PBT did not run against live engines.

No Antithesis SDK. Suggested assertions **missing**.

## Code paths

| Path | Role |
|---|---|
| `pkgs/db-schema/README.md` L9–22 | Safety model: forbidden → throw, zero DDL; Postgres refuses DROP/ALTER TYPE/RENAME; extra columns need deprecation tombstone |
| `pkgs/db-schema/src/core/compatibility.ts` | `DeltaKind`: `additive` / `expand` / `contract_client` / `forbidden` |
| `pkgs/db-schema/src/tests/system/schemas.ts` | Compatible chain v0–v4: add col, `renamedFrom`+deprecation, backfill, add `score` |
| `pkgs/db-schema/src/tests/system/peers.ts` L40–66 | `reconcilePeer` (postgres vs sqlite); `advancePeer` only forward |
| `pkgs/db-schema/src/tests/system/dispatch.ts` L27–41 | `applyAdvance`: client target is **capped at `server.version`** — schema world forbids client-ahead DDL |
| `pkgs/db-schema/src/tests/system/invariants.ts` L26–45 | Lagging client must catch up; live column lists must match after catch-up |
| `pkgs/db-schema/src/tests/system/system.ts` L47–56 | Settle: `assertServerLiveColumns` then `assertClientAlignedWithServer` per client |
| `pkgs/sync-engine/src/client/create-local-sync-engine.ts` L430–437 | Product catch-up hook: `migrateLocalSchema` (domain `SqliteSchemaDatabaseMigration`) runs **once at engine open** |
| `pkgs/sync-engine/src/client/local-schema-migrate.ts` L87–100, L206–211 | `ensureDomainTables` on every open when epoch already current |

## Failure scenario

Server (or a new client binary) has declared schema vN+k. An existing SQLite file is still physically at vN (missing columns / old names). On next engine open, migrate must ADD/copy/backfill without dropping rows, indexes, or inventing a forbidden in-place type change.

DST settle *forces* catch-up in-process with mem engines. Antithesis should: persist a real SQLite file at vN, deploy a vN+k binary, kill during rebuild (`rename old → create → copy → drop`), and continue sync traffic from a second tab/process if the file can be shared. On Postgres, a lagging migrate under live `/mutations` is the server-side dual (sut-analysis already ranks schema/index crash-safety secondary but pinned).

## Key observations

- **Client-ahead is out of scope for this property.** Schema-world `applyAdvance` caps clients at the server version. Client-ahead live sync is `mixed-schema-column-intersect-merge` / `client-ahead-column-mutation-no-wipe`.
- Catch-up in production is **binary-driven**: the new declared `appSchema` is compiled in. The server does not push DDL to old clients. A never-upgraded client never hits this invariant; it must keep working via column-intersect.
- `advancePeer` refuses `to < peer.version` — versions only increase. A rollback of declared schema against a newer physical catalog is a different (likely forbidden extras) path.
- Postgres extra columns without `deprecations` fail reconcile. SQLite `declared-only` ownership leaves undeclared tables alone (so `sync_engine_*` survives domain migrate).
- Five fixed planner bugs are the regression surface: rebuild without indexes, rebuild without backfill, empty `copyColumns`, type-change rebuild, underscore idents.

## Instrumentation (all missing)

- `Always` after a successful catch-up migrate: every `liveColumns(serverVersion)` exists on the client catalog; row count for domain tables did not drop vs pre-migrate snapshot (except intentional deprecation rebuilds that copy).
- `Unreachable`: planner emits DROP TABLE/COLUMN, ALTER TYPE, or RENAME on Postgres; or SQLite rebuild with empty copy list.
- `Sometimes(cond)`: a client file whose `user_version` / introspected cols were strictly behind the new binary’s catalog completed migrate and then uploaded pending mutations.
- `Reachable`: forbidden in-place type change refused with zero plan mutation (already a DST `forbidden` action).

## Open questions

- Under product open, can `migrateLocalSchema` (domain ensure) interleave with another isolate writing the same SQLite (web SharedWorker / multi-tab) or is the file exclusively locked for the migrate window? If exclusive, crash-mid-rebuild is the Antithesis fault; if not, concurrent INSERT during rebuild is in scope.
- Does product Postgres migrate ever run concurrently with Worker request traffic in the intended Antithesis topology, or only at container start? Concurrent migrate-vs-replay is a different (heavier) property.

### Investigation Log

#### Is “lagging client catch-up” automatic at runtime, or only when the client binary advances?

- Examined: `assertClientAlignedWithServer`, `applyAdvance`, `createLocalSyncEngine` migrate-on-open, db-schema README lifecycle recipes.
- Found: DST settle actively `advancePeer`s the client to the server version. Production SQLite only applies the schema **bundled in that process**. An old binary does not pull server DDL.
- Not found: a wire message that ships catalog deltas to clients.
- Conclusion: phrase the invariant as “after a lagging client **opens with** the server’s compatible declared schema, reconcile succeeds and live columns match.” Do not claim old binaries self-migrate.

#### Can a schema-world client go ahead of the server?

- Examined: `dispatch.ts` `applyAdvance` cap `Math.min(wanted, server.version)` for `peer.kind === 'client'`.
- Found: client-ahead is structurally excluded from this DST.
- Conclusion: do not test client-ahead DDL under this property.
