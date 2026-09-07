# sqlite-version-probe-failure-is-not-postgres

Focus: Wildcard (dialect inversion). Confidence: medium.

Existing Antithesis SDK: **missing**. All suggested assertions are new.

Lifecycle / Data Integrity will look at migrate-under-traffic and schema rebuild pins. They will not treat “any exception from `SELECT sqlite_version()` ⇒ this is Postgres” as a **category error**: a busy, closed, or disk-full SQLite is classified as Postgres and then fed `CREATE OR REPLACE FUNCTION` DDL.

## Why this property

`isPostgresSqlClient` (`pkgs/postgres-sqlite-compat/src/install.ts`) is:

```ts
try {
  await sqlClient.query(sql`SELECT sqlite_version() AS v`);
  return false; // SQLite
} catch {
  return true;  // Postgres (or other)
}
```

`installPostgresSqliteCompat` runs the JSON1 shim DDL iff that function returns true. Comments say the probe avoids `pg_catalog` so it works under agnostic SQL bans. Matchmaking boot **always** calls install (“no-op on SQLite”) then migrate — callers never declare a dialect. Server `PostgresSqliteCompat` migration does the same on the API SQL client.

On a healthy Postgres engine, `sqlite_version()` throws (undefined function) → install runs → correct.

On a healthy SQLite engine, the probe succeeds → install skipped → correct.

On a **faulted SQLite** (SQLITE_BUSY, SQLITE_FULL, closed client, MEMORY-journal tear, statement abort), the probe throws → install attempts Postgres function bodies (`LANGUAGE sql` / `plpgsql`, `jsonb`, `$fn$`). Those statements fail or, worse, partially apply if a wrapper swallows errors. Matchmaking then migrates assuming a dialect that is not there.

The inverse is latent: if anyone later adds `sqlite_version()` to the compat shim (or a proxy implements it), the probe succeeds on Postgres → install skipped → JSON1 missing → shared SQL breaks. The current `SQLITE_JSON_INSTALL_STATEMENTS` list does **not** define `sqlite_version()`.

This is not “detect the engine.” It is “treat infra failure as engine kind.”

## Code paths

| File | Role |
|---|---|
| `pkgs/postgres-sqlite-compat/src/install.ts` `isPostgresSqlClient` / `installPostgresSqliteCompat` | Exception = Postgres. Then `unsafe` DDL loop. |
| `pkgs/postgres-sqlite-compat/src/json-functions-sql.ts` | `CREATE OR REPLACE FUNCTION` … `LANGUAGE sql` / `plpgsql`. No `sqlite_version` shim. |
| `pkgs/matchmaking/src/impl-sql/matchmaking.ts` | Boot: install then migrate on whatever `sqlClient` was injected. |
| `libs/runtime/src/server/postgres-sqlite-compat-migration.ts` | API migrate path. |
| `pkgs/sql-client/src/postgres/postgres-sqlite-compat.json.test.ts` | Goldens assume install is a no-op on Bun SQLite because the probe succeeds. |

Product web clients do **not** call install today (they are SQLite and speak JSON1 natively). The SUT surface is **API / matchmaking SQL** and any future shared installer pointed at a client DB.

## Failure scenario

1. Topology uses SQLite for matchmaking (sim/mem) or a test worker pointed at bun:sqlite.
2. Antithesis injects disk-full / busy / connection close during boot `installPostgresSqliteCompat`.
3. Probe throws → `isPostgresSqlClient === true` → first shim statement hits SQLite.
4. **Bug if** install returns success, or migrate proceeds, or subsequent `SELECT sqlite_version()` succeeds on the same client (it was SQLite all along) after PG DDL was attempted.
5. On Postgres: probe throw because Neon is paused is *correct* classification, but then install DDL also fails. **Bug if** install reports success without the functions existing (`json_extract` missing). That is the dual: exception during **install** must not be ignored.

engine bigint / dialect shims are already a known bit (SUT analysis). This property is the detect step, not the JSON1 semantics.

## Invariant (checkable)

After `installPostgresSqliteCompat` returns:

- If a follow-up `SELECT sqlite_version()` **succeeds**, no Postgres function shim from `SQLITE_JSON_INSTALL_STATEMENTS` may have been applied on that client (install must have no-op’d). A probe failure followed by a successful `sqlite_version()` on the same client is a **failed property** (misclassification).
- If follow-up `sqlite_version()` **fails** with undefined-function (Postgres), `json_extract('{"a":1}','$.a')` (or an equivalent shim probe) must succeed after install. Install must not return until that holds, or it must throw.

`Always` after install returns. `Reachable` on “probe threw then `sqlite_version()` succeeded” (the inversion). `Unreachable` for “install resolved and `json_extract` missing on a client that is not SQLite.”

Do not assert “health of Neon” here — that is `health-ok-db-down-opens-gate`. This is only dialect detect vs DDL.

## Suggested SUT instrumentation (all missing)

- `Always("sql.compat.probe_sqlite_then_skip_ddl")` when `sqlite_version()` succeeds inside `isPostgresSqlClient`: log that install will no-op.
- `Always("sql.compat.install_implies_json_extract")` after the DDL loop on the Postgres branch.
- `Reachable("sql.compat.probe_threw")` in the `catch`.
- `Unreachable("sql.compat.probe_threw_then_sqlite_version_ok")` if the same client later answers `sqlite_version()` without a reconnect to a different engine.

## What goes wrong if violated

Matchmaking/API boot applies the wrong DDL, then portable migrate runs against a half-shimmed engine. Shared SQL (`json_extract`) fails in production-shaped requests. A later `sqlite_version` shim on Postgres would silently skip install and break every JSON1 call.

## Open questions

- Does Antithesis first topology include matchmaking-on-SQLite, or only Node API + Postgres? If only Postgres, the dangerous SQLite-throw path is Reachable only if a second SQLite client is in the cluster. The Always on “install ⇒ json_extract” still applies to Postgres.
- Do `sqlClient.query` wrappers turn “undefined function” and “busy” into the same error type? If they are distinguishable, the probe could be tightened; the property still tests current catch-all behavior.
- Is `installPostgresSqliteCompat` ever pointed at the web per-user file? Not found. If that appears, MEMORY-journal wipe-on-corrupt plus this probe is a wipe + wrong-DDL pair.

## Assumptions

- Production API SQL is Postgres; SQLite misclassify is most relevant for matchmaking/sim adapters in the same tree and for any dual-engine installer.
- This is a SUT property (dialect detect in product installers), not the harness `SIM_FIDELITY=max` skip of partitions.
