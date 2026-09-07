# schema-epoch-preserves-durable-queue

Focus: Version Compatibility (local framework epoch / cache vs durable queue).

## Why this property

Client SQLite mixes **cache** tables (safe to drop on hard-cutoff schema change) with one **durable** upload queue. `SCHEMA_EPOCH` is currently **12** (`pkgs/sync-engine/src/queries/client/local-schema.ts`). Bumping the epoch on next `createLocalSyncEngine` is claimed to:

1. `DROP` framework cache + host `cacheTableNames` (domain rows treated as cache),
2. drop `RETIRED_LOCAL_TABLES`,
3. recreate current framework + domain schema,
4. **leave `sync_engine_mutations` rows in place** so offline work still uploads.

`PRAGMA user_version = epoch * 1000 + MIGRATIONS.length` (`getLocalSchemaTargetVersion`). Playground snapshots refuse restore after an epoch bump.

This is the install-upgrade story for framework-local shape changes — orthogonal to wire `x-sync-protocol` and to domain `defineTable` catch-up. A botched epoch wipe that includes the durable table deletes unacked mutations; a wipe that also drops domain cache without preserve-and-drain leaves the user looking “empty” until upload+refetch (expected for domain cache, fatal for the queue).

Pins: `epoch-bump-wipes-cache-preserves-pending-uploads.sim.test.ts`, `epoch-bump-mid-offline-session-then-drain.sim.test.ts`, `crash-during-epoch-migrate-recovers.sim.test.ts`, `cache-clear-preserves-pending-mutations.sim.test.ts`. No Antithesis SDK; suggested assertions **missing**.

README still says `SCHEMA_EPOCH` is **7** in one “Schema & versioning” paragraph and **12** later — trust the constant.

## Code paths

| Path | Role |
|---|---|
| `pkgs/sync-engine/src/queries/client/local-schema.ts` L10–29 | `SCHEMA_EPOCH = 12`; retired table list |
| `pkgs/sync-engine/src/shared/framework-server-ddl.ts` L41–49 | `FRAMEWORK_DURABLE_TABLE_NAMES = [sync_engine_mutations]`; cache = scope_meta, write_rejections, push_applied |
| `pkgs/sync-engine/src/client/local-schema-migrate.ts` L26–36, L67–72, L175–231 | Epoch math; `allCacheTableNames` excludes durable names; `previousEpoch < epoch` → `dropCacheTables` then `createCurrentSchema`; interrupted bump (cache missing, version already at target) heals in place |
| `pkgs/sync-engine/src/client/create-local-sync-engine.ts` L430–437 | Migrate runs before the engine is returned |
| `pkgs/sync-engine/src/client/create-local-sync-engine.ts` L363–381 | `clearLocalData({ reason: 'cache' })` is the same cache-only drop (not epoch) |
| `pkgs/sync-engine/src/tests/apps/acme/schema-variants.ts` L61–62 | DST `epochBump` restart: `preserveLocalDb: true`, `schemaEpoch: SCHEMA_EPOCH + 1` |

## Failure scenario

User queues mutations offline (or upload in flight). An app update bumps `SCHEMA_EPOCH` (12 → 13). Next open must wipe cache / rebuild domain tables and still have the same mutation ids in `sync_engine_mutations`. After reconnect they drain and peers converge.

Crash window (pinned in sim via `onLocalMigratePhase` / `onNextEngineOpenAfterCacheWipe`): cache already dropped, `user_version` not yet advanced. The heal branch (`previousEpoch >= epoch && previous >= targetVersion && !cacheTablesExist`) must recreate schema **without** dropping durable rows. A second kill during `createCurrentSchema` is the Antithesis expansion the sim only hits once.

`journal_mode=MEMORY` + wipe-on-corrupt (sut-analysis A11) is a **competing** way to lose the queue that is not this property — if the file is deleted, epoch policy never runs.

## Key observations

- Domain tables are in the host `cacheTableNames` list and **are dropped** on epoch bump. Pending mutations are expected to re-create those rows on upload replay + snapshot. The pin checks notes come back after drain, not that domain rows survive the wipe.
- Durable set is a single table name. Adding a second durable table without updating `FRAMEWORK_DURABLE_TABLE_NAMES` would silently wipe it.
- `user_version` stride 1000: in-epoch additive migrations increment the low part without cache wipe (`runPendingMigrations`). Only a **floor(version/1000)** increase wipes cache.
- Mid-offline epoch bump: sim restart always boots online; the pin still queues before restart. Antithesis should keep the origin partitioned across the bump so drain is truly post-heal.
- `clearLocalData('cache')` is the same drop/recreate without changing epoch — useful as a control, but revoke (`deleteDatabase`) is the full-file wipe and must not be confused with epoch.

## Instrumentation (all missing)

- `Always` immediately after `dropCacheTables` / `afterCacheWipe`: `SELECT count(*) FROM sync_engine_mutations` equals the pre-wipe count; mutation ids unchanged.
- `Always` after `PRAGMA user_version` is written: durable count still matches; cache tables exist again.
- `Sometimes(cond)`: an epoch bump occurred (`previousEpoch < epoch`) and those preserved ids later received `applied` on the server.
- `Reachable`: heal path where cache tables were missing but `user_version` already at target (interrupted bump).
- `Unreachable`: `DROP TABLE sync_engine_mutations` during epoch migrate.

## Open questions

- On native web SQLite, does a crash mid-`DROP`/`CREATE` make the next open hit file-delete recovery instead of interrupted-epoch heal? `(partial: MEMORY journal means no WAL; native deletes on any open failure; heal only if open succeeds)`
- Can an old binary still upload into a file the new binary is epoch-migrating? `(partial: one process serializes via the pool; no cross-process file lock; first topology is one process per client volume)`

### Investigation Log

#### What survives SCHEMA_EPOCH 12 → 13?

- Examined: `FRAMEWORK_DURABLE_TABLE_NAMES`, `allCacheTableNames` filter, `migrateLocalSchema` epoch branch, epoch sim pins, `cache-clear-preserves-pending-mutations`.
- Found: only `sync_engine_mutations` is durable. Scope meta, push_applied, local rejections, and host domain cache tables are dropped. Pins require pending note ids to exist after restart and to converge once online.
- Not found: durable preservation of optimistic peer rows or checkpoints (those are cache; refetch is required).
- Conclusion: invariant is queue-id preservation + eventual drain, not domain-row preservation across the wipe.

#### Is SCHEMA_EPOCH 12 or 7?

- Examined: `local-schema.ts` L11; README L402 vs L718.
- Found: code constant is 12. README “currently **7**” is stale.
- Conclusion: property text uses 12. Workload should bump `schemaEpoch` relative to the constant, not a hardcoded 7.

#### Do product cacheTableNames include sync_engine_mutations?

- Examined: `libs/runtime/src/root/app-schema.ts` `LOCAL_DOMAIN_TABLE_NAMES` = sorted `Object.keys(appSchema.snapshot().tables)`; `apps/client` passes that list as `cacheTableNames`.
- Found: those keys are domain tables only (`auth_*`, profile, spaces, friends, chess, client_config, notifications). Framework tables are not in `appSchema`.
- Conclusion: resolved — product host list cannot drop the durable queue; only `FRAMEWORK_CACHE_TABLE_NAMES` / a future durable-set miss could.

#### On native web SQLite, does a crash mid-DROP/CREATE leave WAL such that the next open deletes the entire DB?

- Examined: `connection-pragmas.ts` MEMORY journal; `local-schema-migrate.ts` `dropCacheTables` / heal (`previousEpoch >= epoch && cache missing`); `web-sqlite-impl.ts` any-first-open-failure delete; `isSqlOwnerWipeWorthyError` (`migrateLocalSchema failed`, `schema epoch`); `ensureFrameworkSchema` (`applySqliteSchema` declared-only — no `DROP` of durable).
- Found: MEMORY journal implies there is typically **no WAL** to tear. Crash mid-`DROP` can still corrupt the main file (no durable rollback). Native web: if `openDatabaseAsync` fails, the **whole file** is deleted (A11 / `memory-journal-crash-wipes-queue` dominates — epoch policy never runs). If open succeeds with cache tables gone and `user_version` already at target, the heal branch recreates schema without dropping `sync_engine_mutations`. Web migrate failures are wipe-worthy after a successful open.
- Not found: a pin that kills mid-`DROP` on real web SQLite native and observes open-fail vs heal; an in-tree WAL mode that would change the artifact.
- Conclusion: tagged `(partial: MEMORY journal means no WAL; native deletes on any open failure; heal only if open succeeds)`. Property stays “when epoch migrate/heal runs, the queue survives.” Process-kill-during-migrate that fails open is the other property.

#### Can an old binary still upload into a file the new binary is epoch-migrating?

- Examined: `sync-engine-pool.ts` `opChain` / `deactivatePrevious`; `migrateLocalSchema` (no file lock); web OPFS single-session; first topology (one Node process per client container).
- Found: one process never overlaps two engines on two epochs for the same name. Web cannot have two writers on one OPFS file. Two OS processes sharing one SQLite file have no in-tree advisory lock; product upgrade replaces the process rather than running two binaries on one file.
- Not found: a cross-process migrate mutex; a product path that keeps an old binary uploading while a new binary migrates the same path.
- Conclusion: tagged `(partial: one process serializes via the pool; no cross-process file lock; first topology is one process per client volume)`. Shared-volume two-binaries is an Antithesis setup choice, not a shipping path. Do not treat it as required for the epoch invariant.

## Synthesis merge (orchestrator)

Also covers: `schema-epoch-wipe-preserves-mutation-queue`. `SCHEMA_EPOCH = 12`. Distinct from `memory-journal-crash-wipes-queue` (corrupt-open deletes the whole file, queue included).
