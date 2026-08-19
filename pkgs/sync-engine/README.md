# `@pkgs/sync-engine`

Local-first sync between **client SQLite** and **server Postgres**.

**How to use this file:** A blank agent (or human) with *only* this README
should be able to (1) explain the system correctly, (2) review PRs against
invariants, and (3) discuss design / recommend improvements without inventing
history. Prefer this doc over training data or old chat transcripts.

Related: root [`AGENTS.md`](../../AGENTS.md). This file is the single design
doc for `@pkgs/sync-engine` (system + deterministic sim + scenario catalog) —
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
shared play lives on the **Room Durable Object** (spaces). Sync-engine is the
authoritative **durable domain mirror** (friends, profile, spaces metadata,
puzzle catalog/progress, client config, inbox rows, auth entities).

**Latency goal:** sub-200ms p95 peer-visible domain writes (device A mutates →
device B’s SQLite reflects it) via immediate upload drain + row-image fanout.
**Anti-goal:** sub-50ms shared realtime state stays on the Room DO.

---

## Design goals (priority order)

When recommending changes, optimize in this order unless the user overrides:

1. **Correctness under partition** — offline mutate + later upload; idempotent
   replay; auth revoke wipes local DB.
2. **Simplicity of the sync model** — fewer tables, fewer wire shapes, fewer
   special cases beat micro-optimized latency.
3. **Local-first UX** — optimistic apply is instant; UI reads SQLite only.
4. **Operability** — CI gates catch policy drift; deterministic sim catches
   races; four public entrypoints only.
5. **Efficiency** — hash/`not_modified`, push table filtering, coalesce,
   single-flight merge, row-image fanout. Secondary to 1–4.

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
| Client engine + React hooks | Session query list, paint gate wiring |
| Push apply / optimistic fanout | MQTT/EMQX pubsub adapter |
| Deterministic sim + scenarios | Product REST exceptions |

**Tier rule:** this is a flat `pkgs/` package — **no** product imports
(`@libs/*`, `gamezilla`, apps). Product topics and schemas live in `@libs/runtime`
/ feature packages; the engine only sees registries + SQL clients + pubsub
ports.

---

## Public API (four entrypoints only)

Deep imports under `src/` are **not** public. `package.json` `exports`:

| Import | Role |
|--------|------|
| `@pkgs/sync-engine/client` | Expo / React Native engine, React hooks, HTTP client |
| `@pkgs/sync-engine/server` | Hono sync app (`POST /query`, `POST /mutations`), `notifyChannels` |
| `@pkgs/sync-engine/shared` | `defineQuery` / `defineMutation`, registries, soft-delete helpers, **protocol v3**, opaque migrate |
| `@pkgs/sync-engine/test` | In-memory engine + sim/test controls (`SCHEMA_EPOCH`, controllable lifecycle) |

Full contract map, cutover runbook, authoring drift close-out, and refactor-freedom
checklist: [`CONTRACTS.md`](./CONTRACTS.md). Checked-in API reports:
[`api-reports/`](./api-reports/).

### Contract classes (what you may depend on)

| Class | Promise | Examples |
|-------|---------|----------|
| **Code API** | Four entrypoints; coordinated monorepo refactors OK | `createLocalSyncEngine`, hooks, `createSyncApp`, `notifyChannels` |
| **Wire protocol** | Cross-version freeze (`src/protocol/v2.ts`); shape changes need a version bump | `QueryResponse`, mutation batch, `PushMessage`, `MAX_*`, `upgrade_required` |
| **Local domain SQL** | Deliberate local-first contract | Domain tables, `deleted_at`, `LIVE_ROW_SQL`, `useQuery` |
| **Extension** | Domain plug-in vocabulary | `defineQuery` / `defineMutation`, `defineTopicMap`, `MutationEnv` |
| **Host wiring** | Injected ports | `postQueries`/`postMutations` (protocol-derived), pubsub, auth, SQL, lifecycle |
| **Internal** | Free to change; must not leak | Framework tables, merge/upload, seq alloc, hash algorithms, epoch |

**Do not depend on:** framework table names/shapes (`sync_engine_mutations`, `sync_engine_write_rejections`, …),
`SCHEMA_EPOCH` (except via `/test`), DDL text, `allocateTopicPushSeq`, or deep
`@pkgs/sync-engine/src/...` imports. Use `mutationOutcome` / `listRejections` /
`pendingMutationCount` instead of SQL on framework tables.

### Notable public symbols

**client:** `createLocalSyncEngine`, `createSyncHttpClient`, `createSyncEnginePool`,
`SyncEngineProvider`, `useSyncEngine`, `useSyncEngineInstance`, `useQuery`,
`MutationClientProvider`, `useMutationClient`, `SyncEnginePaintGateContext`,
`AppLifecycle` **types**, status types, `SyncEngine.mutationOutcome` /
`listRejections` / `pendingMutationCount`. Optional create opts `schemaEpoch` /
`onLocalMigratePhase` for sim (constants live on `/test`).

**server:** `createSyncApp`, `notifyChannels({ pubsub, sql, topics, … })` (await
while `sql` is connected; allocates pushSeqs then fire-and-forgets publish),
`isAuthErrorBody`, `SyncAppAuth`, `pruneMutationArtifacts`.

**shared:** `defineQuery`, `defineMutation`, registries, `MutationError`,
`LIVE_ROW_SQL`, `softDeleteById`, `applyFrameworkServerDdl` (opaque),
protocol types + `MAX_*` + `SYNC_PROTOCOL_VERSION`,
`defineTopicMap`, `assertChannelExhaustiveness`, `assertDomainTablesAvoidFrameworkNames`.

**test:** `createInMemorySyncEngine`, `SCHEMA_EPOCH`, `createControllableLifecycle`,
`withFrameworkMutations` (escape hatch; factories already merge).

**Not public:** `merge.ts`, `SubscriptionRuntime`, `MutationUploadQueue`, `attachPush`,
`allocateTopicPushSeq*`, `FRAMEWORK_*` DDL/constants, `publishPushMessages`,
`runQuery`, `replayMutation`, anything under `src/sim/`.

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
bun run ci:sync-engine-public-api      # api-reports/*.txt
bun run ci:sync-engine-protocol-freeze # protocol-v2.sha256
bun run ci:sync-engine-framework-leak  # no framework names in apps/libs/inbox
bun run ci:sync-engine-blackbox-tests
bun run ci:no-local-tables
bun run ci:channel-exhaustiveness
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
│ apps/api  createSyncApp (package mounts /query, /mutations)  │
│  runQuery / processMutationsBatch / notifyChannels           │
│  Postgres (domain + sync_engine_mutations_applied + sync_engine_write_rejections)   │
│  product opts rowImageFanout: true                           │
└───────────────────────────┬─────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
   Room DO             Stripe/etc            REST exceptions
   (realtime play)     (external)            friends/search
```

**Wire path layering:** the package Hono app mounts `POST /query` and
`POST /mutations`. The product HTTP client defaults to `/api/query` and
`/api/mutations` (host mount prefix). Both names appear in docs — they are
the same routes at different layers.

**Absolute REST exceptions** (do not casually grow — see `AGENTS.md`):
`POST /friends/search`, Stripe/external APIs.
Username claims and profile bootstrap are **mutations**, not REST.

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
  name: 'friends_friendships',
  params: z.object({}), // optional; default empty object
  // hydrates derived from first run() return keys — not authored
  // limit omitted → DEFAULT_QUERY_LIMIT (2000); no inline LIMIT in run SQL
  entryChannel: undefined, // omit → host defaultEntryChannel; false = reconcile-only
  authorize: async (ctx) => ..., // real authz only; deny-anon by default
  run: async (ctx, params) => ({ friends_friendships: rows }),
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
  name: 'removeFriend',
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
1. Local schema migrate (framework + domain via `@pkgs/db-schema/sqlite`;
   `SCHEMA_EPOCH = 8`)
2. `SubscriptionRuntime` — coalesce → `POST /query` → merge
3. `MutationUploadQueue` — drain `sync_engine_mutations` → `POST /mutations`
4. Optional `attachPush` — MQTT topics from held-row topic-map ∪ entryChannel
5. Table-change bus + `watch` / React `useQuery`

**Injected ports** (product or sim): `db`, `postQueries`, `postMutations`,
`getMutationEnv`, `getClientId`, `isAuthRevoked`, `deleteDatabase`, optional
`push`, `lifecycle`, and sim-only `now` / `random` / `timers` / `createId`.

**Session queries vs paint gate:**
- `sessionQueries` are held for the engine lifetime; `waitForFirstSync()`
  awaits their first successful sync.
- `paintReady` is **not** computed inside the engine. Product boot provides
  `SyncEnginePaintGateContext` (default `true`); `useSyncEngine().paintReady`
  reads that context (identity-match gate during account switch).

Product session list today (`apps/client` `SESSION_QUERIES`): `ownUser`,
`ownDevices`, `ownExternalAccounts`, `ownProfile`, `clientConfig`,
`openSpaceSessions`, `mySpaces`, `mySpaceUsers`, `friends_friendships`,
`friendRequests`, `userBlocks`, `inboxActive`, `chessPuzzleProfile`,
`chessPuzzleInteractions`. Feature screens may still `subscribeQueries`
dynamically (e.g. `chessPuzzlePool`).

### Topics (product convention)

Host registers `defineTopicMap` (`@libs/runtime/shared/app-topic-map`) plus
`defaultEntryChannel`. Helpers in `@libs/runtime/shared/sync-topics`:

| Helper | Topics |
|--------|--------|
| `userChannels` / `userTopic` | `user:{actorId}` |
| `roomTopic` | `room:{spaceId}` |
| `clientConfigChannels` | singleton client-config topic |

Pushes carry optional `tables` from **AST capture** so the client wakes only
scopes whose derived hydrate tables overlap.

### Channel exhaustiveness

CI `ci:channel-exhaustiveness` statically checks that every hydrated domain
table has a topic-map entry (or is reconcile-only with empty `entryChannel`).
Missed `notifyChannels` on non-mutation server writes remains a runtime
footgun for *latency* — prefer mutations / notify; the client reconcile tick
is the safety net so peers do not stay forever-stale.

### `rowImageFanout` defaults (important)

| Surface | Default | Notes |
|---------|---------|-------|
| `createSyncApp({ rowImageFanout })` | **false** | Opt-in |
| Client `push.rowImageFanout` | **false** | Opt-in |
| Product Gamezilla (`apps/*`) | **true** | Both API + client set true |
| `openSimWorld` | **true** | `!== false` |

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

Applied by `applyFrameworkServerDdl` at migrate time (not domain
`defineTable` / `registerTables`):

| Table | Purpose |
|-------|---------|
| `sync_engine_mutations_applied` | Idempotency + audit (`applied` / `rejected`) |
| `sync_engine_write_rejections` | Permanent failures keyed by `client_id` (= device id) |
| `sync_engine_topic_seq` | Per-topic monotonic push sequences (`n` bigint) |

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
- Safety-net reconcile tick (`QUERY_RECONCILE_INTERVAL_MS`, sim shorter) → `wakeAll`
- Session queries held for engine life; `waitForFirstSync` waits on them

### `attachPush`

- Topics from active query `channels(ctx)`
- **Initial attach** remakes pubsub once (topics subscribed at birth)
- **Membership / topic churn** syncs incrementally (subscribe add / unsubscribe
  remove) — does **not** `close()` the MQTT session (avoids sessionExpiry-0
  queue wipe during create-after-end peer fanout)
- Topic sync **waits until local `sync_engine_mutations` drain** (membership pending gate)
- After incremental topic add/remove → `wakeAll()` once (heal subscribe races)
- Reconnect → `wakeAll()`
- Local `spaces` / `spaces_users` changes refresh membership topics
- Optional `bufferOutboundLive` queues optimistic fanout while detached

---

## Soft-delete policy (hard rule)

| Surface | Rule |
|---------|------|
| Domain mutations | `UPDATE … SET deleted_at`; never `DELETE FROM` |
| `defineQuery.run` | **Include** tombstones (`SELECT …, deleted_at`, no live filter) |
| UI / `useQuery` SQL | Filter `deleted_at IS NULL` (or `LIVE_ROW_SQL`) |
| Merge | Upsert `deleted_at` as a normal column |
| Framework tables | May hard-delete |
| CI | `bun run ci:no-domain-hard-delete` |

Inbox is slightly different product-wise (`active` flag) but still a sync query;
don’t invent a second delete model without review.

---

## Consistency & failure model

| Event | Behavior |
|-------|----------|
| Offline mutate | Applies locally, queues `sync_engine_mutations`, UI updates via watch |
| `requiresOnline` offline | Returns `{ ok: false, code: 'OFFLINE' }`; no queue |
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

- Local **prune / size policy** for catalogs + old tombstones (chess puzzles)
- Stronger CI that `defineQuery.run` selects `deleted_at` / omits live filters
- Narrower sessionQueries / staged paint gate if first paint is too slow
- Incremental/delta protocol *if* full snapshots become a measured bottleneck
- Server-side tombstone windows / “deleted since checkpoint” for huge tables
- Sim coverage expansion / fix stale `TIGER_INVARIANTS` name
  (`scope-complete-membership` still listed though `_row_scopes` is retired)
- Clearing stale locals that left a scope without soft-delete (product policy)
- Delete dead `process-upload-with-mutations.ts` (zero importers; legacy CRUD)

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
   (disturbs concurrent multi-writer settle in sim).
4. **Full snapshot cost** — large `chessPuzzlePool` / interactions payloads.
   `not_modified` helps when unchanged; first fetch / rating band change is
   heavy. Deltas are a last resort after measuring.
5. **Membership topic sync** — incremental subscribe/unsubscribe (no MQTT
   remake). Waits for pending `sync_engine_mutations` drain; tiny subscribe-race window
   healed by `wakeAll`; true dispose still closes with sessionExpiry 0.
6. **Paint waits on all session queries** — correct single lifetime model;
   may delay first paint vs old boot/shell split. Product `paintReady` is a
   separate identity-match context.
7. **Rebase swallows errors** — pending mutation that fails against new
   server state stays queued until upload reject; UI may look “stuck”
   optimistic. Product should watch `sync_engine_write_rejections`.
8. **Inbox `active` filter vs tombstones** — inbox may filter `active = true`
   (not a `deleted_at` predicate); remaining product staleness risk if rows
   are soft-deleted without clearing `active`.
9. **Prune retention window** — after `pruneMutationArtifacts` deletes an
    `sync_engine_mutations_applied` row, a late retry of the same mutation id may
    **double-apply** (pinned by `late-retry-after-prune-window-documented`).
    Keep retention longer than max client offline/retry windows, or accept
    double-apply as the documented failure mode.

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
  `@pkgs/db-schema/sqlite`; Postgres migrate separate.
- **Framework local:** `FRAMEWORK_LOCAL_DDL` + `SCHEMA_EPOCH` (= 7) in
  `queries/client/local-schema.ts`.
- **Framework server:** `FRAMEWORK_SERVER_DDL` via `applyFrameworkServerDdl`.
- **Query/mutation wire names:** breaking changes ship as a new `name`
  (e.g. `joinSpaceV2`). Protocol cutover for clients is `upgrade_required`
  (no wipe) + pending-queue preserve-and-drain — see CONTRACTS cutover runbook.
- **Cache clear:** `clearLocalData({ reason: 'cache' })` drops cache tables and
  recreates schema; durable `sync_engine_mutations` policy follows migrate helpers.
  `{ reason: 'revoked' }` is the auth-wipe path.

---

## App wiring (Gamezilla)

**Client** (`apps/client/src/sync/create-local-sync-engine.ts`)

1. Open identity SQLite → `createLocalSyncEngine({ sessionQueries, postQueries,
   postMutations, push: { rowImageFanout: true, … }, lifecycle, … })`
2. `SyncEngineProvider` + `SqlClientProvider` + `SyncEnginePaintGateContext`
3. `MutationClientProvider` with `MutationEnv` + `{ clientId: deviceId }`
4. Feature: `useQuery(sql\`… AND deleted_at IS NULL\`)` +
   `useMutationClient().mutate(def, args)`

**API** (`apps/api/src/sync/sync-app.ts`)

1. `applyFrameworkServerDdl` during migrate (opaque; no DDL text import)
2. `createSyncApp({ resolveAuth, getSql, queries, mutations, pubsub,
   rowImageFanout: true })`
3. Non-mutation DOMAIN writes must `notifyChannels({ pubsub, sql, topics, … })`

Registries: `apps/client|api/src/sync/app-queries.ts` + `app-mutations.ts`.

---

## Directory map

```text
pkgs/sync-engine/src/
  client/           # engine, merge, subscriptions, push, React, HTTP, pool
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
  sim/              # deterministic multi-client simulation (not public)
  test/             # in-memory engine
  tests/
    scenarios/      # black-box correctness (112 files)
    harness/        # sim kernel self-tests
```

---

## React hooks (client)

| Hook / API | Use |
|------------|-----|
| `useSyncEngine()` | Reactive status + `paintReady` (from paint context) + methods |
| `useSyncEngineInstance()` | Stable engine (effects/providers) |
| `useQuery(sql)` | Live SQLite watch |
| `useMutationClient()` | `mutate(def, args)` |
| `SyncEnginePaintGateContext` | Product sets identity-match gate |
| `createSyncEnginePool` | Multi-identity engine pool (account switch) |

Mutation UX (product/`@pkgs/ui`, not this package): destructive →
`MutationModal`; light → `useMutationButton`. Don’t `router.back()` from
mutation `onSuccess` — stay and let SQLite drive UI.

---

## Testing & CI

```bash
bun run --filter @pkgs/sync-engine tc
bun run --filter @pkgs/sync-engine test
bun run ci:no-domain-hard-delete
bun run ci:fanout-rows-from-reads
bun run ci:channel-exhaustiveness
bun run ci:lint
```

| Suite | Path | Role |
|-------|------|------|
| Scenarios | `src/tests/scenarios/*.test.ts` | Black-box multi-client correctness via `openSimWorld` |
| Kernel harness | `src/tests/harness/*.test.ts` | RNG / scheduler / timers; membership topic sync |
| Public unit helper | `@pkgs/sync-engine/test` | `createInMemorySyncEngine` (no full world) |

`queries/shared/tiger-invariants.ts` lists named invariants. Note:
`scope-complete-membership` is a **stale name** from the retired `_row_scopes`
era — cleanup is open design space; do not reintroduce `_row_scopes` to
“satisfy” the name.

### Deterministic simulator

TigerBeetle-style DST in `src/sim/` (not a public export). **One seed →
identical timeline.** The harness is domain-agnostic: callers inject a
`SimDomainPack`. Scenarios compose `openSimWorld` with
`src/domain-packs/notes-app/` (`notesDomainPack`); fuzz calls `runNotesSeed` from
that fixture. Assert **live domain rows only** — never framework tables or
private modules.

```text
seed ──► SeededRng ──► SimNetwork (delay/loss/reorder/replay)
  │                         │
  └──► SimClock ──► SimScheduler ──► timers + delayed deliveries
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
              HTTP bridge     PubSub broker    Sim server
                    │               │         (:memory: SQLite)
                    └───────┬───────┘
                            ▼
              Real createLocalSyncEngine + :memory: SQLite clients
```

| Boundary | Implementation |
|----------|----------------|
| Time | `runFor` / `until` / `never` over `SimClock` + `SimScheduler` |
| Wall clocks | `world.node(id).skewClock(ms)` / `.now()` (scheduler stays on base clock) |
| Timers | `createSimTimers` implements the production `Timers` port |
| RNG | `createSeededRng` (splitmix64); `fork(label)` for independent streams |
| Network | `world.net(nodeId, traffic?).set(state)` — hold / down / fault profiles |
| HTTP | `createSimHttpClient` / `bindSimHttpServer` over the mesh (`sync` traffic) |
| PubSub | `createSimPubSubBroker` delayed fanout over the same mesh (`live` traffic) |
| Server | Bun `:memory:` SQLite + framework DDL + schema reconcile |
| Clients | Bun `:memory:` SQLite + real `createLocalSyncEngine` |

**Not simulated:** disk bitflips, real EMQX, Cloudflare Worker runtime. Sim
server uses SQLite dialect; production server is Postgres.

Scenarios are plain `bun:test` (`describe` / `test` / `test.each`). Cleanup uses
`await using` / `using` (`AsyncDisposable` / `Disposable`). No custom test
runner. Failures from `assertConverged` / `until` / `never` / `checkInvariants`
embed `seed=<hex>` and virtual `now=` for replay.

**Five concepts:**

1. **Time** — `world.runFor(ms)` (documented grains / flicker loops),
   `world.until(target, { budgetMs?, stepMs? })` (positive wait; returns
   completion timestamp), `world.never(target, { forMs, stepMs? })` (fail if
   target becomes true within the window). All scheduler-driven — never
   wall-clock.
2. **Network** — `using _ = world.net(nodeId, traffic?).set('hold' \| 'down' \|
   'ok' \| FaultProfile)`; dispose restores prior state (restore-prior stack).
   Settle neutralizes outstanding net effects.
3. **Node** — `world.node(id)` with `crash({ at? })`, `restart(opts)`,
   `auth(status)`, `skewClock(ms)`, `now()`, `httpFault(fault)`,
   `publishFault(count)` (server). Server id is `'server'`.
4. **Client** — `mutate`, `db`, connectivity triad (below), `subscribe`,
   `outcome`, `rejections`, `nudge` (rare; needs `// nudge:` comment).
5. **Settle** — `assertConverged()` clears holds/partitions/faults, forces
   online/foreground/connect, wakes uploads + refreshes, diffs each client vs
   server (differential oracle). Does **not** absorb negative-timing windows —
   use `never` for those.

#### Connectivity triad (do not conflate)

| API | Layer | Use when |
|-----|-------|----------|
| `client.online(false\|true)` | AppLifecycle intent | `requiresOnline` gate; queue-while-offline that still allows engine session |
| `client.disconnect()` / `connect()` | Engine session | Stop/start upload runtime + push attach (auth revoke / upload-stop) |
| `world.net(id).set('hold'\|'down'\|…)` | Network reality | Partition, hold sync/live, packet loss |

#### Quick start

```ts
import { describe, test } from 'bun:test';
import { notesDomainPack, setNote } from '../domain-packs/notes-app';
import { openSimWorld } from '../../sim/world';

describe('example', () => {
  test('mutate converges', async () => {
    await using world = await openSimWorld({ seed: 42, domain: notesDomainPack });
    const a = await world.addClient({ id: 'alice' });
    await a.mutate(setNote, { id: 'n1', body: 'hi' });
    await world.assertConverged();
  });
});
```

Scoped hold + latency budget + negative window:

```ts
{
  using _hold = world.net('bob', 'sync').set('hold');
  const t0 = world.node('bob').now();
  await a.mutate(setNote, { id: 'n1', body: 'x' });
  await world.never(() => isLiveNote(b.db, 'n1'), { forMs: 200 });
  const at = await world.until(() => isLiveNote(b.db, 'n1'), { budgetMs: 400 });
  // … after hold released
  expect(at - t0).toBeLessThan(200);
}
await world.assertConverged();
```

Lightweight clock/timers without a full world:

```ts
import { createSimTestDriver } from './test-driver';
const sim = createSimTestDriver();
await sim.runFor(150);
```

#### Traffic classes

| Traffic | Intent |
|---------|--------|
| `live` | Realtime peer updates (pushes / fanout) |
| `sync` | Pull / request-response hydration |
| `all` | Both |

```ts
using _hold = world.net('bob', 'sync').set('hold');
using _down = world.net('bob', 'live').set('down');
using _loss = world.net('bob', 'live').set({ packetLossProbability: 1 });
```

**Live is unreliable by design.** Named tests assert domain convergence after
settle, not push ordering. Prefer `hold` on `sync` to script push↔query races.

#### Clock skew

```ts
using _a = world.node('alice').skewClock(-60_000);
using _s = world.node('server').skewClock(60_000);
world.node('alice').now(); // base + skew
```

#### Knobs

**World open** (`OpenSimWorldArgs` on `openSimWorld`):

| Knob | Default | Meaning |
|------|---------|---------|
| `seed` | required | Root RNG seed (`number \| bigint \| string`) |
| `faults` | `RELIABLE_FAULTS` | Omit unless customizing — bare `faults: RELIABLE_FAULTS` is banned by CI |
| `sampleFaults` | `false` | Ignore `faults`; sample lossy profile from `rng.fork('faults')` |
| `rowImageFanout` | `true` | Live pushes apply row images; `false` → wake query refetch |
| `liveResendOnReconnect` | `false` | Drop live while peer closed; `true` buffers last topics and flushes on re-subscribe |
| `bufferOutboundLive` | `false` | Skip optimistic fanout while push detached; `true` queues and flushes on reconnect |
| `localSchema` / `mutationRegistry` / `queryRegistry` / `sessionQuery` | domain pack | Override server+default client registries/schema for drift scenarios |

Custom faults: `faults: { ...RELIABLE_FAULTS, oneWayDelayMeanMs: 30 }` (spread OK).

**Network faults** (`SimFaultOptions` in `faults.ts`):
`oneWayDelayMeanMs` / `oneWayDelayJitterMs`, `packetLossProbability`,
`packetReplayProbability`, `reorderWindow`, plus unused partition probability
fields for fuzz profiles.

**Client / node lifecycle:** `addClient`, `node(id).crash` / `restart` /
`auth`, plus the connectivity triad above. Use
`sessionQuery: SPACE_MEMBERSHIP_SESSION` for room-topic membership scenarios.
`pubsubRemakeCount()` / `subscribedTopics()` for membership asserts.
`isSchedulerQuiescent()` / `pendingEventCount()` observe the sim timer heap
(use instead of `world.scheduler`).

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
`server.notifyFanout({ topics, tables, label })`. Notes fixture
`writeNoteBody(server, { id, body, notify? })` (`notify: false` pins the
non-mutation path; reconcile tick heals).

**Demoted / internal (lab + harness; CI-banned in scenarios):** `world.clock`,
`world.rng`, `world.scheduler`, `world.network`, `runUntilIdle`,
`getSyncEngine` (except account-switch pool), `postMutations` (except
duplicate-mutation-id). Optional combinators `untilAll` / `untilAny` stay
exported but are not core concepts.

**Fuzz / replay** (`runNotesSeed` in `domain-packs/notes-app`):

| Knob | Default | Meaning |
|------|---------|---------|
| `seed` | required | Universe seed |
| `clientCount` | `2` | Clients `c0..cN-1` |
| `steps` | `40` | Workload actions |
| `sampleFaults` | `false` | Apply sampled default faults after clients up |
| `SYNC_SIM_SEED` | — | Env: single decimal seed replay |
| `SYNC_SIM_SEEDS` | — | Env: comma-separated decimal seeds |

Fuzz failures print `seed=<hex>`. Replay:

```bash
SYNC_SIM_SEED=42 bun test pkgs/sync-engine/src/tests/scenarios/seeded-workload-fuzz-determinism.test.ts
```

```ts
import { runNotesSeed } from '../domain-packs/notes-app';
await runNotesSeed({ seed: 0x2a, steps: 16 });
```

#### Scenario-writing guide (patterns, not primitives)

Keep these as snippets — do **not** promote into API members:

**Warm baseline**

```ts
await a.mutate(setNote, { id: 'warm', body: 'w' });
await world.assertConverged();
```

**Offline queue (AppLifecycle)**

```ts
a.online(false);
await a.mutate(setNote, { id: 'n1', body: 'queued' });
await world.never(() => isLiveNote(world.server.db, 'n1'), { forMs: 50 });
a.online(true);
await world.assertConverged();
```

**Engine offline queue (session stop)**

```ts
await a.disconnect();
await a.mutate(setNote, { id: 'n1', body: 'queued' });
await a.connect();
await world.assertConverged();
```

**Sync hold race**

```ts
{
  using _hold = world.net('bob', 'sync').set('hold');
  await a.mutate(setNote, { id: 'n1', body: 'x' });
  await world.never(() => isLiveNote(b.db, 'n1'), { forMs: 300 });
}
await world.assertConverged();
```

**Partition heal**

```ts
{
  using _down = world.net('bob').set('down');
  await a.mutate(setNote, { id: 'n1', body: 'x' });
}
await world.assertConverged();
```

**Crash + preserve DB**

```ts
await world.node('bob').crash();
const bob = await world.node('bob').restart({ preserveLocalDb: true });
await world.assertConverged();
```

**Subscribe scope**

```ts
{
  using sub = a.subscribe('notesDenied', {});
  await world.until(sub.ready);
  // … asserts …
} // dispose unsubscribes
```

**Flicker window** (keep explicit ms; do not absorb into settle)

```ts
for (let i = 0; i < 8; i += 1) {
  await world.runFor(25);
  await expectLiveNote(a.db, 'n1', { body: 'optimistic' });
}
```

**Heal-by-refetch pin**

```ts
// nudge: reason under test
await world.until(b.nudge());
```

#### Sim layout

```text
src/sim/                             # domain-agnostic DST harness (not public)
  rng.ts clock.ts scheduler.ts timers.ts
  network.ts traffic.ts http-bridge.ts pubsub-bridge.ts
  world.ts client-factory.ts server.ts open-sim-sqlite.ts
  domain-pack.ts                     # SimDomainPack type (no built-in packs)
  faults.ts invariants.ts until.ts replay-steps.ts
  test-driver.ts

src/domain-packs/
  notes-app/                         # scenario domain + notesDomainPack + fuzz

src/tests/
  scenarios/                         # black-box correctness suite (112 files)
  harness/                           # sim kernel self-tests + scenario-api
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
9. No deep public imports — four entrypoints only.
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
   product true / sim true — do not conflate)
9. **Does a scenario already cover it?** Prefer extending sim over new
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
| Session queries | Scopes held for engine lifetime; `waitForFirstSync` waits on them |
| Paint gate | Product `SyncEnginePaintGateContext` + session first-sync |
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
- Product API wiring: `apps/api/src/sync/sync-app.ts`
- Topics: `libs/runtime/src/root/sync-topics.ts`
- Schema: `libs/runtime/src/root/app-schema.ts`

---

## Scenario catalog

Black-box correctness under `src/tests/scenarios/` (**112** files) plus harness
`src/tests/harness/kernel.test.ts`. Most scenarios compose `openSimWorld` with
`notesDomainPack` + notes-app asserts from `src/domain-packs/notes-app/`.
Row-image fanout is on unless a test sets `rowImageFanout: false`. File names
describe the behavior under test. Production-hardening phases (schema drift
through channel drift) extend the original suite; all scenarios stay
rewrite-safe (public + sim world API + domain packs only).

### Happy path / multi-client (10)

| File | Proves |
|------|--------|
| `single-client-mutate-uploads-and-persists.test.ts` | Single-client mutate uploads and persists title/body |
| `two-client-mutual-writes-converge.test.ts` | Two-client converge + seed sweep of mutual writes |
| `live-fanout-peer-visibility-within-budget.test.ts` | Happy-path live visibility within sim-time budget; restart rehydrates |
| `folders-and-notes-multi-table-converge.test.ts` | Folders + notes, `moveNote`, soft-delete folder leaves notes |
| `same-actor-two-devices-converge.test.ts` | Two devices, same `actorId`, concurrent writes converge |
| `same-actor-empty-profile-fanout-does-not-wipe-peer.test.ts` | Empty `ensureProfile` seed fanout does not blank peer username |
| `peer-visibility-under-200ms-sim-budget.test.ts` | Peer visibility under 200ms simulated time with fixed one-way delay |
| `set-note-v1-v2-interleaved-converge.test.ts` | `setNote` + `setNoteV2` interleaved; V1-only client still replays |
| `mutation-batch-over-max-drains-without-dupes.test.ts` | Queue > `MAX_MUTATIONS_BATCH` drains across batches without dupes |
| `hard-query-limit-truncates-hydrate.test.ts` | Hard query `limit` truncates; multi-table shrink converges fully |

### Tombstones / soft-delete (3)

| File | Proves |
|------|--------|
| `soft-delete-tombstone-propagates-and-revives.test.ts` | Soft-delete propagates as tombstone; set after delete revives |
| `late-join-hydrates-soft-deleted-tombstones.test.ts` | Late-joining peer hydrates soft-deleted rows from snapshot |
| `domain-hard-delete-rejected.test.ts` | Domain hard delete rejected (`NO_HARD_DELETE`); row stays live |

### Authz / rejection (7)

| File | Proves |
|------|--------|
| `non-owner-mutation-denied-owner-converges.test.ts` | Non-owner delete forbidden; owner soft-delete peers converge |
| `permanent-reject-stored-peer-never-applies.test.ts` | Permanent reject stored; peer never applies bad body; ack clears |
| `requires-online-fails-offline-without-queue.test.ts` | Requires-online mutations fail offline without queueing |
| `denied-query-detaches-scope-keeps-rows.test.ts` | Denied query detaches scope without wiping domain rows |
| `auth-revoked-wipes-db-expired-refreshes.test.ts` | Expired refreshes/drains; revoked wipe; mid-drain expire; mid-push revoke |
| `mid-session-authorize-deny-keeps-domain-rows.test.ts` | Mid-session authorize flip denies scope; domain rows remain |
| `pending-reject-surfaces-write-rejections.test.ts` | Pending rejectable mutate surfaces rejection; domain rolls back |

### Offline / crash / partition (8)

| File | Proves |
|------|--------|
| `two-offline-same-id-single-winner.test.ts` | Two-offline conflict on same id → single winner everywhere |
| `remote-fanout-races-local-pending-mutation.test.ts` | Remote fanout races a locally pending mutation; no stuck divergence |
| `crash-restart-rehydrates-and-drains-queue.test.ts` | Offline queue drains on reconnect; crash+restart rehydrates from server |
| `full-partition-during-write-then-heal.test.ts` | Full partition during write; heal converges |
| `offline-crash-partition-lifecycle-matrix.test.ts` | Offline, crash, partition, flip-flop contest matrix |
| `reupload-idempotent-no-duplicate-rows.test.ts` | Re-upload / repeated sets do not duplicate domain rows |
| `cache-clear-preserves-pending-mutations.test.ts` | Cache clear wipes domain; durable pending uploads still converge |
| `not-modified-does-not-clobber-pending.test.ts` | `not_modified` refetch does not clobber pending optimistic; later rebase |

### Network / delivery faults (10)

| File | Proves |
|------|--------|
| `dropped-live-repaired-by-refetch.test.ts` | Dropped live repaired by refetch; reorder; duplicate delivery |
| `live-loss-dup-reorder-still-converges.test.ts` | Live loss/dup/reorder/asymmetric faults; live-loss + sync-hold converge after repair |
| `sync-hold-reorder-dup-still-converges.test.ts` | Sync hold, reorder, and duplicate delivery still converge |
| `sync-partitioned-while-live-delivers.test.ts` | Sync partitioned while live can deliver (refetch fanout mode) |
| `held-sync-upload-retries-on-release.test.ts` | Held sync keeps upload pending; release + wake confirms |
| `live-resend-on-reconnect-vs-drop.test.ts` | Default live drop vs `liveResendOnReconnect` while sync held |
| `buffer-outbound-live-flush-on-reconnect.test.ts` | Default skip vs `bufferOutboundLive` flush on reconnect; live-before-sync + latency budget |
| `oversized-fanout-falls-back-to-refetch.test.ts` | Oversized fanout images fall back to pushSeq-only; peers converge |
| `push-without-row-images-wakes-refetch.test.ts` | No capture images → pushSeq-only wake+refetch still converges |
| `push-tables-filter-wakes-overlapping-scopes.test.ts` | Push `tables` filter skips non-overlapping scopes; overlapping wakes |

### Membership topics / room live (8)

| File | Proves |
|------|--------|
| `leave-join-topics-without-pubsub-remake.test.ts` | Leave/join rooms sync topics incrementally — no pubsub remake |
| `peer-create-during-leave-keeps-mqtt-session.test.ts` | Peer create during leave does not wipe MQTT; rejoin hydrates |
| `topic-sync-waits-for-mutations-drain.test.ts` | Topic sync waits until pending uploads drain |
| `room-live-isolated-until-member-joins.test.ts` | Room-B live does not reach room-A member until join |
| `join-paints-peer-space-note-via-live.test.ts` | After join, peer space note paints via live while sync held |
| `leave-drops-room-topic-until-rejoin.test.ts` | Leave/end drops room topic; further live missed until rejoin |
| `tombstone-membership-wakes-removed-user-topic.test.ts` | Soft-deleted `spaces_users` image still wakes removed user topic |
| `entry-channel-wakes-never-held-row.test.ts` | Entry channel delivers peer create before local ever held the row |

### Races / skew / lifecycle (6)

| File | Proves |
|------|--------|
| `live-vs-sync-ordering-races-converge.test.ts` | Hold live vs sync ordering races; live-only partition repaired via sync pull |
| `clock-skew-permutations-still-converge.test.ts` | Convergence under Alice/Bob/server clock-order permutations |
| `background-pauses-sweeps-foreground-catches-up.test.ts` | Background pauses remote sweeps; local optimistic still applies; foreground catches up |
| `online-mutate-no-optimistic-body-flicker.test.ts` | Online mutate never reverts optimistic body before quiescence |
| `delayed-sync-after-ack-no-optimistic-flicker.test.ts` | Delayed/reordered sync after ack never reverts optimistic body |
| `replay-pins-now-to-mutation-created-at.test.ts` | Replay + rebase pin `env.now` to `createdAt` under skew |

### Schema drift & versioning (11)

| File | Proves |
|------|--------|
| `epoch-bump-wipes-cache-preserves-pending-uploads.test.ts` | Epoch bump wipes cache; durable pending uploads drain |
| `epoch-bump-mid-offline-session-then-drain.test.ts` | Offline epoch bump then later reconnect drains |
| `server-snapshot-with-unknown-column-merges-cleanly.test.ts` | Extra server column ignored via column-intersect |
| `client-column-missing-from-server-snapshot-not-clobbered.test.ts` | Local-only column not nulled by intersection merge |
| `new-domain-table-added-mid-life-hydrates-after-migrate.test.ts` | New table hydrates after migrate; old data intact |
| `query-v1-v2-mixed-clients-converge.test.ts` | Mixed query wire names converge on live rows |
| `unknown-mutation-name-rejected-and-rolled-back.test.ts` | Unknown mutation → reject + merge heal |
| `unknown-query-name-denied-detaches-scope.test.ts` | Unknown query → denied; domain kept; engine healthy |
| `args-schema-tightened-server-rejects-stale-args.test.ts` | Tightened zod args → permanent reject; no crash loop |
| `scope-hash-stable-under-param-key-order.test.ts` | Param key order does not double-subscribe |
| *(also)* `set-note-v1-v2-interleaved-converge.test.ts` | V1-only client still replays while V2 exists |

### Idempotency / retries (8)

| File | Proves |
|------|--------|
| `upload-response-lost-retry-does-not-double-apply.test.ts` | Drop mutations response; retry does not double-apply |
| `same-batch-posted-twice-verdicts-stable.test.ts` | Duplicate POST batch is idempotent |
| `duplicate-mutation-id-different-args-first-wins.test.ts` | Same id different args → first wins |
| `seq-restart-after-wipe-harmless.test.ts` | Local seq restart after wipe is harmless |
| `server-500-mid-batch-full-retry-idempotent.test.ts` | In-txn fail rolls back; post-commit fail dedupes |
| `late-retry-after-prune-window-documented.test.ts` | Re-POST after prune double-applies (retention pin) |
| `constraint-error-maps-to-business-code.test.ts` | Unique violation → business code on rejection surface |
| `invalid-batch-400-no-retry-storm.test.ts` | 400 invalid batch; healthy mutates still drain |

### Checkpoint / hash / row images (11)

| File | Proves |
|------|--------|
| `row-image-apply-then-refetch-not-not-modified.test.ts` | After images, content hash path stays sound |
| `reordered-http-responses-stale-checkpoint-dropped.test.ts` | Stale reordered sync checkpoint dropped |
| `content-reverts-hash-matches-not-modified-sound.test.ts` | A→B→A hash/`not_modified` soundness |
| `push-seq-gap-forces-refetch-not-image-apply.test.ts` | Push seq gap forces refetch path |
| `own-echo-floor-skips-but-peer-push-applies.test.ts` | Own echo floor; peer push still applies |
| `tombstone-row-image-deletes-live-row.test.ts` | Tombstone image removes live peer row |
| `row-image-for-inactive-table-ignored-safely.test.ts` | Inactive-table images ignored safely |
| `fanout-row-cap-boundary-64-vs-65.test.ts` | `MAX_FANOUT_ROWS` 64 vs 65 boundary |
| `optimistic-push-rejected-server-side-heals.test.ts` | Optimistic paint heals after server reject |
| `push-during-inflight-merge-queues-single-flight.test.ts` | Push during merge; single-flight; converge |
| `push-for-just-unsubscribed-topic-ignored.test.ts` | Unsub races in-flight push; ignored |

### Rebase & optimistic edges (5)

| File | Proves |
|------|--------|
| `rebase-onto-peer-tombstone-pinned-semantics.test.ts` | Pending update vs peer tombstone; pinned outcome |
| `rebase-throw-hidden-until-upload-reject.test.ts` | Rebase throw hidden until upload reject |
| `deep-pending-chain-rebases-in-seq-order.test.ts` | Long pending chain rebases in seq order |
| `interleaved-mutate-during-upload-inflight.test.ts` | Mutates during drain join next batch in order |
| `reject-mid-chain-later-pendings-still-apply.test.ts` | Mid-chain reject; later pendings survive |

### Crash-point matrix (5)

| File | Proves |
|------|--------|
| `crash-mid-merge-restart-rehydrates.test.ts` | Crash after sync delivery; no torn multi-table state |
| `mutate-local-apply-and-queue-atomic-under-crash.test.ts` | Mutate+queue atomic under crash (outcome-only) |
| `crash-after-post-before-ack-retry-idempotent.test.ts` | Crash after accept before ack; idempotent redrain |
| `server-crash-mid-request-client-retries.test.ts` | Server crash mid-request; clients retry |
| `crash-during-epoch-migrate-recovers.test.ts` | Crash mid epoch migrate; next boot recovers |

### Server integrity (5)

| File | Proves |
|------|--------|
| `pubsub-publish-fails-after-commit-heals-by-refetch.test.ts` | Publish loss after commit; heal by refetch |
| `replay-txn-rollback-no-pushseq-leak.test.ts` | In-txn rollback; no push leak; retry ok |
| `concurrent-topic-seq-allocation-monotonic.test.ts` | Concurrent topic seq stays monotonic |
| `authorize-throw-equals-denied.test.ts` | Authorize throw ≡ denied |
| `prune-concurrent-with-replay-safe.test.ts` | Prune interleaved with replay stays safe |

### Auth / identity / multi-tenant (5)

| File | Proves |
|------|--------|
| `account-switch-pool-isolation.test.ts` | `createSyncEnginePool` identities isolated |
| `logout-login-same-device-no-bleed.test.ts` | Same device A→B; no bleed |
| `membership-revoked-mid-session-scope-denied-topics-dropped.test.ts` | Membership revoke → denied + topic drop |
| `cross-tenant-rows-never-hydrate.test.ts` | Authorize filters; no cross-tenant hydrate |
| *(also)* `auth-revoked-…` | Expired mid-drain / revoked mid-push |

### Data-shape robustness (4)

| File | Proves |
|------|--------|
| `unicode-null-byte-huge-string-roundtrip.test.ts` | Unicode / null byte / huge string round-trip |
| `null-vs-missing-column-in-snapshot.test.ts` | Explicit null vs missing key merge |
| `bigint-ids-and-float-precision-stable.test.ts` | Bigint-like ids + float stability |
| `empty-tables-and-zero-row-snapshot.test.ts` | Zero-row snapshot; absence ≠ delete |

### Endurance / churn (6)

| File | Proves |
|------|--------|
| `seeded-workload-fuzz-determinism.test.ts` | Seeded workload determinism; corpus/env seeds |
| `long-horizon-fuzz-hours-of-virtual-time.test.ts` | Long virtual-time fuzz with converge checkpoints |
| `scope-churn-no-leaked-timers-or-subscriptions.test.ts` | Rapid scope churn; scheduler quiescent |
| `tombstone-accumulation-still-converges.test.ts` | Many tombstones still converge (limitation 1) |
| `connect-disconnect-flapping-under-load.test.ts` | Connect/disconnect flap under load |
| `mutation-storm-batching-order-preserved.test.ts` | Large offline queue drains in seq order |

### Channel drift pins (5)

| File | Proves |
|------|--------|
| `undeclared-table-write-misses-table-filter-heals-on-wakeall.test.ts` | Undeclared write stale until wake (limitation 8) |
| `wrong-topic-map-heals-on-refetch.test.ts` | Wrong topic-map wake; heal on refetch |
| `non-mutation-server-write-without-notify-stale-until-sweep.test.ts` | Direct server write without notify; heals via reconcile tick |
| `non-mutation-catalog-insert-wakes-empty-hydrate.test.ts` | Empty hydrate + catalog INSERT; notify fast path + tick heal |
| `oob-empty-hydrate-heals-via-reconcile-tick.test.ts` | Chess-puzzle shaped empty hydrate + silent OOB INSERT/UPDATE heals without nudge |

### Unit / harness (3)

| File | Proves |
|------|--------|
| `in-memory-watch-reacts-to-local-insert.test.ts` | In-memory engine `watch` reacts to local domain INSERT |
| `strict-default-query-limit-throws.test.ts` | Default budget + `strictQueryLimits` throws; explicit budget still clips |
| `../harness/kernel.test.ts` | Sim kernel: RNG / scheduler / timers; membership topic sync |

### Alphabetical index (116 scenarios)

```text
account-switch-pool-isolation
args-schema-tightened-server-rejects-stale-args
auth-revoked-wipes-db-expired-refreshes
authorize-throw-equals-denied
background-pauses-sweeps-foreground-catches-up
bigint-ids-and-float-precision-stable
buffer-outbound-live-flush-on-reconnect
cache-clear-preserves-pending-mutations
capture-includes-all-written-tables
client-column-missing-from-server-snapshot-not-clobbered
clock-skew-permutations-still-converge
concurrent-topic-seq-allocation-monotonic
connect-disconnect-flapping-under-load
constraint-error-maps-to-business-code
content-reverts-hash-matches-not-modified-sound
crash-after-post-before-ack-retry-idempotent
crash-during-epoch-migrate-recovers
crash-mid-merge-restart-rehydrates
crash-restart-rehydrates-and-drains-queue
cross-tenant-rows-never-hydrate
deep-pending-chain-rebases-in-seq-order
delayed-sync-after-ack-no-optimistic-flicker
denied-query-detaches-scope-keeps-rows
domain-hard-delete-rejected
dropped-live-repaired-by-refetch
duplicate-mutation-id-different-args-first-wins
empty-tables-and-zero-row-snapshot
entry-channel-wakes-never-held-row
epoch-bump-mid-offline-session-then-drain
epoch-bump-wipes-cache-preserves-pending-uploads
fanout-row-cap-boundary-64-vs-65
folders-and-notes-multi-table-converge
full-partition-during-write-then-heal
hard-query-limit-truncates-hydrate
held-sync-upload-retries-on-release
in-memory-watch-reacts-to-local-insert
interleaved-mutate-during-upload-inflight
invalid-batch-400-no-retry-storm
join-paints-peer-space-note-via-live
late-join-hydrates-soft-deleted-tombstones
late-retry-after-prune-window-documented
leave-drops-room-topic-until-rejoin
leave-join-topics-without-pubsub-remake
live-fanout-peer-visibility-within-budget
live-loss-dup-reorder-still-converges
live-resend-on-reconnect-vs-drop
live-vs-sync-ordering-races-converge
logout-login-same-device-no-bleed
long-horizon-fuzz-hours-of-virtual-time
membership-revoked-mid-session-scope-denied-topics-dropped
mid-session-authorize-deny-keeps-domain-rows
mutate-local-apply-and-queue-atomic-under-crash
mutation-batch-over-max-drains-without-dupes
mutation-storm-batching-order-preserved
new-domain-table-added-mid-life-hydrates-after-migrate
non-mutation-catalog-insert-wakes-empty-hydrate
non-mutation-server-write-without-notify-stale-until-sweep
non-owner-mutation-denied-owner-converges
not-modified-does-not-clobber-pending
null-vs-missing-column-in-snapshot
offline-crash-partition-lifecycle-matrix
oob-empty-hydrate-heals-via-reconcile-tick
online-mutate-no-optimistic-body-flicker
optimistic-push-rejected-server-side-heals
oversized-fanout-falls-back-to-refetch
own-echo-floor-skips-but-peer-push-applies
peer-create-during-leave-keeps-mqtt-session
peer-visibility-under-200ms-sim-budget
pending-mutations-across-protocol-cut-drain
pending-reject-surfaces-write-rejections
permanent-reject-stored-peer-never-applies
prune-concurrent-with-replay-safe
pubsub-publish-fails-after-commit-heals-by-refetch
push-during-inflight-merge-queues-single-flight
push-for-just-unsubscribed-topic-ignored
push-seq-gap-forces-refetch-not-image-apply
push-tables-filter-wakes-overlapping-scopes
push-without-row-images-wakes-refetch
query-v1-v2-mixed-clients-converge
rebase-onto-peer-tombstone-pinned-semantics
rebase-throw-hidden-until-upload-reject
reject-mid-chain-later-pendings-still-apply
remote-fanout-races-local-pending-mutation
reordered-http-responses-stale-checkpoint-dropped
replay-pins-now-to-mutation-created-at
replay-txn-rollback-no-pushseq-leak
requires-online-fails-offline-without-queue
reupload-idempotent-no-duplicate-rows
room-live-isolated-until-member-joins
row-image-apply-then-refetch-not-not-modified
row-image-for-inactive-table-ignored-safely
same-actor-empty-profile-fanout-does-not-wipe-peer
same-actor-two-devices-converge
same-batch-posted-twice-verdicts-stable
scope-churn-no-leaked-timers-or-subscriptions
scope-hash-stable-under-param-key-order
seeded-workload-fuzz-determinism
seq-restart-after-wipe-harmless
server-500-mid-batch-full-retry-idempotent
server-crash-mid-request-client-retries
server-snapshot-with-unknown-column-merges-cleanly
set-note-v1-v2-interleaved-converge
single-client-mutate-uploads-and-persists
soft-delete-tombstone-propagates-and-revives
sync-hold-reorder-dup-still-converges
sync-partitioned-while-live-delivers
tombstone-accumulation-still-converges
tombstone-membership-wakes-removed-user-topic
tombstone-row-image-deletes-live-row
topic-sync-waits-for-mutations-drain
two-client-mutual-writes-converge
two-offline-same-id-single-winner
unicode-null-byte-huge-string-roundtrip
unknown-mutation-name-rejected-and-rolled-back
unknown-query-name-denied-detaches-scope
upload-response-lost-retry-does-not-double-apply
wrong-topic-map-heals-on-refetch
```
