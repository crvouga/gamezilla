# postgres-per-request-connect-settles

Focus: Resource Boundaries. Confidence: **high**.

## Why this property

Every non-health API request opens **one** pinned `pg.Client` TCP session
and `disconnect()`s it in `finally`. That is the Worker concurrency cap:
no shared pool, no cross-request wait queue (comment: a module-scoped
semaphore is illegal in Workers). The sanctioned `openPgClient` does **not**
set `connectionTimeoutMillis`. `PgClientOptions` cannot even pass one
(keepAlive / application_name only). The only 10s connect timeout in-tree
is `pingPostgres`, used for reachability probes — not the request path.

If Neon / embedded Postgres is partitioned or paused, `client.connect()`
hangs. `finally` never runs. Health stays 200, so clients keep sending
(see `mutation-upload-no-retry-storm-health-lie`). Each attempt can pin
another hanging TCP session until the isolate or the host hits FD / slot
exhaustion (`too many clients` is treated as transient only in ping).

`existing-assertions.md`: no Antithesis SDK. Suggested assertions are
**missing**.

## Code paths

- `apps/server/src/db/open-request-db-postgres.ts`: `openRequestDb` →
  `openPgClient({ connectionString, dbScope })` (22–31). Comment (7–11):
  do not share sockets; cap concurrency by awaiting disconnect on the
  request path.
- `pkgs/sql-client/src/postgres/connect.ts`
  - `openPgClient` (75–107): `new PgClient({ connectionString, ...clientOptions })`
    then `await client.connect()` — no `connectionTimeoutMillis`.
  - `PgClientOptions` (28–32): `keepAlive`, `keepAliveInitialDelayMillis`,
    `application_name` only.
  - `createPgPool` (207–221): `new PgPool({ connectionString, max: args.max ?? 1 })`
    — also no connect timeout (pool is not the Worker request path).
- `pkgs/sql-client/src/postgres/ping.ts`: `PING_CONNECT_TIMEOUT_MS = 10_000`
  (15, 76–78). Request path does not call this.
- `apps/server/src/app/request-db-middleware.ts`
  - Health skips DB (186–188).
  - `attachRequestDatabase`: `openObservedSqlClient` then ALS +
    `disconnect()` in `finally` (164–172). If `openSqlClient()` never
    settles, `finally` does not run.
- `apps/server/src/server.ts`: `/api/health` returns before `ensureApp`
  (251–259).

## Adjacent client bound (not this invariant)

SQLite `PRAGMA busy_timeout = 5000` on every new connection
(`pkgs/sql-client/src/sqlite/connection-pragmas.ts` 8–19;
`impl-sqlite-mem.ts` 149). Concurrent push + upload + hydration wait up to
5s then `SQLITE_BUSY`. That is a **local** lock bound, already explicit.
It does not protect the server Postgres connect hang. Worth a follow-up
property if Antithesis runs real multi-writer SQLite; not cataloged here
to keep the focus on the missing server deadline.

## Failure if violated

- Hung `connect()` per inbound `/api/mutations` / `/api/query` while
  health lies.
- Neon `max_connections` / pooler slots exhausted (`53300`, “remaining
  connection slots” — ping would retry these; the request path just hangs
  or 500s).
- `disconnect()` skipped → FD leak on the API process if the hang later
  errors without going through middleware `finally`.

## Antithesis angle

Pause or blackhole Postgres after health has succeeded. Drive authenticated
query + mutation traffic. Count in-flight `openPgClient` calls vs completed
`disconnect`. Wall-clock vs TCP SYN timeout (OS-level, often tens of
seconds to minutes — not an application bound).

## Suggested instrumentation (all missing)

- SUT-side around `openPgClient`: `Always` that `connect()` settles
  (success or throw) before a chosen deadline, **or**
  `Reachable("postgres request connect timed out")` if a timeout is added.
- Workload `Always`: number of request-scoped SQL clients with
  `connect()` started and `disconnect()` not finished is bounded (e.g. by
  intended Worker concurrency).
- `Sometimes(cond)`: a request fails fast with a connect error while
  health is still 200 (degraded-but-bounded mode). Today this may be
  unreachable if connect never throws.

## Open questions

- What deadline is intended? Ping uses 10s. Neon pooler vs compute suspend
  is not in-repo (`sut-analysis.md` open questions). The property stays
  “settles”; the number is parametric.

- In the Antithesis topology (Node `createServer` + embedded Postgres, not
  a Cloudflare isolate), is the leak still one TCP per request? Yes if
  `openRequestDb` is used; a process-wide `pg.Pool` would change the
  exhaustion shape (pool wait vs FD). Topology must keep per-request
  clients for this property to mean the same thing.

- Does wrangler / Node `pg` apply a default `connectionTimeoutMillis` of 0
  (wait forever) in the versions we ship? If a default timeout exists, the
  property becomes “that default holds” rather than “no timeout.”
