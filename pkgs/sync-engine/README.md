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
(`_deleted_at`), never inferred from absence. Peers learn about each other’s
changes via **pubsub push → (optional row-image apply) or query refetch**.
Snapshots alone define correctness; row-image fanout is a **lossy
optimization**. There is **no peer mutation fanout**.

```text
mutate() ──► local SQL + _mutations row ──► POST /mutations ──► Postgres replay
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
| Merge / rebase / upload queue | Domain schema (`@libs/db` `appSchema`) |
| Query/mutation registries API | Query + mutation **defs** per feature |
| Framework tables + DDL | Topic naming (`user:`, `room:`, …) |
| `createSyncApp` Hono routes | Auth resolution, Postgres client |
| Client engine + React hooks | Session query list, paint gate wiring |
| Push apply / optimistic fanout | MQTT/EMQX pubsub adapter |
| Deterministic sim + scenarios | Product REST exceptions |

**Tier rule:** this is a flat `pkgs/` package — **no** product imports
(`@libs/*`, `gamezilla`, apps). Product topics and schemas live in `@libs/db`
/ feature packages; the engine only sees registries + SQL clients + pubsub
ports.

---

## Public API (four entrypoints only)

Deep imports under `src/` are **not** public. `package.json` `exports`:

| Import | Role |
|--------|------|
| `@pkgs/sync-engine/client` | Expo / React Native engine, React hooks, HTTP client |
| `@pkgs/sync-engine/server` | Hono sync app (`POST /query`, `POST /mutations`), `notifyChannels` |
| `@pkgs/sync-engine/shared` | `defineQuery` / `defineMutation`, registries, soft-delete helpers, framework DDL |
| `@pkgs/sync-engine/test` | `createInMemorySyncEngine` for unit tests |

### Notable public symbols

**client:** `createLocalSyncEngine`, `createSyncHttpClient`, `createSyncEnginePool`,
`SyncEngineProvider`, `useSyncEngine`, `useSyncEngineInstance`, `useQuery`,
`MutationClientProvider`, `useMutationClient`, `SyncEnginePaintGateContext`,
`AppLifecycle` helpers, status types.

**server:** `createSyncApp`, `notifyChannels`, `allocateTopicPushSeq(s)`,
`isAuthErrorBody`, `SyncAppAuth`.

**shared:** `defineQuery`, `defineMutation`, `queryRegistry`, `mutationRegistry`,
`MutationError`, `LIVE_ROW_SQL`, `softDeleteById`, `withFrameworkMutations`,
`applyFrameworkServerDdl`, `FRAMEWORK_*` constants,
`assertChannelExhaustiveness` / `findChannelExhaustivenessGaps`.

**Not public** (internal modules agents may cite but must not import from apps):
`merge.ts`, `SubscriptionRuntime`, `MutationUploadQueue`, `attachPush`,
`createMutationClient`, `runQuery`, `replayMutation`, anything under `src/sim/`.

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
│  Postgres (domain + _mutations_applied + write_rejections)   │
│  product opts rowImageFanout: true                           │
└───────────────────────────┬─────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
   Room DO             Stripe/etc            REST exceptions
   (realtime play)     (external)            friends/search,
                                             client-config/refresh
```

**Wire path layering:** the package Hono app mounts `POST /query` and
`POST /mutations`. The product HTTP client defaults to `/api/query` and
`/api/mutations` (host mount prefix). Both names appear in docs — they are
the same routes at different layers.

**Absolute REST exceptions** (do not casually grow — see `AGENTS.md`):
`POST /friends/search`, `POST /client-config/refresh`, Stripe/external APIs.
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
  name: 'friendships',           // wire name; version via suffix (fooV2)
  params: z.object({}),
  hydrates: ['friendships'],     // local tables rows land in
  limit: 2000,                   // hard row budget (required)
  channels: (_p, ctx) => [...],  // pubsub topics that should wake this scope
  authorize: async (ctx) => ...,
  run: async (ctx, params) => ({ friendships: rows }),
});
```

**Tombstones on the wire (required):**
- `run` SQL must **select `_deleted_at`** and must **not** filter
  `_deleted_at IS NULL`.
- Snapshots include soft-deleted rows so the client can upsert tombstones.
- UI / live client reads **do** filter live rows (`_deleted_at IS NULL` or
  `LIVE_ROW_SQL`).

**Scopes:** each `(name, params)` pair hashes to a `scope_hash`
(`sha256(name\0canonicalJson(params))`). Active scopes are refcounted
subscriptions. Checkpoint + content hash live in `_scope_meta`.

**Limits:** every query has a hard `limit`; `runQuery` truncates across tables
(`applyHardLimit`). Unbounded sync is forbidden by design (Tiger).
Batch bound: max **64** queries per POST.

### Mutations (`defineMutation`)

A mutation is the **only** legal domain write path (client + server).

```ts
defineMutation({
  name: 'removeFriend',
  args: z.object({ ... }),
  declaredWrites: ['friendships'], // docs + push table filter (not runtime-enforced)
  invalidates: (args, env, db) => topics, // post-replay pubsub topics
  affectedRows: (args) => ({ friendships: [id] }), // optional fanout ids
  requiresOnline: false,
  pendingUx: 'instant',          // product UI knob; engine does not enforce
  constraintErrors: { ... },     // map PG unique violations → business codes
  run: async ({ tx, env }, args) => { /* SQL only */ },
});
```

Rules:
- Bodies must **soft-delete** (`UPDATE … SET _deleted_at = …`), never
  `DELETE FROM` domain tables. `wrapMutationDb` throws `MutationError`
  `NO_HARD_DELETE` on domain hard deletes at apply **and** replay.
- Use `softDeleteById` / `LIVE_ROW_SQL` from `@pkgs/sync-engine/shared`.
- Optional `affectedRows` declares entity ids for post-replay fanout SELECTs.
  Undeclared → pushSeq-only push. Framework owns the SELECT — never derive
  row images from mutation args. Caps: `MAX_FANOUT_ROWS=64`,
  `MAX_FANOUT_BYTES=32KiB`.
- Breaking wire changes → new `name` (`joinSpaceV2`); keep old handlers until
  clients adopt.
- Server replay is idempotent via `_mutations_applied` (keyed by mutation id).
- Framework mutations (e.g. `acknowledgeWriteRejection`) are merged via
  `withFrameworkMutations` in both `createSyncApp` and `createLocalSyncEngine`.

### Sync engine (client)

`createLocalSyncEngine` owns:
1. Local schema migrate (framework + domain via `@pkgs/db-schema/sqlite`;
   `SCHEMA_EPOCH = 7`)
2. `SubscriptionRuntime` — coalesce → `POST /query` → merge
3. `MutationUploadQueue` — drain `_mutations` → `POST /mutations`
4. Optional `attachPush` — MQTT topics derived from active query `channels`
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
`openSpaceSessions`, `mySpaces`, `mySpaceUsers`, `friendships`,
`friendRequests`, `userBlocks`, `inboxActive`, `chessPuzzleProfile`,
`chessPuzzleInteractions`. Feature screens may still `subscribeQueries`
dynamically (e.g. `chessPuzzlePool`).

### Topics (product convention)

Defined in `@libs/db/shared/sync-topics` (not in this package):

| Helper | Topics |
|--------|--------|
| `userChannels` | `user:{actorId}` |
| `spaceListChannels` | user topic + `room:{spaceId}` for memberships |
| `clientConfigChannels` | singleton client-config topic |

Pushes carry optional `tables` (= mutation `declaredWrites`) so the client wakes only
scopes whose `hydrates` overlap.

### Channel exhaustiveness

CI `ci:channel-exhaustiveness` statically checks: if a mutation `declaredWrites`
tables that a query `hydrates`, their topic sets should overlap (sentinel args).
Async `invalidates` is approximated. Missed `notifyChannels` on non-mutation
server writes is a separate runtime footgun — prefer mutations.

### `rowImageFanout` defaults (important)

| Surface | Default | Notes |
|---------|---------|-------|
| `createSyncApp({ rowImageFanout })` | **false** | Opt-in |
| Client `push.rowImageFanout` | **false** | Opt-in |
| Product Gamezilla (`apps/*`) | **true** | Both API + client set true |
| `openSimWorld` / Sim Lab | **true** | `!== false` |

When off, pushes are wake+refetch only (still correct). When on, contiguous
`pushSeq` + `rows` may apply via `applyRowImages` without updating
`_scope_meta.last_hash` (keeps `not_modified` sound).

---

## Tables

### Local SQLite (framework)

| Table | Durable? | Purpose |
|-------|----------|---------|
| `_mutations` | yes | Pending upload queue only: `id, name, args, client_id, seq, created_at` |
| `_scope_meta` | cache | Per-scope `last_checkpoint`, `last_hash`, `last_active_at` |
| `_push_applied` | cache | Per-topic `last_push_seq` push sequence (fanout gap detection) |
| `write_rejections` | cache | Permanent failures (local or synced) |

`seq` = `COALESCE(MAX(seq),0)+1` inside the mutate transaction. Server
idempotency is by **mutation id**, so seq restarts are harmless.

**Deleted on purpose (do not resurrect without a design review):**
`_row_scopes`, `_upload_state`, `_peer_applied`, `_peer_mutations`,
`_topic_applied`, full write-epoch / `status` / `acked_epoch` barriers, MQTT
mutation fanout payloads. Ack-then-stale-merge flicker is addressed by sync
`bumpGenerations` on upload ack (not a write-epoch).

`SCHEMA_EPOCH` (currently **7**) bumps wipe **cache** tables and drop retired
tables; durable `_mutations` survive epoch wipe semantics carefully (see
`local-schema-migrate.ts`).

Domain tables come from the host’s `LocalDomainSchema.domainSchema` (e.g.
`@libs/db` `appSchema`). Managed columns include `_deleted_at`.

### Server Postgres (framework)

Applied by `applyFrameworkServerDdl` at migrate time (not domain
`defineSchema`):

| Table | Purpose |
|-------|---------|
| `_mutations_applied` | Idempotency + audit (`applied` / `rejected`) |
| `write_rejections` | Permanent failures keyed by `client_id` (= device id) |
| `_sync_topic_seq` | Per-topic monotonic push sequences (`n` bigint) |

`public._mutations` is **dropped**. Uploads are JSON to `POST /mutations`, not
row sync of a `_mutations` table.

`pruneMutationArtifacts` deletes old `_mutations_applied` + acknowledged
`write_rejections` (ops/scheduled job, not request path).

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

Bounds: `MAX_MUTATIONS_BATCH = 64`. Client ack = **delete** local `_mutations`
row (applied or rejected). Rejected also writes local `write_rejections`.
Optional `topicPushSeqs` floors the mutating client’s `_push_applied` so
own echoed fanout is skipped.

After successful replay, server `notifyChannels` per invalidated topic with a
**strictly monotonic per-topic `pushSeq`** (from `_sync_topic_seq`).
When `rowImageFanout` is enabled and the mutation declares `affectedRows`, the
push may also carry post-replay **row images** (size-capped). Replay + fanout
SELECT + pushSeq allocate share **one Postgres transaction**.

Bad body → 400 `{ error: 'invalid_batch' }`; oversized → 413
`{ error: 'batch_too_large' }`.

### Pubsub push

```ts
{ pushSeq: string; optimistic?: true; tables?: string[]; rows?: Record<string, QueryRow[]> }
```

`pushSeq` is required and monotonic per topic. Optional `rows` are
server-authored post-replay images (incl. `_deleted_at`) — a **lossy
optimization**. `optimistic: true` is a **client-local** MQTT hint before
server replay (`pushSeq: '0'`); apply rows without advancing `_push_applied`.
Any dropped, reordered, duplicated, or ignored fanout must degrade to
push → refetch. Snapshots alone define correctness.

**Client `handlePush` order (simplified):**
1. Optimistic → maybe apply rows; do not advance `_push_applied`
2. Exact echo (`pushSeq === last`) with rows → apply images (own echo)
3. `pushSeq ≤ last` → drop
4. Table filter → wake overlapping `hydrates` scopes
5. Contiguous next + rows → `applyRowImages` + record seq; else wake refetch
   (pending seq committed after successful sweep)

**Removed forever (unless redesign):** peer **mutation** fanout / MQTT as a
mutation log. Peer-executed mutations diverge under state skew, and
`lastHash`-based `not_modified` cannot detect or repair peer-local divergence.
Row-image fanout is different: peers upsert server facts, never execute.

---

## Client merge algorithm

For each `ok` response (single-flight per DB — `MAX_IN_FLIGHT_POLLS = 1`):

1. Skip if checkpoint ≤ stored `_scope_meta.last_checkpoint` (stale).
2. Per table: upsert column intersection **verbatim** (incl. `_deleted_at`).
   No tagging, no absence tombstones, no orphan GC.
3. Touch `_scope_meta` (`last_checkpoint`, `last_hash`, `last_active_at`).
4. Rebase every pending `_mutations` for this `clientId` in `seq` order
   (`env.now` pinned to each row’s `created_at`).
   Throws swallowed → optimistic effect hidden until upload/reject.
5. Emit table-change bus for watches.

`applyRowImages` = same upsert+rebase, **does not** update
`_scope_meta.last_hash`.

`detachScope` (unsubscribe / `denied`) = delete `_scope_meta` row only.

**Reject semantics:** upload reject deletes the queue row and inserts
`write_rejections`. Domain optimistic rows are **not** auto-reverted on reject
alone — the next successful merge without a pending rebase restores server
truth (see `pending-reject-surfaces-write-rejections` scenario).

**Ack fence:** on any `applied` verdict, `runtime.bumpGenerations()` drops
in-flight pre-replay query sweeps (reject-only batches do not fence).

---

## Subscriptions & push

### `SubscriptionRuntime`

- One coalesce queue (`QUERY_COALESCE_MS = 0` → microtask coalesce)
- One in-flight flush; further wakes queue
- Background (`AppLifecycle`) pauses sweeps
- Session queries held for engine life; `waitForFirstSync` waits on them

### `attachPush`

- Topics from active query `channels(ctx)`
- **Initial attach** remakes pubsub once (topics subscribed at birth)
- **Membership / topic churn** syncs incrementally (subscribe add / unsubscribe
  remove) — does **not** `close()` the MQTT session (avoids sessionExpiry-0
  queue wipe during create-after-end peer fanout)
- Topic sync **waits until local `_mutations` drain** (membership pending gate)
- After incremental topic add/remove → `wakeAll()` once (heal subscribe races)
- Reconnect → `wakeAll()`
- Local `spaces` / `space_users` changes refresh membership topics
- Optional `bufferOutboundLive` queues optimistic fanout while detached

---

## Soft-delete policy (hard rule)

| Surface | Rule |
|---------|------|
| Domain mutations | `UPDATE … SET _deleted_at`; never `DELETE FROM` |
| `defineQuery.run` | **Include** tombstones (`SELECT …, _deleted_at`, no live filter) |
| UI / `useQuery` SQL | Filter `_deleted_at IS NULL` (or `LIVE_ROW_SQL`) |
| Merge | Upsert `_deleted_at` as a normal column |
| Framework tables | May hard-delete |
| CI | `bun run ci:no-domain-hard-delete` |

Inbox is slightly different product-wise (`active` flag) but still a sync query;
don’t invent a second delete model without review.

---

## Consistency & failure model

| Event | Behavior |
|-------|----------|
| Offline mutate | Applies locally, queues `_mutations`, UI updates via watch |
| `requiresOnline` offline | Returns `{ ok: false, code: 'OFFLINE' }`; no queue |
| Upload success | Delete queue row; sync gen bump drops in-flight pre-replay sweeps; peers learn via push → query |
| Upload reject | Delete queue row + `write_rejections`; domain rolls back on later merge |
| Merge while pending | Server snapshot applied, then pending mutations re-run |
| Stale snapshot | Checkpoint compare drops it; post-ack gen bump drops in-flight pre-replay sweeps |
| Denied query | Detach scope meta; domain rows remain |
| Auth revoked | Wipe identity DB |
| Auth expired | Refresh; must not wipe |
| Push lost | Next reconnect / foreground / membership wakeAll eventually refetches |
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
- Stronger CI that `defineQuery.run` selects `_deleted_at` / omits live filters
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
   without `_deleted_at` set, it stays live locally. Mitigate with better
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
   remake). Waits for pending `_mutations` drain; tiny subscribe-race window
   healed by `wakeAll`; true dispose still closes with sessionExpiry 0.
6. **Paint waits on all session queries** — correct single lifetime model;
   may delay first paint vs old boot/shell split. Product `paintReady` is a
   separate identity-match context.
7. **Rebase swallows errors** — pending mutation that fails against new
   server state stays queued until upload reject; UI may look “stuck”
   optimistic. Product should watch `write_rejections`.
8. **`declaredWrites` not runtime-enforced** — documentation + push filter only;
   a mutation can touch undeclared tables.
9. **Channel exhaustiveness is sentinel-based** — async party expansion and
   weird args can false-pass/fail.
10. **Dead legacy upload CRUD** (`mutations/server/process-upload-with-mutations.ts`) —
    zero importers; safe delete candidate. Main product uses `/mutations` JSON.

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
| Product topics | feature `invalidates` / `channels` | Wrong topics ⇒ silent staleness |

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

- **Domain schema:** `@libs/db` `defineSchema` / `appSchema`; local reconcile via
  `@pkgs/db-schema/sqlite`; Postgres migrate separate.
- **Framework local:** `FRAMEWORK_LOCAL_DDL` + `SCHEMA_EPOCH` (= 7) in
  `queries/client/local-schema.ts`.
- **Framework server:** `FRAMEWORK_SERVER_DDL` via `applyFrameworkServerDdl`.
- **Query/mutation wire names:** append `V2` for breaking changes; keep old
  handlers until clients migrate.
- **Cache clear:** `clearLocalData({ reason: 'cache' })` drops cache tables and
  recreates schema; durable `_mutations` policy follows migrate helpers.
  `{ reason: 'revoked' }` is the auth-wipe path.

---

## App wiring (Gamezilla)

**Client** (`apps/client/src/sync/create-local-sync-engine.ts`)

1. Open identity SQLite → `createLocalSyncEngine({ sessionQueries, postQueries,
   postMutations, push: { rowImageFanout: true, … }, lifecycle, … })`
2. `SyncEngineProvider` + `SqlClientProvider` + `SyncEnginePaintGateContext`
3. `MutationClientProvider` with `MutationEnv` + `{ clientId: deviceId }`
4. Feature: `useQuery(sql\`… AND _deleted_at IS NULL\`)` +
   `useMutationClient().mutate(def, args)`

**API** (`apps/api/src/sync/sync-app.ts`)

1. `applyFrameworkServerDdl` during migrate
2. `createSyncApp({ resolveAuth, getSql, queries, mutations, pubsub,
   rowImageFanout: true })`
3. Non-mutation DOMAIN writes must `notifyChannels`

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
  sim-lab/          # interactive GUI over shapes domain (`bun run sim:lab`)
  test/             # in-memory engine
  tests/
    scenarios/      # black-box correctness (51 files)
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
bun run --filter @pkgs/sync-engine sim:lab   # http://localhost:7788 shapes domain
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
identical timeline.** Scenarios call `openSimWorld`; fuzz calls `runSeed`.
Default domain: tiny notes+folders app in `src/sim/notes-app/` (kept out of
`tests/` so sim code never imports test paths). Assert **live domain rows
only** — never framework tables or private modules. The interactive **Sim Lab**
GUI (`src/sim-lab/`) boots a shapes domain (`domain: 'shapes'`) instead — run
`bun run --filter @pkgs/sync-engine sim:lab` (serves http://localhost:7788).

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
| Time | `SimClock` + `SimScheduler` (discrete events; same-time ordered by insertion seq) |
| Wall clocks | Per-node skew via `setClockSkew` / `nowFor` (scheduler stays on base clock) |
| Timers | `createSimTimers` implements the production `Timers` port |
| RNG | `createSeededRng` (splitmix64); `fork(label)` for independent streams |
| Network | `SimNetwork` — delay, loss, reorder, replay, partition, hold |
| HTTP | `createSimHttpClient` / `bindSimHttpServer` over the mesh (`sync` traffic) |
| PubSub | `createSimPubSubBroker` delayed fanout over the same mesh (`live` traffic) |
| Server | Bun `:memory:` SQLite + framework DDL + schema reconcile |
| Clients | Bun `:memory:` SQLite + real `createLocalSyncEngine` |

**Not simulated:** disk bitflips, real EMQX, Cloudflare Worker runtime. Sim
server uses SQLite dialect; production server is Postgres.

Injected ports (`now`, `random`, `createId`, `timers`) keep the production
engine on the virtual clock. Convergence: after quiescence, every client’s live
domain view matches the server (`assertConverged`).
`assertConverged` / settle clear holds, partitions, and node fault overrides
(heal up to 40×250ms virtual).

#### Quick start

```ts
import { openSimWorld } from './world';
import { setNote } from './notes-app';

const world = await openSimWorld({ seed: 42 });
const a = await world.addClient({ id: 'alice' });
await a.mutate(setNote, { id: 'n1', body: 'hi' });
await world.assertConverged();
await world.dispose();
```

Lightweight clock/timers without a full world:

```ts
import { createSimTestDriver } from './test-driver';
const sim = createSimTestDriver();
await sim.runFor(150);
```

#### Traffic classes

Public API uses semantic traffic (not transport names):

| Traffic | Intent |
|---------|--------|
| `live` | Realtime peer updates (pushes / fanout) |
| `sync` | Pull / request-response hydration |
| `all` | Both |

```ts
world.hold('bob', 'sync');      // pause bob's pull deliveries (queued)
world.release('bob', 'sync');   // drain without re-sampling faults
world.partition('bob', 'live'); // drop bob's realtime; sync still works
world.heal('bob');
world.setFaults('bob', 'live', { packetLossProbability: 1 });
world.clearFaults('bob');
```

**Live is unreliable by design.** Never assume live messages arrive exactly once,
in order, or at all. Control loss / dup / reorder / delay **per node** via
`setFaults(nodeId, 'live', …)`. Named tests assert domain convergence after
settle, not push ordering. `sync` stays near-reliable by default; use
`hold`/`release` to script push↔query races.

#### Clock skew

Scheduler / network delivery use the shared base `SimClock`. Logical wall
clocks for mutation `created_at` / soft-delete timestamps are per-node:

```ts
world.setClockSkew('alice', -60_000);
world.setClockSkew('bob', 0);
world.setClockSkew('server', 60_000);
world.nowFor('alice'); // base.now() + skew
```

#### Knobs

**World open** (`OpenSimWorldArgs` on `openSimWorld`):

| Knob | Default | Meaning |
|------|---------|---------|
| `seed` | required | Root RNG seed (`number \| bigint \| string`) |
| `faults` | `RELIABLE_FAULTS` | Default mesh fault profile (all zeros) |
| `sampleFaults` | `false` | Ignore `faults`; sample lossy profile from `rng.fork('faults')` |
| `rowImageFanout` | `true` | Live pushes apply row images; `false` → wake query refetch |
| `liveResendOnReconnect` | `false` | Drop live while peer closed; `true` buffers last topics and flushes on re-subscribe (sim stand-in for short offline session drain; production MQTT uses QoS 1 + persistent sessions separately) |
| `bufferOutboundLive` | `false` | Skip optimistic fanout while push detached; `true` queues and flushes on reconnect (peers can paint via live before upload/sync) |

**Network faults** (`SimFaultOptions` in `faults.ts`):

| Knob | Effect |
|------|--------|
| `oneWayDelayMeanMs` / `oneWayDelayJitterMs` | Delivery delay |
| `packetLossProbability` | Drop before schedule |
| `packetReplayProbability` | Duplicate delivery |
| `reorderWindow` | Extra delay for reordering |
| `partitionProbability` / `unpartitionProbability` | Fuzz partition profile (not auto-applied on every send) |

World-open `faults` / `sampleFaults` set the **default** profile. Per-node
overrides win for that node's `live` / `sync` / `all`. `RELIABLE_FAULTS` zeros
all knobs.

**Runtime traffic** (`SimTraffic`: `live` \| `sync` \| `all`):

| API | Meaning |
|-----|---------|
| `partition(nodeId, traffic?)` / `heal` / `healAll` | Cut / restore edges (default traffic `all`) |
| `hold(nodeId, traffic)` / `release` / `releaseAll` | Queue then drain deliveries (no re-sample of faults on release) |
| `setFaults(nodeId, traffic, partial)` / `clearFaults` | Per-node override = `RELIABLE_FAULTS` ∪ partial |
| `setClockSkew(nodeId, skewMs)` / `nowFor(nodeId)` | Offset logical wall clock for mutation timestamps |

**Lifecycle:** `addClient({ id, actorId?, sessionQuery? })`, `crashClient` /
`restartClient` (fresh `:memory:` DB), `setAuthStatus(clientId, 'valid' |
'expired' | 'revoked')`, `lifecycle.setOnline` / `setForeground`, engine
`connect` / `disconnect` / `refreshQueries` / `wakeUploads`.
Use `sessionQuery: SPACE_MEMBERSHIP_SESSION` for room-topic membership scenarios
(`notesWorld` remains the default). Client handles expose
`pubsubRemakeCount()` / `subscribedTopics()` for black-box membership asserts.

**Fuzz / replay** (`runSeed`):

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
import { runSeed } from './replay';
await runSeed({ seed: 0x2a, steps: 16 });
```

#### Sim layout

```text
src/sim/                             # DST implementation (not a public export)
  rng.ts clock.ts scheduler.ts timers.ts
  network.ts traffic.ts http-bridge.ts pubsub-bridge.ts
  world.ts client-factory.ts server.ts open-sim-sqlite.ts
  notes-app/                         # tiny defineSchema + mutations/queries
  shapes-app/                        # Sim Lab domain
  domain-pack.ts                     # notes | shapes
  faults.ts workload.ts invariants.ts replay.ts
  test-driver.ts

src/sim-lab/                         # interactive host + web UI
  server.ts host/ web/

src/tests/
  scenarios/                         # black-box correctness suite (51 files)
  harness/                           # sim kernel self-tests
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

- Filtering `_deleted_at IS NULL` inside `defineQuery.run` → tombstones never
  sync → stale live rows after soft-delete.
- Forgetting `_deleted_at` in SELECT → upsert won’t update deletion state.
- UI query missing live filter → soft-deleted rows appear in UI.
- Domain write outside mutations without `notifyChannels` → silent peer
  staleness.
- `DELETE FROM` in a mutation → `NO_HARD_DELETE`.
- Expecting unsubscribe to wipe domain rows → only `_scope_meta` clears.
- Expecting reject alone to revert domain rows → need a subsequent merge.
- Expecting multi-device domain edits &lt;100ms → use Room DO.
- Importing `@pkgs/sync-engine/src/...` → not public.
- Treating `declaredWrites` as enforced permissions — they’re not.
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
| Tombstone | Domain row with `_deleted_at` set; still synced |
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
| `checkpoint` | Per **scope** (query snapshot version) | `_scope_meta.last_checkpoint`, `POST /query` request/response |
| `pushSeq` | Per **topic** (push counter) | `_sync_topic_seq.n`, `PushMessage.pushSeq`, `_push_applied.last_push_seq`, `topicPushSeqs` |
| `seq` | Per **client** (mutation upload order) | `_mutations.seq`, upload wire `seq` / `ackSeq` |

---

## Related docs

- Root [`AGENTS.md`](../../AGENTS.md) — monorepo hard rules
- Product defs: `libs/<feature>/src/shared/{queries,mutations}/`
- Product client wiring: `apps/client/src/sync/create-local-sync-engine.ts`
- Product API wiring: `apps/api/src/sync/sync-app.ts`
- Topics: `libs/db/src/shared/sync-topics.ts`
- Schema: `libs/db/src/shared/app-schema.ts`

---

## Scenario catalog

Black-box correctness under `src/tests/scenarios/` (**51** files) plus harness
`src/tests/harness/kernel.test.ts`. Most scenarios use `openSimWorld` +
notes-app asserts. Row-image fanout is on unless a test sets
`rowImageFanout: false`. File names describe the behavior under test.

### Happy path / multi-client (9)

| File | Proves |
|------|--------|
| `single-client-mutate-uploads-and-persists.test.ts` | Single-client mutate uploads and persists title/body |
| `two-client-mutual-writes-converge.test.ts` | Two-client converge + seed sweep of mutual writes |
| `live-fanout-peer-visibility-within-budget.test.ts` | Happy-path live visibility within sim-time budget; restart rehydrates |
| `folders-and-notes-multi-table-converge.test.ts` | Folders + notes, `moveNote`, soft-delete folder leaves notes |
| `same-actor-two-devices-converge.test.ts` | Two devices, same `actorId`, concurrent writes converge |
| `peer-visibility-under-200ms-sim-budget.test.ts` | Peer visibility under 200ms simulated time with fixed one-way delay |
| `set-note-v1-v2-interleaved-converge.test.ts` | `setNote` + `setNoteV2` interleaved writes converge |
| `mutation-batch-over-max-drains-without-dupes.test.ts` | Queue > `MAX_MUTATIONS_BATCH` drains across batches without dupes |
| `hard-query-limit-truncates-hydrate.test.ts` | Hard query `limit` truncates hydrate; engine stays healthy |

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
| `auth-revoked-wipes-db-expired-refreshes.test.ts` | Expired refreshes and drains queue; revoked wipe drops unuploaded edit |
| `mid-session-authorize-deny-keeps-domain-rows.test.ts` | Mid-session authorize flip denies scope; domain rows remain |
| `pending-reject-surfaces-write-rejections.test.ts` | Pending rejectable mutate surfaces `write_rejections`; domain rolls back |

### Offline / crash / partition (8)

| File | Proves |
|------|--------|
| `two-offline-same-id-single-winner.test.ts` | Two-offline conflict on same id → single winner everywhere |
| `remote-fanout-races-local-pending-mutation.test.ts` | Remote fanout races a locally pending mutation; no stuck divergence |
| `crash-restart-rehydrates-and-drains-queue.test.ts` | Offline queue drains on reconnect; crash+restart rehydrates from server |
| `full-partition-during-write-then-heal.test.ts` | Full partition during write; heal converges |
| `offline-crash-partition-lifecycle-matrix.test.ts` | Offline, crash, partition, flip-flop contest matrix |
| `reupload-idempotent-no-duplicate-rows.test.ts` | Re-upload / repeated sets do not duplicate domain rows |
| `cache-clear-preserves-pending-mutations.test.ts` | Cache clear wipes domain; durable `_mutations` still upload and converge |
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
| `push-without-affected-rows-wakes-refetch.test.ts` | No `affectedRows` → pushSeq-only wake+refetch still converges |
| `push-tables-filter-wakes-overlapping-scopes.test.ts` | Push `tables` filter skips non-overlapping scopes; overlapping wakes |

### Membership topics / room live (6)

Notes-app `spaceMembership` session (`spaces` / `space_users` + room-scoped notes).
Channels follow `user:` + `room:` from live membership. Observability:
`client.pubsubRemakeCount()` / `client.subscribedTopics()`.

| File | Proves |
|------|--------|
| `leave-join-topics-without-pubsub-remake.test.ts` | Leave/join rooms sync topics incrementally — no pubsub remake |
| `peer-create-during-leave-keeps-mqtt-session.test.ts` | Peer create during leave does not wipe MQTT; rejoin hydrates |
| `topic-sync-waits-for-mutations-drain.test.ts` | Topic sync waits until pending `_mutations` drain |
| `room-live-isolated-until-member-joins.test.ts` | Room-B live does not reach room-A member until join |
| `join-paints-peer-space-note-via-live.test.ts` | After join, peer space note paints via live while sync held |
| `leave-drops-room-topic-until-rejoin.test.ts` | Leave/end drops room topic; further live missed until rejoin |

### Races / skew / lifecycle (6)

| File | Proves |
|------|--------|
| `live-vs-sync-ordering-races-converge.test.ts` | Hold live vs sync ordering races; live-only partition repaired via sync pull |
| `clock-skew-permutations-still-converge.test.ts` | Convergence under Alice/Bob/server clock-order permutations |
| `background-pauses-sweeps-foreground-catches-up.test.ts` | Background pauses remote sweeps; local optimistic still applies; foreground catches up |
| `online-mutate-no-optimistic-body-flicker.test.ts` | Online mutate never reverts optimistic body before quiescence |
| `delayed-sync-after-ack-no-optimistic-flicker.test.ts` | Delayed/reordered sync after ack never reverts optimistic body |
| `replay-pins-now-to-mutation-created-at.test.ts` | Replay pins `env.now` to mutation `createdAt` under client clock skew |

### Fuzz (1)

| File | Proves |
|------|--------|
| `seeded-workload-fuzz-determinism.test.ts` | Seeded workload determinism; corpus/env seeds; multi-client skew/crash; optional lossy faults |

### Unit / harness (2)

| File | Proves |
|------|--------|
| `in-memory-watch-reacts-to-local-insert.test.ts` | In-memory engine `watch` reacts to local domain INSERT (`createInMemorySyncEngine`) |
| `../harness/kernel.test.ts` | Sim kernel: RNG / scheduler / timers; membership topic sync |

### Alphabetical index (51 scenarios)

```text
auth-revoked-wipes-db-expired-refreshes
background-pauses-sweeps-foreground-catches-up
buffer-outbound-live-flush-on-reconnect
cache-clear-preserves-pending-mutations
clock-skew-permutations-still-converge
crash-restart-rehydrates-and-drains-queue
delayed-sync-after-ack-no-optimistic-flicker
denied-query-detaches-scope-keeps-rows
domain-hard-delete-rejected
dropped-live-repaired-by-refetch
folders-and-notes-multi-table-converge
full-partition-during-write-then-heal
hard-query-limit-truncates-hydrate
held-sync-upload-retries-on-release
in-memory-watch-reacts-to-local-insert
join-paints-peer-space-note-via-live
late-join-hydrates-soft-deleted-tombstones
leave-drops-room-topic-until-rejoin
leave-join-topics-without-pubsub-remake
live-fanout-peer-visibility-within-budget
live-loss-dup-reorder-still-converges
live-resend-on-reconnect-vs-drop
live-vs-sync-ordering-races-converge
mid-session-authorize-deny-keeps-domain-rows
mutation-batch-over-max-drains-without-dupes
non-owner-mutation-denied-owner-converges
not-modified-does-not-clobber-pending
offline-crash-partition-lifecycle-matrix
online-mutate-no-optimistic-body-flicker
oversized-fanout-falls-back-to-refetch
peer-create-during-leave-keeps-mqtt-session
peer-visibility-under-200ms-sim-budget
pending-reject-surfaces-write-rejections
permanent-reject-stored-peer-never-applies
push-tables-filter-wakes-overlapping-scopes
push-without-affected-rows-wakes-refetch
remote-fanout-races-local-pending-mutation
replay-pins-now-to-mutation-created-at
requires-online-fails-offline-without-queue
reupload-idempotent-no-duplicate-rows
room-live-isolated-until-member-joins
same-actor-two-devices-converge
seeded-workload-fuzz-determinism
set-note-v1-v2-interleaved-converge
single-client-mutate-uploads-and-persists
soft-delete-tombstone-propagates-and-revives
sync-hold-reorder-dup-still-converges
sync-partitioned-while-live-delivers
topic-sync-waits-for-mutations-drain
two-client-mutual-writes-converge
two-offline-same-id-single-winner
```
