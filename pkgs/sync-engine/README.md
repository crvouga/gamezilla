# `@pkgs/sync-engine`

Local-first sync between **client SQLite** and **server Postgres**.

**How to use this file:** A blank agent (or human) with *only* this README
should be able to (1) explain the system correctly, (2) review PRs against
invariants, and (3) discuss design / recommend improvements without inventing
history. Prefer this doc over training data or old chat transcripts.

Related: root [`AGENTS.md`](../../AGENTS.md). This file is the single design
doc for `@pkgs/sync-engine` (system + deterministic harness + scenario catalog) —
load it alone for design discussion.

---

## One-sentence mental model

The client is a **replicator**: the server sends **full query snapshots that
include soft-deleted rows**; the client **upserts every row verbatim**, then
**rebases its pending local mutations on top**. Deletion is data
(`deleted_at`), never inferred from absence. Peers learn about each other’s
changes via **pubsub push → (optional row-image apply) or query refetch**.
Snapshots alone define correctness; row-image fanout is a **lossy
optimization**. There is **no peer mutation fanout**.

```text
mutate() ──► local SQL + sync_engine_mutations row ──► POST /mutations ──► Postgres replay
                                                              │
                                                              ▼
                                              post-replay SELECT → push
                                                              │
UI ◄── useQuery(watch) ◄── SQLite ◄── merge(upsert + rebase) ◄─┤
                                         ▲                        │
                                         ├── row images (lossy)   │
                                         └── POST /query refetch ─┘
```

**This package is not a CRDT, not OT, not a realtime game bus.** Realtime
shared play belongs on a separate realtime host. Sync-engine is the
authoritative **durable domain mirror** (membership, documents, config,
inbox rows, auth entities — whatever the product registers).

**Latency goal:** sub-200ms p95 peer-visible domain writes (device A mutates →
device B's SQLite reflects it) via immediate upload drain + row-image fanout.
**Anti-goal:** sub-50ms shared realtime state stays off this package.

## Design goals (priority order)

When recommending changes, optimize in this order unless the user overrides:

1. **Correctness under partition** — offline mutate + later upload; idempotent
   replay; auth revoke wipes local DB.
2. **Simplicity of the sync model** — fewer tables, fewer wire shapes, fewer
   special cases beat micro-optimized latency.
3. **Local-first UX** — optimistic apply is instant; UI reads SQLite only.
4. **Operability** — CI gates catch policy drift; deterministic harness catches
   races; four public entrypoints only.
5. **Efficiency** — hash/`not_modified`, push table filtering, coalesce,
   single-flight merge, row-image fanout. Secondary to 1–4.

### Tiger Style (safety + bounds)

Adapted from [TigerBeetle Tiger Style](https://github.com/tigerbeetle/tigerbeetle/blob/main/docs/TIGER_STYLE.md). Priority: **correctness → performance → DX**.

| Error class | Handling |
|-------------|----------|
| Programmer / invariant bug (registry, batch lengths we authored, corrupt local queue args) | `assert` from `@pkgs/assert` — crash |
| Operating (network, 429, storage full, auth revoke) | `onError`, retry/backoff, wipe |
| Byzantine wire (oversized fanout, unknown push table) | Drop row images; refetch (lossy fanout OK) |
| Domain `MutationError` on rebase | Keep queued; hide optimistic until upload reject |

**Protocol bounds** (`protocol/v2.ts`, mirrored in `queries/shared/bounds.ts`):

| Constant | Value | Enforced emit | Enforced receive |
|----------|------:|---------------|------------------|
| `MAX_QUERY_BATCH` | 64 | `parseQueryBatchBody` | `postQueryBatch` chunks client POST |
| `MAX_MUTATIONS_BATCH` | 64 | route + parser | upload `LIMIT` + verdict pairing |
| `MAX_FANOUT_ROWS` / `MAX_FANOUT_BYTES` | 64 / 32KiB | server fanout emit | push receive drops over-cap `rows` |

**Harness invariants** (`queries/shared/tiger-invariants.ts` + `harness/invariants.ts`):
`seq-monotonicity`, `permanent-vs-transient-verdicts`,
`push-seq-monotonic-per-topic`, `checkpoint-monotonic-per-scope`,
`optimistic-markers-healed-after-converge`, `healed-queue-drained`.

Query registry compile-time rules (hard `limit`, no duplicate names, tombstone SQL)
are enforced in `queryRegistry()` / AST capture — not duplicated in the harness list.

**Anti-goal:** cargo-cult Zig (no static-allocation requirement in TS). Hot paths
use `hotAssert()` when per-call validation would dominate.

**Anti-goals:** sub-50ms multi-device domain edits via MQTT (use Room DO);
perfect GC of every row the moment it leaves a query; zero stale locals;
custom per-feature REST sync; peer mutation replay.

---

## Ownership: package vs product

| Owned by `@pkgs/sync-engine` | Owned by product (`@libs/*`, `apps/*`) |
|------------------------------|----------------------------------------|
| Merge / rebase / upload queue | Domain schema (`@libs/runtime` `appSchema`) |
| Query/mutation registries API | Query + mutation **defs** per feature |
| Framework tables + DDL | Topic naming (`user:`, `room:`, …) |
| `createSyncApp` Hono routes | Auth resolution, Postgres client |
| Client engine + Solid hooks | Session query list, paint gate wiring |
| Push apply / optimistic fanout | MQTT/EMQX pubsub adapter |
| Deterministic harness + scenarios | Product REST exceptions |

**Tier rule:** this is a flat `pkgs/` package — **no** product imports
(`@libs/*`, apps). Product topics and schemas live in the host composition
layer; the engine only sees registries + SQL clients + pubsub ports.

---

## Public API (five entrypoints only)

Deep imports under `src/` are **not** public. `package.json` `exports`:

| Import | Role |
|--------|------|
| `@pkgs/sync-engine/client` | Web engine, Solid hooks, HTTP client |
| `@pkgs/sync-engine/server` | Hono sync app (`POST /query`, `POST /mutations`), `notifyChannels` |
| `@pkgs/sync-engine/shared` | `defineQuery` / `defineMutation`, registries, soft-delete helpers, **protocol v3**, opaque migrate |
| `@pkgs/sync-engine/harness` | In-memory engine + harness controls (`SCHEMA_EPOCH`, controllable lifecycle) |
| `@pkgs/sync-engine/solid` | Solid bindings: `SyncEngineProvider`, `createQuery`, `useSyncEngine`, `MutationClientProvider` / `useMutationClient` |

Full contract map, cutover runbook, authoring drift close-out, and refactor-freedom
checklist: [`docs/CONTRACTS.md`](./docs/CONTRACTS.md). Checked-in API reports:
[`api-reports/`](./api-reports/).

### Contract classes (what you may depend on)

| Class | Promise | Examples |
|-------|---------|----------|
| **Code API** | Five entrypoints; coordinated monorepo refactors OK | `createLocalSyncEngine`, hooks, `createSyncApp`, `notifyChannels` |
| **Wire protocol** | Cross-version freeze (`src/protocol/v2.ts`); shape changes need a version bump | `QueryResponse`, mutation batch, `PushMessage`, `MAX_*`, `upgrade_required` |
| **Local domain SQL** | Deliberate local-first contract | Domain tables, `deleted_at`, `LIVE_ROW_SQL`, `useQuery` |
| **Extension** | Domain plug-in vocabulary | `defineQuery` / `defineMutation`, `defineTopicMap`, `MutationEnv` |
| **Runtime wiring** | Injected ports | `postQueries`/`postMutations` (protocol-derived), pubsub, auth, SQL, lifecycle |
| **Internal** | Free to change; must not leak | Framework tables, merge/upload, seq alloc, hash algorithms, epoch |

**Do not depend on:** framework table names/shapes (`sync_engine_mutations`, `sync_engine_write_rejections`, …),
`SCHEMA_EPOCH` (except via `/harness`), DDL text, `allocateTopicPushSeq`, or deep
`@pkgs/sync-engine/src/...` imports. Use `mutationOutcome` / `listRejections` /
`pendingMutationCount` instead of SQL on framework tables.

### Notable public symbols

**client:** `createLocalSyncEngine`, `createSyncHttpClient`, `createSyncEnginePool`,
`SyncEngineProvider`, `useSyncEngine`, `useSyncEngineInstance`, `useQuery`,
`MutationClientProvider`, `useMutationClient`, `SyncEnginePaintGateContext`,
`AppLifecycle` **types**, status types, `SyncEngine.mutationOutcome` /
`listRejections` / `pendingMutationCount`. Optional create opts `schemaEpoch` /
`onLocalMigratePhase` for harness (constants live on `/harness`).

**server:** `createSyncApp`, `notifyChannels({ pubsub, sql, topics, … })` (await
while `sql` is connected; allocates pushSeqs then fire-and-forgets publish),
`isAuthErrorBody`, `SyncAppAuth`, `pruneMutationArtifacts`.

**shared:** `defineQuery`, `defineMutation`, registries, `MutationError`,
`LIVE_ROW_SQL`, `softDeleteById`, framework schema migrate helpers (opaque),
protocol types + `MAX_*` + `SYNC_PROTOCOL_VERSION`,
`defineTopicMap`, `assertChannelExhaustiveness`, `assertDomainTablesAvoidFrameworkNames`.

**test:** `createInMemorySyncEngine`, `SCHEMA_EPOCH`, `createControllableLifecycle`,
`withFrameworkMutations` (escape hatch; factories already merge).

**Not public:** `merge.ts`, `SubscriptionRuntime`, `MutationUploadQueue`, `attachPush`,
`allocateTopicPushSeq*`, `FRAMEWORK_*` DDL/constants, `publishPushMessages`,
`runQuery`, `replayMutation`, anything under `src/harness/`.

### Refactor-freedom (acceptance for internals rewrites)

These must be possible with zero edits outside `pkgs/sync-engine/src/`:

1. Rename/restructure any framework table or storage layout.
2. Rewrite merge/rebase/subscription/upload from scratch.
3. Swap pubsub transport behind the pubsub port.
4. Change coalescing, batching, retry/backoff, single-flight (wire `MAX_*` bounds still frozen).
5. Change `SCHEMA_EPOCH` mechanics or cache-wipe strategy.
6. Change content-hash / scope-hash **algorithms** (opaque equality only on the wire).
7. Add a push optimization without new required host wiring.

### CI (encapsulation)

```bash
bun run lint  # no-sync-engine-framework-leak / no-sync-engine-terminology plugins
bun run --filter @pkgs/sync-engine test
```

---

## System boundary map

```text
┌─────────────────────────────────────────────────────────────┐
│ apps/client                                                  │
│  createAppLocalSyncEngine → createLocalSyncEngine            │
│  sessionQueries + MQTT pushes (rowImageFanout: true)         │
│  useQuery / useMutationClient / SyncEnginePaintGateContext   │
└───────────────────────────┬─────────────────────────────────┘
                            │ POST /api/query, POST /api/mutations
                            │ MQTT pushes (EMQX)
┌───────────────────────────▼─────────────────────────────────┐
│ apps/server  createSyncApp (package mounts /query, /mutations)  │
│  runQuery / processMutationsBatch / notifyChannels           │
│  Postgres (domain + sync_engine_mutations_applied + sync_engine_write_rejections)   │
│  product opts rowImageFanout: true                           │
└───────────────────────────┬─────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
   Realtime host       billing/etc            REST exceptions
   (shared play)       (external)            vendors / external
```

**Wire path layering:** the package Hono app mounts `POST /query` and
`POST /mutations`. The product HTTP client defaults to `/api/query` and
`/api/mutations` (host mount prefix). Both names appear in docs — they are
the same routes at different layers.

**Absolute REST exceptions** (do not casually grow — see host `AGENTS.md`):
billing/external APIs. Identity bootstrap writes are
**mutations**, not REST.

---

## Core concepts

### Identity

| Term | Meaning |
|------|---------|
| `actorId` | Authenticated user id (session). Authorizes queries/mutations. |
| `deviceId` | Stable device id. |
| `clientId` | Upload identity; **= deviceId** in the product app. |
| `accountId` | May be null for anon. |
| `MutationEnv.now` | Client wall clock at apply; **pinned to `createdAt` on replay**. |
| `serverNow` | Optional server clock on replay only (staleness checks). |

Auth revoke (`reason: 'revoked'`) → engine disconnects, deletes the identity
SQLite DB, resets status. Expired tokens refresh; they must not wipe.

### Queries (`defineQuery`)

A query is a **named, parameterized, authorized snapshot** of one or more
domain tables.

```ts
defineQuery({
  name: 'memberships',
  params: z.object({}), // optional; default empty object
  // hydrates derived from first run() return keys — not authored
  // limit omitted → DEFAULT_QUERY_LIMIT (2000); no inline LIMIT in run SQL
  entryChannel: undefined, // omit → host defaultEntryChannel; false = reconcile-only
  authorize: async (ctx) => ..., // real authz only; deny-anon by default
  run: async (ctx, params) => ({ memberships: rows }),
});
```

**Tombstones on the wire (required):**
- `run` SQL must **select `deleted_at`** and must **not** filter
  `deleted_at IS NULL` (AST-enforced).
- Snapshots include soft-deleted rows so the client can upsert tombstones.
- UI / live client reads **do** filter live rows (`deleted_at IS NULL` or
  `LIVE_ROW_SQL`).

**Wake topics:** held live rows → `defineTopicMap` ∪ `entryChannel` (no hand
`channels` field).

**Scopes:** each `(name, params)` pair hashes to a `scope_hash`
(`sha256(name\0canonicalJson(params))`). Active scopes are refcounted
subscriptions. Checkpoint + content hash live in `sync_engine_scope_meta`.

**Limits:** every query has a hard `limit` field; framework appends
`LIMIT` and truncates via `applyHardLimit`. Unbounded sync is forbidden
(Tiger). Batch bound: max **64** queries per POST.

### Mutations (`defineMutation`)

A mutation is the **only** legal domain write path (client + server).

```ts
defineMutation({
  name: 'removeMembership',
  args: z.object({ ... }),
  requiresOnline: false,
  pendingUx: 'instant',
  constraintErrors: { ... },
  run: async ({ tx, env }, args) => { /* SQL only */ },
});
```

Rules:
- Bodies must **soft-delete** (`UPDATE … SET deleted_at = …`), never
  `DELETE FROM` domain tables. AST capture throws `MutationError`
  `NO_HARD_DELETE` on domain hard deletes at apply **and** replay.
- Use `softDeleteById` / `LIVE_ROW_SQL` from `@pkgs/sync-engine/shared`.
- Write tables, fanout images, and wake topics are **derived**: wrapMutationDb
  classifies SQL, injects `RETURNING *`, feeds `defineTopicMap` (+ optional
  `fallbackTopics` when a table is touched without row images). Caps:
  `MAX_FANOUT_ROWS=64`, `MAX_FANOUT_BYTES=32KiB`.
- Protocol is hard-cut (`SYNC_PROTOCOL_VERSION = 3`); old clients get
  `upgrade_required` (no DB wipe). Pending `sync_engine_mutations` preserve-and-drain
  across the cut (stable wire names).
- Server replay is idempotent via `sync_engine_mutations_applied` (keyed by mutation id).
- Framework mutations (e.g. `acknowledgeWriteRejection`) are merged
  automatically inside `createSyncApp` and `createLocalSyncEngine` (and
  `MutationClientProvider`). Do not call `withFrameworkMutations` in product
  registries.

### Sync engine (client)

`createLocalSyncEngine` owns:
1. Local schema migrate (framework + domain via `@pkgs/db-schema-sqlite`;
   `SCHEMA_EPOCH = 11`)
2. `SubscriptionRuntime` — coalesce → `POST /query` → merge
3. `MutationUploadQueue` — drain `sync_engine_mutations` → `POST /mutations`
4. Optional `attachPush` — MQTT topics from held-row topic-map ∪ entryChannel
5. Table-change bus + `watch` / Solid `useQuery`

**Injected ports** (product or harness): `db`, `postQueries`, `postMutations`,
`getMutationEnv`, `getClientId`, `isAuthRevoked`, `deleteDatabase`, optional
`push`, `lifecycle`, and harness-only `now` / `random` / `timers` / `createId`.

**Session queries vs product paint:**
- `sessionQueries` are held for the engine lifetime; `waitForFirstSync()`
  awaits their first successful sync (harness / `subscribeQueries`).
- Product boot does **not** wait on first-sync. It paints as soon as the
  identity-scoped SQLite engine is open and `connect()` has started session
  watches. `paintReady` is **not** computed inside the engine. Product boot
  provides `SyncEnginePaintGateContext` (default `true`);
  `useSyncEngine().paintReady` reads that context (identity-match gate
  during account switch).

Product session lists and dynamic feature subscriptions are owned by the
host — see app wiring docs. The package only receives `sessionQueries` /
`subscribeQueries` by name.

### Topics (host convention)

Runtime registers `defineTopicMap` plus `defaultEntryChannel`. Typical helpers:

| Helper | Topics |
|--------|--------|
| `userChannels` / `userTopic` | `user:{actorId}` |
| `groupTopic` | `group:{groupId}` |
| `configChannels` | singleton config topic |

Tables that drive held-row subscriptions opt in via `subscribeTopics` on
their topic-map entry. Optimistic row-image filters use optional `rowImage`.

Pushes carry optional `tables` from **AST capture** so the client wakes only
scopes whose derived hydrate tables overlap.

### Channel exhaustiveness

Review channel exhaustiveness when adding queries: every hydrated domain
table should have a topic-map entry (or be reconcile-only with empty `entryChannel`).
Missed `notifyChannels` on non-mutation server writes remains a runtime
footgun for *latency* — prefer mutations / notify; the client reconcile tick
is the safety net so peers do not stay forever-stale.

### `rowImageFanout` defaults (important)

| Surface | Default | Detail |
|---------|---------|-------|
| `createSyncApp({ rowImageFanout })` | **false** | Opt-in |
| Client `push.rowImageFanout` | **false** | Opt-in |
| Product host (`apps/*`) | **true** | Both API + client set true |
| `exampleSystem.run(...)` | **true** | algebra entry |

When off, pushes are wake+refetch only (still correct). When on, contiguous
`pushSeq` + `rows` may apply via `applyRowImages` without updating
`sync_engine_scope_meta.last_hash` (keeps `not_modified` sound).

---

## Tables

### Local SQLite (framework)

| Table | Durable? | Purpose |
|-------|----------|---------|
| `sync_engine_mutations` | yes | Pending upload queue only: `id, name, args, client_id, seq, created_at` |
| `sync_engine_scope_meta` | cache | Per-scope `last_checkpoint`, `last_hash`, `last_active_at` |
| `sync_engine_push_applied` | cache | Per-topic `last_push_seq` push sequence (fanout gap detection) |
| `sync_engine_write_rejections` | cache | Permanent failures (local or synced) |

`seq` = `COALESCE(MAX(seq),0)+1` inside the mutate transaction. Server
idempotency is by **mutation id**, so seq restarts are harmless.

**Deleted on purpose (do not resurrect without a design review):**
`_row_scopes`, `_upload_state`, `_peer_applied`, `_peer_mutations`,
per-topic applied-seq cache (replaced by `sync_engine_push_applied`), full write-epoch /
`status` / `acked_epoch` barriers, MQTT mutation fanout payloads. Ack-then-stale-merge
flicker is addressed by sync `bumpGenerations` on upload ack (not a write-epoch).

`SCHEMA_EPOCH` (currently **7**) bumps wipe **cache** tables and drop retired
tables; durable `sync_engine_mutations` survive epoch wipe semantics carefully (see
`local-schema-migrate.ts`).

Domain tables come from the host’s `LocalDomainSchema.domainSchema` (e.g.
`@libs/runtime` `appSchema`). Managed columns include `deleted_at`.

### Server Postgres (framework)

Applied by package-local `defineTable` schema (`syncEngineServerSchema`) via
`SyncEngineDatabaseMigration` (cutover + `PostgresSchemaDatabaseMigration`).
Not registered in product `appSchema`:

| Table | Purpose |
|-------|---------|
| `sync_engine_mutations_applied` | Idempotency + audit (`applied` / `rejected`); `id = mutation_id` |
| `sync_engine_write_rejections` | Permanent failures keyed by `client_id` (= device id) |
| `sync_engine_topic_seq` | Per-topic monotonic push sequences (`n`); `id = topic` |

`public.sync_engine_mutations` is **dropped**. Uploads are JSON to `POST /mutations`, not
row sync of a `sync_engine_mutations` table.

`pruneMutationArtifacts` deletes old `sync_engine_mutations_applied` + acknowledged
`sync_engine_write_rejections` (ops/scheduled job, not request path).

---

## Wire protocol

### `POST /query` (package) / `POST /api/query` (product client)

```ts
{ queries: Array<{ name, params, lastHash?, checkpoint? }> }  // max 64
→ { responses: QueryResponse[] }
```

`QueryResponse` (exactly three shapes):

```ts
| { status: 'ok'; checkpoint; hash; tables: Record<string, QueryRow[]> }
| { status: 'not_modified' }
| { status: 'denied' }
```

- Unknown name / bad params / authorize fail → `denied`
- Same content hash as `lastHash` → `not_modified` (no merge, no rebase)
- Auth failure → HTTP 401 `{ error: 'auth', reason: 'expired' | 'revoked' }`
- Bad body → HTTP 400 `{ status: 'denied' }`

**Removed forever (unless redesign):** `mode: 'delta' | 'full'`, `resync`,
`gone`.

### `POST /mutations` (package) / `POST /api/mutations` (product client)

```ts
{ mutations: Array<{ id, name, args /* JSON string */, clientId, seq, createdAt }> }
→ { ok: true, verdicts: Array<applied | rejected>, ackSeq, topicPushSeqs? }
```

Bounds: `MAX_MUTATIONS_BATCH = 64`. Client ack = **delete** local `sync_engine_mutations`
row (applied or rejected). Rejected also writes local `sync_engine_write_rejections`.
Optional `topicPushSeqs` floors the mutating client’s `sync_engine_push_applied` so
own echoed fanout is skipped.

After successful replay, server `notifyChannels` per topic-map topic with a
**strictly monotonic per-topic `pushSeq`** (from `sync_engine_topic_seq`).
When `rowImageFanout` is enabled and AST capture produced row images, the
push may also carry post-replay **row images** (size-capped). Replay + fanout
SELECT + pushSeq allocate share **one Postgres transaction**. Wire envelopes
stay on the current protocol (derivation did not need leaner payloads).

Bad body → 400 `{ error: 'invalid_batch' }`; oversized → 413
`{ error: 'batch_too_large' }`.

### Pubsub push

```ts
{ pushSeq: string; optimistic?: true; tables?: string[]; rows?: Record<string, QueryRow[]> }
```

`pushSeq` is required and monotonic per topic. Optional `rows` are
server-authored post-replay images (incl. `deleted_at`) — a **lossy
optimization**. `optimistic: true` is a **client-local** MQTT hint before
server replay (`pushSeq: '0'`); apply rows without advancing `sync_engine_push_applied`.
Any dropped, reordered, duplicated, or ignored fanout must degrade to
push → refetch. Snapshots alone define correctness.

**Client `handlePush` order (simplified):**
1. Optimistic → maybe apply rows; do not advance `sync_engine_push_applied`
2. Exact echo (`pushSeq === last`) with rows → apply images (own echo)
3. `pushSeq ≤ last` → drop
4. Table filter → wake overlapping hydrate-table scopes
5. Contiguous next + rows → `applyRowImages` + record seq; else wake refetch
   (pending seq committed after successful sweep)

**Removed forever (unless redesign):** peer **mutation** fanout / MQTT as a
mutation log. Peer-executed mutations diverge under state skew, and
`lastHash`-based `not_modified` cannot detect or repair peer-local divergence.
Row-image fanout is different: peers upsert server facts, never execute.

---

## Client merge algorithm

For each `ok` response (single-flight per DB — `MAX_IN_FLIGHT_POLLS = 1`):

1. Skip if checkpoint ≤ stored `sync_engine_scope_meta.last_checkpoint` (stale).
2. Per table: upsert column intersection **verbatim** (incl. `deleted_at`).
   No tagging, no absence tombstones, no orphan GC.
3. Touch `sync_engine_scope_meta` (`last_checkpoint`, `last_hash`, `last_active_at`).
4. Rebase every pending `sync_engine_mutations` for this `clientId` in `seq` order
   (`env.now` pinned to each row’s `created_at`).
   Throws swallowed → optimistic effect hidden until upload/reject.
5. Emit table-change bus for watches.

`applyRowImages` = same upsert+rebase, **does not** update
`sync_engine_scope_meta.last_hash`.

`detachScope` (unsubscribe / `denied`) = delete `sync_engine_scope_meta` row only.

**Reject semantics:** upload reject deletes the queue row and inserts
`sync_engine_write_rejections`. Domain optimistic rows are **not** auto-reverted on reject
alone — the next successful merge without a pending rebase restores server
truth (see `pending-reject-surfaces-write-rejections` scenario).

**Ack fence:** on any `applied` verdict, `runtime.bumpGenerations()` drops
in-flight pre-replay query sweeps (reject-only batches do not fence).

---

## Subscriptions & push

### `SubscriptionRuntime`

- One coalesce queue (`QUERY_COALESCE_MS = 0` → microtask coalesce)
- One in-flight flush; further wakes queue
- Background (`AppLifecycle`) pauses sweeps; foreground resumes with `wakeAll`
- Safety-net reconcile tick (`QUERY_RECONCILE_INTERVAL_MS`, harness shorter) → `wakeAll`
- Session queries held for engine life; `waitForFirstSync` waits on them
  (harness / `subscribeQueries` — not product paint)

### `attachPush`

- Topics from active query `channels(ctx)`
- **Initial attach** remakes pubsub once (topics subscribed at birth)
- **Membership / topic churn** syncs incrementally (subscribe add / unsubscribe
  remove) — does **not** `close()` the MQTT session (avoids sessionExpiry-0
  queue wipe during create-after-end peer fanout)
- Topic sync **waits until local `sync_engine_mutations` drain** (membership pending gate)
- After incremental topic add/remove → `wakeAll()` once (restoreNetwork subscribe races)
- Reconnect → `wakeAll()`
- Local writes to subscription-driving tables (`subscribeTopics`) refresh held-row topics
- Optional `bufferOutboundLive` queues optimistic fanout while detached

---

## Soft-delete policy (hard rule)

| Surface | Rule |
|---------|------|
| Domain mutations | `UPDATE … SET deleted_at`; never `DELETE FROM` |
| `defineQuery.run` | **Include** tombstones (`SELECT …, deleted_at`, no live filter) |
| UI / `useQuery` SQL | Filter `deleted_at IS NULL` (or `LIVE_ROW_SQL`) |
| Merge | Upsert `deleted_at` as a normal column |
| Framework tables | Soft-delete too (`defineTable` managed cols); recoverAll on unique-key upsert |

Inbox is slightly different product-wise (`active` flag) but still a sync query;
don’t invent a second delete model without review.

---

## Consistency & failure model

| Event | Behavior |
|-------|----------|
| Offline mutate | Applies locally, queues `sync_engine_mutations`, UI updates via watch |
| `requiresOnline` offline | Returns `{ ok: false, code: 'OFFLINE' }`; no queue |
| Local SQLITE_FULL | Returns `{ ok: false, code: 'STORAGE_FULL' }`; txn rolls back; no queue |
| Upload success | Delete queue row; sync gen bump drops in-flight pre-replay sweeps; peers learn via push → query |
| Upload reject | Delete queue row + `sync_engine_write_rejections`; domain rolls back on later merge |
| Merge while pending | Server snapshot applied, then pending mutations re-run |
| Stale snapshot | Checkpoint compare drops it; post-ack gen bump drops in-flight pre-replay sweeps |
| Denied query | Detach scope meta; domain rows remain |
| Auth revoked | Wipe identity DB |
| Auth expired | Refresh; must not wipe |
| Push lost / missed notify | Next reconnect / foreground / reconcile tick / membership wakeAll eventually refetches |
| Partial multi-query batch | Per-response apply; generation guards drop superseded scopes |

**Not provided:** causal multi-device domain locks, exactly-once UI effects.
Optimistic body must not briefly revert to server-old after own ack (lite
soft-ack + generation fence); see
`online-mutate-no-optimistic-body-flicker` /
`delayed-sync-after-ack-no-optimistic-flicker`.

---

## Locked decisions vs open design space

### Locked (require explicit user buy-in to reverse)

- Soft-delete-only domain rows + tombstones on the wire
- Snapshot merge (not delta protocol) as the default truth path
- Locked: no peer **mutation** fanout / no `_peer_mutations` (row-image fanout is the latency path)
- No `_row_scopes` / absence-as-delete
- No full write-epoch / `acked_epoch` barrier (flicker fix: sync
  `bumpGenerations` on upload ack; ack still deletes the queue row)
- Four public package entrypoints
- Mutations-only domain writes; tiny REST exception list
- Hard query `limit` required
- pkgs tier cannot import libs/apps

### Open (reasonable improvement territory)

- Local **prune / size policy** for catalogs + old tombstones
- Stronger CI that `defineQuery.run` selects `deleted_at` / omits live filters
- Incremental/delta protocol *if* full snapshots become a measured bottleneck
- Server-side tombstone windows / “deleted since checkpoint” for huge tables
- Clearing stale locals that left a scope without soft-delete (product policy)
- Delete dead `process-upload-with-mutations.ts` (removed; legacy CRUD upload)

### Explicitly rejected for now

- Bringing back `_row_scopes` “just in case”
- MQTT as a mutation log / CRDT
- Optimistic-only overlays that never write domain tables (would break local
  SQL watches unless rebuilt)
- Per-feature sync engines

---

## Known limitations (improvement candidates)

Ordered by leverage for **simplicity + reliability** (not raw speed):

1. **SQLite growth** — soft-delete + no unsubscribe wipe ⇒ catalogs and
   tombstones accumulate. Need age/size caps or explicit “clear cache” for
   non-durable tables. Highest long-term reliability risk on devices.
2. **Stale live rows outside soft-delete** — if a row leaves a query result
   without `deleted_at` set, it stays live locally. Mitigate with better
   query design (always tombstone membership edges) or accept + filter in UI.
3. **~~Ack-then-stale-merge flicker~~ (fixed)** — on applied ack, synchronously
   `bumpGenerations` so in-flight pre-replay query sweeps are dropped before
   they can apply without a pending rebase shield. Queue row is still deleted
   on ack (no write-epoch). Post-ack `wakeAll` is intentionally not wired
   (disturbs concurrent multi-writer settle in harness).
4. **Full snapshot cost** — large catalog / interactions payloads.
   `not_modified` helps when unchanged; first fetch / rating band change is
   heavy. Deltas are a last resort after measuring.
5. **Membership topic sync** — incremental subscribe/unsubscribe (no MQTT
   remake). Waits for pending `sync_engine_mutations` drain; tiny subscribe-race window
   healed by `wakeAll`; true dispose still closes with sessionExpiry 0.
6. **Product paint is local-open** — `waitForFirstSync` still waits on all
   session queries for harness/`subscribeQueries`. Product `paintReady` is an
   identity-match context set once the local engine is mounted, not after
   first-sync.
7. **Rebase swallows errors** — pending mutation that fails against new
   server state stays queued until upload reject; UI may look “stuck”
   optimistic. Product should watch `sync_engine_write_rejections`.
8. **Inbox `active` filter vs tombstones** — inbox may filter `active = true`
   (not a `deleted_at` predicate); remaining product staleness risk if rows
   are soft-deleted without clearing `active`.
9. **Prune retention window** — `pruneMutationArtifacts` prunes acknowledged
    `sync_engine_write_rejections` only; applied mutation ids stay in
    `sync_engine_mutations_applied` so late retries remain idempotent (pinned by
    `late-retry-after-prune-idempotent`).
10. **Server DDL before client writers** — mixed app versions are safe for
    **reads** via column-intersect merge (extra server columns ignored; local-only
    columns not clobbered). Clients that **write** a new column/table before the
    server has migrated that DDL will fail upload (infra retry / no wipe). Ship
    server migrate first; pinned by `client-ahead-column-mutation-no-wipe`.
11. **Malformed mutation `args` JSON** — permanent `INVALID_ARGS` reject (not an
    infra retry storm).

---

## Complexity hotspots (edit carefully)

| Area | Path | Why it’s sharp |
|------|------|----------------|
| Merge | `client/merge.ts` | Single-flight + checkpoint + upsert + rebase; correctness core |
| Subscriptions | `client/subscription-runtime.ts` | Coalesce, generation guards, lifecycle, session refs |
| Push attach | `client/attach-push.ts` | Incremental topic sync vs membership ctx races |
| Push handle | `client/attach-push-handle.ts` | Optimistic / echo / contiguous / wake fallback |
| Replay | `mutations/server/replay-mutation.ts` | Idempotency + rejection recording + constraint mapping |
| Mutations route | `server/sync-app-mutations-route.ts` | Replay + fanout SELECT + pushSeq in one txn |
| Local migrate | `client/local-schema-migrate.ts` | Epoch wipe vs durable queue |
| Product topics | `defineTopicMap` / `entryChannel` | Wrong map ⇒ silent staleness |

Prefer deleting machinery over adding flags. If a proposal adds a table or wire
status, it needs a stronger justification than “might be useful.”

---

## Performance characteristics (current)

- Query HTTP: batched, max 64 per POST; 1 in-flight batch per client runtime
- Mutation HTTP: batched, max 64; upload wake is sticky-immediate (100ms idle is backstop only) / error 2s
- Coalesce: microtask (0 ms) — bursts collapse without timer delay
- Cache hit: content hash → `not_modified` (empty body)
- Merge: column-intersect upsert per row (not bulk COPY)
- Watches: table-change bus; SQL re-run on overlapping table names
- Pushes: required per-topic monotonic pushSeq; optional row images
  (`MAX_FANOUT_ROWS` / `MAX_FANOUT_BYTES`); table-filtered scope wake; reconnect full wakeAll
- Peer-visible latency budget (happy path): immediate drain + replay/publish +
  pubsub hop &lt; 200ms p95 simulated

Measure before proposing deltas, indexes, or parallel in-flight polls.
Raising `MAX_IN_FLIGHT_POLLS` re-opens merge races unless merge stays
single-flight (it does) — mainly HTTP/server load then.

---

## Schema & versioning

- **Domain schema:** `@libs/runtime` `defineTable` / `registerTables` / `appSchema`; local reconcile via
  `@pkgs/db-schema-sqlite`; Postgres migrate separate.
- **Framework local:** package-local `syncEngineLocalSchema` via `applySqliteSchema`; `SCHEMA_EPOCH` (= 12)
  in `queries/client/local-schema.ts`.
- **Framework server:** `syncEngineServerSchema` via `SyncEngineDatabaseMigration` (cutover + Postgres reconcile).
- **Query/mutation wire names:** breaking changes ship as a new `name`
  (e.g. `joinSpaceV2`). Protocol cutover for clients is `upgrade_required`
  (no wipe) + pending-queue preserve-and-drain — see CONTRACTS cutover runbook.
- **Cache clear:** `clearLocalData({ reason: 'cache' })` drops cache tables and
  recreates schema; durable `sync_engine_mutations` policy follows migrate helpers.
  `{ reason: 'revoked' }` is the auth-wipe path.

---

## Directory map

```text
pkgs/sync-engine/src/
  client/           # engine, merge, subscriptions, push, Solid, HTTP, pool
  mutations/
    core/           # defineMutation, types, registry
    client/         # createMutationClient, mutation-status
    server/         # replay, batch, prune, dead legacy upload classifier
    shared/         # wrapMutationDb, soft-delete, framework mutations
  queries/
    core/           # defineQuery, types, registry
    server/         # runQuery
    client/         # local-schema, sql-watch, table-change-bus
    shared/         # hash/canonical, bounds, tiger invariant names
  server/           # createSyncApp, routes, notifyChannels
  shared/           # framework DDL, channel exhaustiveness, push types
  harness/              # deterministic multi-client simulation (not public)
  test/             # in-memory engine
  tests/
    scenarios/      # black-box correctness (~140 files)
    harness/        # harness kernel self-tests
```

---

## Solid hooks (client)

| Hook / API | Use |
|------------|-----|
| `useSyncEngine()` | Reactive status + `paintReady` (from paint context) + methods |
| `useSyncEngineInstance()` | Stable engine (effects/providers) |
| `useQuery(sql)` | Live SQLite watch |
| `useMutationClient()` | `mutate(def, args)` |
| `SyncEnginePaintGateContext` | Product sets identity-match gate |
| `createSyncEnginePool` | Multi-identity engine pool (account switch) |

Mutation UX (product/`@pkgs/ui-rn`, not this package): destructive →
`MutationModal`; light → `useMutationButton`. Don’t `router.back()` from
mutation `onSuccess` — stay and let SQLite drive UI.

---

## Testing & CI

```bash
bun run --filter @pkgs/sync-engine tc
bun run --filter @pkgs/sync-engine test
bun run lint
```

| Suite | Path | Role |
|-------|------|------|
| Behavior (Gherkin) | `specs/sync-engine/*.feature` | What people observe on the example domain (writes reach everyone quickly, survive offline / crashes / lost replies / app updates, writes that wait for an answer, refusals, membership scopes); steps in `tests/steps/` over `@pkgs/sync-engine/harness` |
| Model (Quint) | `specs/sync-engine/note-replication.qnt` | Replication rules for the example domain under any interleaving of edits, offline, stalled networks, cut-off saves or live updates, lost replies + retries, save and refresh hiccups, a full device, crashes (also mid-save), failed opens, app updates (also forced), damaged or cleared app data, damaged unsent edits, signing out elsewhere, wrong clocks, lossy / garbled / lost / paused live updates, outages, a second window, and the team's silent edits, inserts and tidying, for three people; binding in `tests/quint/`, traces drawn from `FC_SEED` |
| Contract / property | `tests/*.test.ts`, `tests/*.property.test.ts` | Wire and storage contracts (hard delete, mutation authorization, not-modified queries, managed columns, topic maps), and one framework regression: the harness's standing check reads only committed upload verdicts (`invariant-check-waits-for-in-flight-verdict`, timing-exact, not reproducible from a scenario) |
| Public unit helper | `@pkgs/sync-engine/harness` | `createInMemorySyncEngine` (no full kit surface) |

Specs policy: [`docs/SPEC_DRIVEN_DEVELOPMENT.md`](../../docs/SPEC_DRIVEN_DEVELOPMENT.md).
When the product and `note-replication.qnt` disagree, the failing trace prints
the step, the differing variables (model vs product) and the harness calls; decide
which is wrong — never loosen `observe`.

```bash
bun run --filter @pkgs/sync-engine test       # contracts
bun run --filter @pkgs/sync-engine test:e2e   # specs/sync-engine features and the Quint model
bun run spec specs/sync-engine/note-writing.feature
bun run spec specs/sync-engine/note-replication.qnt
```

| Pool action layer | Actions (`pool.*` in `harness/scenario/sync-actions.ts`) |
|-------------------|------------------------------------------------------|
| Domain (injected `SyncApp`) | `domain` — one `DomainOp` drawn from `app.domainOpArbs` |
| Server OOB (injected `SyncApp`) | `server` — one `ServerOp` drawn from `app.serverOpArbs` |
| Connectivity triad | `online`, `offline`, `connect`, `disconnect`, `background`, `foreground` |
| Network | `partition`, `restoreNetwork`, `hold`, `release`, `setFaults` |
| Boundary faults | `armHttpFault`, `armCrashAt`, `publishFault`, `auth`, `protocolCut` |
| Lifecycle / storage | `crash`, `restart`, `clearLocalData`, `subscribe`, `skew`, `tamperLocalStorage`, `armStoragePressure`, `addPeerEngine` |

App fixtures (e.g. example) supply `domainOpArbs` and `serverOpArbs` under
`src/harness/example-app/` — the system kernel has no app nouns. Every pool
action has a `sample`, so `explore` walks the whole catalog and slice PBTs pick
subsets by name (`actions: ['domain', 'offline', 'restoreNetwork']`).

`queries/shared/tiger-invariants.ts` lists harness-checked invariants; see
[Tiger Style](#tiger-style-safety--bounds) for the full error/bound matrix.

### Deterministic harness

TigerBeetle-style deterministic simulation in `src/harness/` (exported as
`@pkgs/sync-engine/harness`). **One seed → identical timeline.** Systems are
**owned by `@pkgs/harness`**:
`exampleSystem` (a `defineSystem` over `createSyncHarness`) declares the
broker/server/client topology, args, action pool, and model, and tests drive it
with `exampleSystem.explore(...)` / `.replay(...)` / `.run(...)` + `s.apply` /
`s.read`; fuzz is a seeded `s.randomActions` over the pool. Assert **live domain
rows only** — never framework tables or private modules.

```text
seed ──► SeededRng ──► Network (delay/loss/reorder/replay)
  │                         │
  └──► VirtualClock ──► Scheduler ──► timers + delayed deliveries
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
              HTTP bridge     PubSub broker    Harness server
                    │               │         (:memory: SQLite)
                    └───────┬───────┘
                            ▼
              Real createLocalSyncEngine + :memory: SQLite clients
```

| Boundary | Implementation |
|----------|----------------|
| Time | `s.advanceTime` / `s.until` / `s.never` over Runtime virtual clock + scheduler |
| Wall clocks | `s.apply(skewClock, id, ms)` / `s.read(nodeNow, id)` |
| Timers | `createTimers` implements the production `Timers` port |
| RNG | `createSeededRng` (splitmix64); `fork(label)` for independent streams |
| Network | `s.apply(net, nodeId, traffic, state)` — hold / down / fault profiles |
| HTTP | `createHarnessHttpClient` / `bindHarnessHttpServer` over the mesh (`sync` traffic) |
| PubSub | `createHarnessPubSubBroker` delayed fanout over the same mesh (`live` traffic) |
| Server | Bun `:memory:` SQLite + framework DDL + schema reconcile |
| Clients | Bun `:memory:` SQLite + real `createLocalSyncEngine` |

**Not simulated:** disk bitflips, real EMQX, Cloudflare Worker runtime. Harness
server uses SQLite dialect; production server is Postgres.

Scenarios are plain `bun:test` (`describe` / `test` / `test.each`). Cleanup uses
`await using` / `using` (`AsyncDisposable` / `Disposable`). No custom test
runner. Failures from `expectInSync` / `s.until` / `s.never` / property
asserts embed `seed=<hex>` and virtual `now=` for replay.

**Five concepts:**

1. **Time** — `s.advanceTime(ms)`,
   `s.until(read, { maxMs?, pred? })` (positive wait; wrap args in a
   zero-arg read),
   `s.never(read, { forMs })` (fail if the predicate holds within the
   window). Thin example helpers `untilExample` / `neverExample` only set default
   `stepMs`. All scheduler-driven — never wall-clock.
2. **Network** — `s.apply(net, nodeId, traffic, state)` /
   `hold` / `release` / `partition` / `restoreNetwork`; settle neutralizes
   outstanding net effects.
3. **Node** — `s.apply(crash, id)` / `crashAt` / `restart` /
   `auth` / `skewClock` (and related fault pins). Server id is `'server'`.
4. **Client** — `s.apply(mutate, id, mutation, args)`, connectivity triad
   (below), `subscribe`, `outcome` / `rejections` reads, `nudge`
   (rare; needs `// nudge:` comment).
5. **Revive + observe** — `expectInSync(run)` (or `recoverAll` + `s.until(inSync)`) clears holds/partitions/faults, forces
   online/foreground/connect, wakes uploads + refreshes, diffs each client vs
   server (differential oracle). Does **not** absorb negative-timing windows —
   use `s.never` / `neverExample` for those.

#### Connectivity triad (do not conflate)

| API | Layer | Use when |
|-----|-------|----------|
| `s.apply(online, id, false\|true)` | AppLifecycle intent | `requiresOnline` gate; queue-while-offline that still allows engine session |
| `s.apply(disconnect, id)` / `connect` | Engine session | Stop/start upload runtime + push attach (auth revoke / upload-stop) |
| `s.apply(net, id, traffic, state)` | Network reality | Partition, hold sync/live, packet loss |

#### Quick start

```ts
import { describe, expect, test } from 'bun:test';
import {
  exampleSystem,
  addClient,
  expectInSync,
  liveNote,
  mutate,
  setNote,
} from '../apps/example';

describe('example', () => {
  test('mutate staysInSync', async () => {
    await using s = await exampleSystem.run({
      seed: 42,
      args: { clientCount: 0 },
    });
    await s.apply(addClient, 'alice');
    await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'hi' });
    await expectInSync(s);
    expect(await s.read(liveNote, 'alice', 'n1')).toMatchObject({
      body: 'hi',
    });
  });
});
```

PBT / system pins (`exampleSystem.explore` / `s.apply(pool.*)` / `exampleSystem.replay`):

```ts
import { gen } from '@pkgs/harness/fast-check';
import { arbSyncArgs, EXAMPLE_DST_FAULTS_HOST, exampleSystem, pool } from '@pkgs/sync-engine/harness';

// Runtime, action pool, and properties are registered on the system.
await exampleSystem.explore({
  args: gen(arbSyncArgs()),
  episodes: 12,
  steps: 14,
});

// Slice PBT over a few pool actions on the lossy runtime.
await exampleSystem.explore({
  runtime: EXAMPLE_DST_FAULTS_HOST,
  actions: ['domain', 'offline', 'online', 'restoreNetwork'],
  episodes: 8,
  steps: 12,
});

// Scripted pin — the same pool actions, applied by hand.
await using s = await exampleSystem.run({ seed: 42, args: { clientCount: 2 } });
await s.apply(pool.domain, {
  clientId: 'c0',
  mutation: 'setNote',
  args: { id: 'n0', body: 'x', title: '' },
});
await s.apply(pool.restoreNetwork);
```

Scoped hold + latency budget + negative window:

```ts
{
  await s.apply(pauseNetwork, 'bob', 'sync');
  const t0 = await s.read(nodeNow, 'bob');
  await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'x' });
  await s.never((s) => liveNote(s, 'bob', 'n1'), {
    forMs: 200,
    pred: (n) => n != null && n.deletedAt == null,
  });
  await s.apply(resumeNetwork, 'bob', 'sync');
  await s.until((s) => liveNote(s, 'bob', 'n1'), {
    pred: (n) => n != null && n.deletedAt == null,
  });
  const at = await s.read(nodeNow, 'bob');
  expect(at - t0).toBeLessThan(200);
}
await expectInSync(s);
```

Lightweight clock/timers without a full kit:

```ts
import { createHarnessTestDriver } from './test-driver';
const harness = createHarnessTestDriver();
await harness.runFor(150);
```

#### Traffic classes

| Traffic | Intent |
|---------|--------|
| `live` | Realtime peer updates (pushes / fanout) |
| `sync` | Pull / request-response hydration |
| `all` | Both |

```ts
await s.apply(net, 'bob', 'sync', 'hold');
await s.apply(net, 'bob', 'live', 'down');
await s.apply(net, 'bob', 'live', { dropProbability: 1 });
```

**Live is unreliable by design.** Named tests assert domain convergence after
settle, not push ordering. Prefer `hold` on `sync` to script push↔query races.

#### Clock skew

```ts
await s.apply(skewClock, 'alice', -60_000);
await s.apply(skewClock, 'server', 60_000);
await s.read(nodeNow, 'alice'); // base + skew
```

#### Args

**System open** — `exampleSystem.run({ seed, args })`. `args` is a partial
overlay on the system defaults; the registered `virtual` host supplies the clock
and network:

| Arg | Default | Meaning |
|------|---------|---------|
| `seed` | required | Root RNG seed (`number \| bigint \| string`) |
| `args.clientCount` | `2` | Booted `c0..` clients (`0` for scripted pins that `addClient`) |
| `args.rowImageFanout` | `true` | Live pushes apply row images when `true` (kit/`!== false` semantics) |
| `args.liveResendOnReconnect` | `false` | Buffer last topics while peer closed; flush on re-subscribe |
| `args.bufferOutboundLive` | `false` | Queue optimistic fanout while push detached |
| `args.sessionQuery` | pack default | Override the hydration query (e.g. the large catalog) |
| host network | reliable | Register a second host with `syncVirtual(toKernelFaults({ … }))` |

Custom faults: `networkDefaults: toKernelFaults({ ...RELIABLE_FAULTS, latencyMeanMs: 30 })`.

**Network faults** (`HarnessFaultOptions` in `faults.ts`):
`latencyMeanMs` / `latencyJitterMs`, `dropProbability`,
`packetReplayProbability`, `reorderWindow`, plus unused partition probability
fields for fuzz profiles.

**Client / node lifecycle:** `addClient`, `node(id).crash` / `restart` /
`auth`, plus the connectivity triad above. Use
`sessionQuery: SPACE_MEMBERSHIP_SESSION` for room-topic membership scenarios.
`pubsubRemakeCount()` / `subscribedTopics()` for membership asserts.
`isSchedulerQuiescent()` / `pendingEventCount()` observe the harness timer heap
(scheduler is on the run session).

**Boundary crash arms** (`node(id).crash({ at })` returns Disposable):

| Event | Boundary |
|-------|----------|
| `afterNextSyncResponseDelivered` | Sync HTTP reply delivered to client RPC |
| `afterNextMutateResolved` | After `mutate()` resolves |
| `afterNextMutationsPostAccepted` | Mutations handler finished; before response sent |
| `onNextTimerTickWhileSyncUndelivered` | Next timer tick (use with sync hold) |
| `onNextEngineOpenAfterCacheWipe` | Local migrate after cache wipe |

**HTTP / publish faults:** `node(id).httpFault(fault)`,
`node('server').publishFault(count)` — both `Disposable`.

**Server ops:** `server.pruneArtifacts(olderThanMs)`,
`server.notifyFanout({ topics, tables, label })`. Domain fixture
`writeNoteBody(server, { id, body, notify? })` (`notify: false` pins the
non-mutation path; reconcile tick heals).

**Demoted / internal (lab + harness; CI-banned in scenarios):** raw kit
handles, `getSyncEngine` (except account-switch pool), `postMutations` (except
duplicate-mutation-id). Prefer observations (`liveNote`, `rows`, `outcome`) and
pin actions.

**Fuzz / replay** — a seeded `s.randomActions` over the pool (or an `actions:` slice),
then `expectInSync`; the same seed must reproduce identical `w.choices`:

```ts
await using s = await exampleSystem.run({ seed: 42, args: { clientCount: 3 } });
const w = await s.randomActions({ steps: 40, time: { weight: 1, minMs: 0, maxMs: 40 } });
await expectInSync(s);
```

`explore` failures carry a shrunk `Recording`; replay with `exampleSystem.replay(repro)`.

#### Scenario-writing guide (patterns, not primitives)

Keep these as snippets — do **not** promote into API members:

**Warm baseline**

```ts
await s.apply(mutate, 'alice', setNote, { id: 'warm', body: 'w' });
await expectInSync(s);
```

**Offline queue (AppLifecycle)**

```ts
await s.apply(online, 'alice', false);
await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'queued' });
await s.never((s) => liveNote(s, 'server', 'n1'), {
  forMs: 50,
  pred: (n) => n != null && n.deletedAt == null,
});
await s.apply(online, 'alice', true);
await expectInSync(s);
```

**Engine offline queue (session stop)**

```ts
await s.apply(disconnect, 'alice');
await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'queued' });
await s.apply(connect, 'alice');
await expectInSync(s);
```

**Sync hold race**

```ts
{
  await s.apply(pauseNetwork, 'bob', 'sync');
  await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'x' });
  await s.never((s) => liveNote(s, 'bob', 'n1'), {
    forMs: 300,
    pred: (n) => n != null && n.deletedAt == null,
  });
  await s.apply(resumeNetwork, 'bob', 'sync');
}
await expectInSync(s);
```

**Partition restoreNetwork**

```ts
{
  await s.apply(partition, 'bob');
  await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'x' });
  await s.apply(restoreNetwork);
}
await expectInSync(s);
```

**Crash + preserve DB**

```ts
await s.apply(crash, 'bob');
await s.apply(restart, 'bob', { preserveLocalDb: true });
await expectInSync(s);
```

**Subscribe scope**

```ts
await s.apply(subscribe, 'alice', 'notesDenied', {});
// … asserts …
await s.apply(unsubscribe, 'alice', 'notesDenied', {});
```

**Flicker window** (keep explicit ms; do not absorb into settle)

```ts
for (let i = 0; i < 8; i += 1) {
  await s.advanceTime(25);
  expect(await s.read(liveNote, 'alice', 'n1')).toMatchObject({
    body: 'optimistic',
  });
}
```

**Heal-by-refetch pin**

```ts
// nudge: reason under test
await s.apply(nudge, 'bob');
```

#### Harness layout

```text
src/harness/                             # exported as `@pkgs/sync-engine/harness`
  …                                  # harness (rng, network, bridges, server, …)
  scenario/                          # boot (runtime + S), pool + pin actions, reads
  example-app/                       # example fixture

tests/                               # black-box against package exports
  …                                  # scenario pins + harness
```

Full per-file scenario catalog: [Scenario catalog](#scenario-catalog) at the
bottom of this README.

---

## Invariants / non-goals (do not “fix” these)

1. No domain hard deletes — soft-delete only.
2. No peer mutation replay — realtime = Room DO. Row-image fanout (server
   facts only) is allowed as a lossy optimization; snapshots define correctness.
3. Fanout messages may be lost, reordered, duplicated, or ignored at any time
   without affecting convergence.
4. Fanout row images are produced from post-replay reads only, never from
   mutation args or peer-executed logic.
5. No `_row_scopes` / multi-scope absence GC.
6. No full write-epoch / `acked_epoch` barrier — ack deletes queue row;
   flicker is prevented by sync generation fence on ack.
7. No delta / resync / gone **query** wire shapes (`POST /query` stays
   `ok` / `not_modified` / `denied`).
8. No feature REST for sync-scoped data (tiny exception list in `AGENTS.md`).
9. No deep public imports — five entrypoints only.
10. No dependency patches; no biome size-rule disables for app code.
11. No pkgs → libs/apps imports.
12. Actor identity comes from session auth only (never trust client-supplied
    actor for authorization).

---

## How to evaluate a design proposal

Agents recommending changes should answer:

1. **Which locked decision does this touch?** If any, call it out explicitly.
2. **Does it add a table, wire status, or code path?** Justify vs deleting
   something instead.
3. **What failure mode does it fix?** Partition, revoke, reject, large DB,
   flicker, wrong topic, etc.
4. **What new failure mode does it introduce?**
5. **Can CI enforce the new rule?** (prefer gates over comments)
6. **Does product UI SQL still make sense?** (live filters, paint gate)
7. **Is Room DO the right place instead?** (realtime play / presence)
8. **Which surface’s `rowImageFanout` default changes?** (package false /
   product true / harness true — do not conflate)
9. **Does a scenario already cover it?** Prefer extending harness over new
   production flags.

Good proposals usually: prune policy, CI for query tombstone contract, delete
dead legacy upload path, measure snapshot sizes, improve rejection UX.
Suspicious proposals usually: restore peer fanout, restore `_row_scopes`, add
delta mode “for completeness,” raise in-flight polls without evidence.

---

## Common pitfalls

- Filtering `deleted_at IS NULL` inside `defineQuery.run` → tombstones never
  sync → stale live rows after soft-delete.
- Forgetting `deleted_at` in SELECT → upsert won’t update deletion state.
- UI query missing live filter → soft-deleted rows appear in UI.
- Domain write outside mutations without `notifyChannels` → peers briefly
  stale until reconcile tick / foreground / reconnect (prefer notify for
  fast path; tick is the safety net).
- `DELETE FROM` in a mutation → `NO_HARD_DELETE`.
- Expecting unsubscribe to wipe domain rows → only `sync_engine_scope_meta` clears.
- Expecting reject alone to revert domain rows → need a subsequent merge.
- Expecting multi-device domain edits &lt;100ms → use Room DO.
- Importing `@pkgs/sync-engine/src/...` → not public.
- Hand-declaring write sets or wake topics — derive from AST capture + topic map.
- Assuming package `rowImageFanout` defaults on — product opts in; package
  defaults off.
- Reintroducing boot vs shell subscription special cases without measuring
  paint cost.
- Conflating `checkpoint` / `pushSeq` / mutation `seq` (see Sequences below).

---

## Glossary

| Term | Definition |
|------|------------|
| Scope | One subscribed `(queryName, params)` identity (`scope_hash`) |
| Session queries | Scopes held for engine lifetime; `waitForFirstSync` waits on them (tests/harness) |
| Paint gate | Product `SyncEnginePaintGateContext` after local SQLite open |
| Tombstone | Domain row with `deleted_at` set; still synced |
| Push | Pubsub message that wakes overlapping query scopes (formerly 'nudge') |
| Row-image fanout | Lossy optional `rows` on push; snapshots remain truth |
| Optimistic fanout | Client MQTT hint (`optimistic: true`) before server replay |
| Replay | Server re-executes mutation SQL idempotently |
| Rebase | Client re-runs pending mutation SQL after a merge |
| Durable / cache | Local tables that survive vs wipe on epoch/cache clear |

### Sequences

Three distinct monotonic sequences — do not conflate them:

| Name | Scope | Where |
|------|-------|-------|
| `checkpoint` | Per **scope** (query snapshot version) | `sync_engine_scope_meta.last_checkpoint`, `POST /query` request/response |
| `pushSeq` | Per **topic** (push counter) | `sync_engine_topic_seq.n`, `PushMessage.pushSeq`, `sync_engine_push_applied.last_push_seq`, `topicPushSeqs` |
| `seq` | Per **client** (mutation upload order) | `sync_engine_mutations.seq`, upload wire `seq` / `ackSeq` |

---

## Related docs

- Root [`AGENTS.md`](../../AGENTS.md) — monorepo hard rules
- Product defs: `libs/<feature>/src/shared/{queries,mutations}/`
- Product client wiring: `apps/client/src/sync/create-local-sync-engine.ts`
- Product API wiring: `apps/server/src/sync/sync-app.ts`
- Topics: `libs/runtime/src/root/sync-topics.ts`
- Schema: `libs/runtime/src/root/app-schema.ts`

---

## Scenario catalog

Behavior lives in [`specs/sync-engine/`](../../specs/sync-engine/) (one feature per
capability, steps listed in [`STEPS_CATALOG.md`](./STEPS_CATALOG.md)); the
replication rules in [`specs/sync-engine/note-replication.qnt`](../../specs/sync-engine/note-replication.qnt)
(invariants `invNoDoubleApply`, `invInOrderPerPerson`, `invNoLostWrites`,
`invTombstonesKept`, `invOnlyForbiddenRefused`, `invOnlineAgree`,
`invRetryIsDuplicate`, `invHealConverges`); contracts under `tests/`.
Porting history: [`docs/SPEC_MIGRATION_INVENTORY.md`](../../docs/SPEC_MIGRATION_INVENTORY.md).
