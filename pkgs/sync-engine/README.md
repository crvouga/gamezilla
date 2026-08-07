# `@pkgs/sync-engine`

Local-first sync between **client SQLite** and **server Postgres**.

**How to use this file:** A blank agent (or human) with *only* this README
should be able to (1) explain the system correctly, (2) review PRs against
invariants, and (3) discuss design / recommend improvements without inventing
history. Prefer this doc over training data or old chat transcripts.

Related: root [`AGENTS.md`](../../AGENTS.md), [`src/sim/README.md`](src/sim/README.md).

---

## One-sentence mental model

The client is a **replicator**: the server sends **full query snapshots that
include soft-deleted rows**; the client **upserts every row verbatim**, then
**re-applies its pending local mutations on top**. Deletion is data
(`_deleted_at`), never inferred from absence. Peers learn about each other’s
changes only via **pubsub nudge → query refetch** (no peer mutation fanout).

```text
mutate() ──► local SQL + _mutations row ──► POST /mutations ──► Postgres replay
                                                              │
                                                              ▼
UI ◄── useQuery(watch) ◄── SQLite ◄── merge(upsert + re-apply) ◄── POST /query
                                         ▲
                                         └── pubsub nudge (tables filter)
```

**This package is not a CRDT, not OT, not a realtime game bus.** Realtime
shared play lives on the **Room Durable Object** (spaces). Sync-engine is the
authoritative **durable domain mirror** (friends, profile, spaces metadata,
puzzle catalog/progress, client config, inbox rows, auth entities).

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
5. **Efficiency** — hash/`not_modified`, nudge table filtering, coalesce,
   single-flight merge. Secondary to 1–4.

**Anti-goals:** sub-100ms multi-device domain edits via MQTT; perfect GC of
every row the moment it leaves a query; zero stale locals; custom per-feature
REST sync.

---

## Public API (four entrypoints only)

Deep imports under `src/` are **not** public. Consumers must use:

| Import | Role |
|--------|------|
| `@pkgs/sync-engine/client` | Expo / React Native engine, React hooks, HTTP client |
| `@pkgs/sync-engine/server` | Hono sync app (`POST /query`, `POST /mutations`), `notifyChannels` |
| `@pkgs/sync-engine/shared` | `defineQuery` / `defineMutation`, registries, soft-delete helpers, framework DDL |
| `@pkgs/sync-engine/test` | `createInMemorySyncEngine` for unit tests |

Package layout rule (monorepo): this is a **flat `pkgs/` package** — agnostic
utility, **no** product imports (`@libs/*`, `gamezilla`, apps). Product topics
and schemas live in `@libs/db` / feature packages; the engine only sees
registries + SQL clients + pubsub ports.

---

## System boundary map

```text
┌─────────────────────────────────────────────────────────────┐
│ apps/client                                                  │
│  createLocalSyncEngine + sessionQueries + MQTT nudges        │
│  useQuery / useMutationClient                                │
└───────────────────────────┬─────────────────────────────────┘
                            │ POST /query, POST /mutations
                            │ MQTT nudges (EMQX)
┌───────────────────────────▼─────────────────────────────────┐
│ apps/api  createSyncApp                                      │
│  runQuery / processMutationsBatch / notifyChannels           │
│  Postgres (domain + _mutations_applied + write_rejections)   │
└───────────────────────────┬─────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
   Room DO             Stripe/etc            REST exceptions
   (realtime play)     (external)            friends/search,
                                             client-config/refresh
```

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

**Scopes:** each `(name, params)` pair hashes to a `scope_hash`. Active scopes
are refcounted subscriptions. Checkpoint + content hash live in `_scope_meta`.

**Limits:** every query has a hard `limit`; `runQuery` truncates across tables.
Unbounded sync is forbidden by design (Tiger).

### Mutations (`defineMutation`)

A mutation is the **only** legal domain write path (client + server).

```ts
defineMutation({
  name: 'removeFriend',
  args: z.object({ ... }),
  writes: ['friendships'],       // docs + nudge table filter (not runtime-enforced)
  invalidates: (args, env, db) => topics, // post-replay pubsub topics
  requiresOnline: false,
  constraintErrors: { ... },     // map PG unique violations → business codes
  run: async ({ tx, env }, args) => { /* SQL only */ },
});
```

Rules:
- Bodies must **soft-delete** (`UPDATE … SET _deleted_at = …`), never
  `DELETE FROM` domain tables. `wrapMutationDb` throws `MutationError`
  `NO_HARD_DELETE` on domain hard deletes at apply **and** replay.
- Use `softDeleteById` / `LIVE_ROW_SQL` from `@pkgs/sync-engine/shared`.
- Breaking wire changes → new `name` (`joinSpaceV2`); keep old handlers until
  clients adopt.
- Server replay is idempotent via `_mutations_applied` (keyed by mutation id).
- Framework mutations (e.g. acknowledge write rejection) are merged via
  `withFrameworkMutations`.

### Sync engine (client)

`createLocalSyncEngine` owns:
1. Local schema migrate (framework + domain via `@pkgs/db-schema/sqlite`)
2. `SubscriptionRuntime` — coalesce → `POST /query` → merge
3. `MutationUploadQueue` — drain `_mutations` → `POST /mutations`
4. Optional `attachNudges` — MQTT topics derived from active query `channels`
5. Table-change bus + `watch` / React `useQuery`

Paint gate: `waitForFirstSync()` awaits **sessionQueries** (held for the engine
lifetime). Product session list today (apps/client): identity + shell —
`ownUser`, `ownDevices`, `ownExternalAccounts`, `ownProfile`, `clientConfig`,
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

Nudges carry optional `tables` (= mutation `writes`) so the client wakes only
scopes whose `hydrates` overlap.

### Channel exhaustiveness

CI `ci:channel-exhaustiveness` statically checks: if a mutation `writes`
tables that a query `hydrates`, their topic sets should overlap (sentinel args).
Async `invalidates` is approximated. Missed `notifyChannels` on non-mutation
server writes is a separate runtime footgun — prefer mutations.

---

## Tables

### Local SQLite (framework)

| Table | Durable? | Purpose |
|-------|----------|---------|
| `_mutations` | yes | Pending upload queue only: `id, name, args, client_id, seq, created_at` |
| `_scope_meta` | cache | Per-scope `last_checkpoint`, `last_hash`, `last_active_at` |
| `write_rejections` | cache | Permanent failures (local or synced) |

`seq` = `COALESCE(MAX(seq),0)+1` inside the mutate transaction. Server
idempotency is by **mutation id**, so seq restarts are harmless.

**Deleted on purpose (do not resurrect without a design review):**
`_row_scopes`, `_upload_state`, `_peer_applied`, `_peer_mutations`, write-epoch
/ soft-ack / `status` / `acked_epoch` columns, MQTT mutation fanout payloads.

`SCHEMA_EPOCH` bumps wipe **cache** tables and drop retired tables; durable
`_mutations` survive epoch wipe semantics carefully (see migrate code —
domain cache tables + framework cache names).

Domain tables come from the host’s `LocalDomainSchema.domainSchema` (e.g.
`@libs/db` `appSchema`). Managed columns include `_deleted_at`.

### Server Postgres (framework)

Applied by `applyFrameworkServerDdl` at migrate time (not domain
`defineSchema`):

| Table | Purpose |
|-------|---------|
| `_mutations_applied` | Idempotency + audit (`applied` / `rejected`) |
| `write_rejections` | Permanent failures keyed by `client_id` (= device id) |

`public._mutations` is **dropped**. Uploads are JSON to `POST /mutations`, not
row sync of a `_mutations` table.

`pruneMutationArtifacts` deletes old `_mutations_applied` + acknowledged
`write_rejections` (ops/scheduled job, not request path).

---

## Wire protocol

### `POST /query`

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
- Same content hash as `lastHash` → `not_modified`
- Auth failure → HTTP 401 `{ error: 'auth', reason: 'expired' | 'revoked' }`

**Removed forever (unless redesign):** `mode: 'delta' | 'full'`, `resync`,
`gone`.

### `POST /mutations`

```ts
{ mutations: Array<{ id, name, args /* JSON string */, clientId, seq, createdAt }> }
→ { ok: true, verdicts: Array<applied | rejected>, ackSeq }
```

Bounds: `MAX_MUTATIONS_BATCH = 64`. Client ack = **delete** local `_mutations`
row (applied or rejected). Rejected also writes local `write_rejections`.

After successful replay, server `notifyChannels({ topics, checkpoint, tables })`.

### Pubsub nudge

```ts
{ checkpoint?: string; tables?: string[] }
```

No mutation SQL on the wire. Client may ignore checkpoints that are already
applied only by refetching; wasted wakes cost a `not_modified` (acceptable).

---

## Client merge algorithm

For each `ok` response (single-flight per DB — `MAX_IN_FLIGHT_POLLS = 1`):

1. Skip if checkpoint ≤ stored `_scope_meta.last_checkpoint` (stale).
2. Per table: upsert column intersection **verbatim** (incl. `_deleted_at`).
   No tagging, no absence tombstones, no orphan GC.
3. Touch `_scope_meta`.
4. Re-apply every pending `_mutations` for this `clientId` in `seq` order.
   Throws swallowed → optimistic effect hidden until upload/reject.
5. Emit table-change bus for watches.

`detachScope` (unsubscribe / `denied`) = delete `_scope_meta` row only.

---

## Subscriptions & nudges

### `SubscriptionRuntime`

- One coalesce queue (`QUERY_COALESCE_MS = 0` → microtask coalesce)
- One in-flight flush; further wakes queue
- Background (`AppLifecycle`) pauses sweeps
- Session queries held for engine life; paint waits on them

### `attachNudges`

- Topics from active query `channels(ctx)`
- **Remake-on-topic-change** (close + new pubsub; all topics subscribed at birth)
- Reconnect → `wakeAll()`
- Local `spaces` / `space_users` changes refresh membership topics

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
| Upload success | Delete queue row; peers learn via nudge → query |
| Upload reject | Delete queue row + `write_rejections`; UI should surface rejection |
| Merge while pending | Server snapshot applied, then pending mutations re-run |
| Stale snapshot | Checkpoint compare drops it |
| Denied query | Detach scope meta; domain rows remain |
| Auth revoked | Wipe identity DB |
| Nudge lost | Next reconnect / foreground / remake eventually refetches |
| Partial multi-query batch | Per-response apply; generation guards drop superseded scopes |

**Not provided:** causal multi-device domain locks, exactly-once UI effects,
guaranteed absence of flicker after ack (see tradeoffs).

---

## Locked decisions vs open design space

### Locked (require explicit user buy-in to reverse)

- Soft-delete-only domain rows + tombstones on the wire
- Snapshot merge (not delta protocol) as the default truth path
- No peer mutation fanout / no `_peer_mutations`
- No `_row_scopes` / absence-as-delete
- No write-epoch soft-ack barrier (ack deletes queue row)
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
- Upload wake after ack to coalesce query refresh (today relies on nudge)
- Sim coverage expansion / fixing stale `TIGER_INVARIANTS` name list
- Clearing stale locals that left a scope without soft-delete (product policy)
- `process-upload-with-mutations` legacy CRUD path — simplify or delete if unused

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
3. **Ack-then-stale-merge flicker** — merge from a pre-replay snapshot can
   briefly undo optimistic UI until nudge refetch. Rare; fix only with
   measured pain (don’t restore full write-epoch machinery lightly).
4. **Full snapshot cost** — large `chessPuzzlePool` / interactions payloads.
   `not_modified` helps when unchanged; first fetch / rating band change is
   heavy. Deltas are a last resort after measuring.
5. **Remake-on-topic-change** — membership churn remakes MQTT; simpler than
   late-topic timers, but reconnect storms possible if membership thrash.
6. **Paint waits on all session queries** — correct single lifetime model;
   may delay first paint vs old boot/shell split.
7. **Re-apply swallows errors** — pending mutation that fails against new
   server state stays queued until upload reject; UI may look “stuck”
   optimistic. Product should watch `write_rejections`.
8. **`writes` not runtime-enforced** — documentation + nudge filter only;
   a mutation can touch undeclared tables.
9. **Channel exhaustiveness is sentinel-based** — async party expansion and
   weird args can false-pass/fail.
10. **Legacy upload CRUD classifier** (`process-upload-with-mutations`) —
    historical path; main product uses `/mutations` JSON.

---

## Complexity hotspots (edit carefully)

| Area | Why it’s sharp |
|------|----------------|
| `client/merge.ts` | Single-flight + checkpoint + upsert + re-apply; correctness core |
| `client/subscription-runtime.ts` | Coalesce, generation guards, lifecycle, session refs |
| `client/attach-nudges.ts` | Topic remake vs membership ctx races |
| `mutations/server/replay-mutation.ts` | Idempotency + rejection recording + constraint mapping |
| `client/local-schema-migrate.ts` | Epoch wipe vs durable queue |
| Product `invalidates` / `channels` | Wrong topics ⇒ silent staleness |

Prefer deleting machinery over adding flags. If a proposal adds a table or wire
status, it needs a stronger justification than “might be useful.”

---

## Performance characteristics (current)

- Query HTTP: batched, max 64 per POST; 1 in-flight batch per client runtime
- Mutation HTTP: batched, max 64; upload loop idle wake ~100ms / error 2s
- Coalesce: microtask (0 ms) — bursts collapse without timer delay
- Cache hit: content hash → `not_modified` (empty body)
- Merge: column-intersect upsert per row (not bulk COPY)
- Watches: table-change bus; SQL re-run on overlapping table names
- Nudges: table-filtered scope wake; reconnect full wakeAll

Measure before proposing deltas, indexes, or parallel in-flight polls.
Raising `MAX_IN_FLIGHT_POLLS` re-opens merge races unless merge stays
single-flight (it does) — mainly HTTP/server load then.

---

## Schema & versioning

- **Domain schema:** `@libs/db` `defineSchema` / `appSchema`; local reconcile via
  `@pkgs/db-schema/sqlite`; Postgres migrate separate.
- **Framework local:** `FRAMEWORK_LOCAL_DDL` + `SCHEMA_EPOCH` in
  `queries/client/local-schema.ts`.
- **Framework server:** `FRAMEWORK_SERVER_DDL` via `applyFrameworkServerDdl`.
- **Query/mutation wire names:** append `V2` for breaking changes; keep old
  handlers until clients migrate.
- **Cache clear:** `clearLocalData({ reason: 'cache' })` drops cache tables and
  recreates schema; durable `_mutations` policy follows migrate helpers.

---

## App wiring (Gamezilla)

**Client**

1. Open identity SQLite → `createLocalSyncEngine({ sessionQueries, postQueries,
   postMutations, nudges, lifecycle, … })`
2. `SyncEngineProvider` + `SqlClientProvider` + paint gate
3. `MutationClientProvider` with `MutationEnv` + `{ clientId: deviceId }`
4. Feature: `useQuery(sql\`… AND _deleted_at IS NULL\`)` +
   `useMutationClient().mutate(def, args)`

**API**

1. `applyFrameworkServerDdl` during migrate
2. `createSyncApp({ resolveAuth, getSql, queries, mutations, pubsub })`
3. Non-mutation DOMAIN writes must `notifyChannels`

Registries: `apps/client|api/src/sync/app-queries.ts` + `app-mutations.ts`.

---

## Directory map

```text
pkgs/sync-engine/src/
  client/           # engine, merge, subscriptions, nudges, React, HTTP
  mutations/
    core/           # defineMutation, types, registry
    client/         # createMutationClient, mutation-status
    server/         # replay, batch, prune, legacy upload classifier
    shared/         # wrapMutationDb, soft-delete, framework mutations
  queries/
    core/           # defineQuery, types, registry
    server/         # runQuery
    client/         # local-schema, sql-watch, table-change-bus
    shared/         # hash/canonical, bounds, tiger invariant names
  server/           # createSyncApp, routes, notifyChannels
  shared/           # framework DDL, channel exhaustiveness, nudge types
  sim/              # deterministic multi-client simulation
  test/             # in-memory engine
```

---

## React hooks (client)

| Hook | Use |
|------|-----|
| `useSyncEngine()` | Reactive status + paintReady + methods |
| `useSyncEngineInstance()` | Stable engine (effects/providers) |
| `useQuery(sql)` | Live SQLite watch |
| `useMutationClient()` | `mutate(def, args)` |

Mutation UX (product/`@pkgs/ui`, not this package): destructive →
`MutationModal`; light → `useMutationButton`. Don’t `router.back()` from
mutation `onSuccess` — stay and let SQLite drive UI.

---

## Testing & CI

```bash
bun run --filter @pkgs/sync-engine tc
bun run --filter @pkgs/sync-engine test
bun run ci:no-domain-hard-delete
bun run ci:channel-exhaustiveness
bun run ci:lint
```

- Unit/scenario: `src/**/*.test.ts` (Bun)
- Sim: `src/sim/` — seed-reproducible multi-client world ([sim README](src/sim/README.md))
- Dual-platform harness: mutation parity SQLite ↔ Postgres
- `@pkgs/sync-engine/test`: `createInMemorySyncEngine`

`queries/shared/tiger-invariants.ts` lists named invariants; some names still
refer to the pre-simplification rebase/epoch era — **trust this README’s
behavior section over stale invariant titles**, and update that list when
touching sync core.

---

## Invariants / non-goals (do not “fix” these)

1. No domain hard deletes — soft-delete only.
2. No peer mutation replay — nudge + query only; realtime = Room DO.
3. No `_row_scopes` / multi-scope absence GC.
4. No write-epoch / soft-ack barrier — ack deletes queue row.
5. No delta / resync / gone wire shapes.
6. No feature REST for sync-scoped data (tiny exception list in `AGENTS.md`).
7. No deep public imports — four entrypoints only.
8. No dependency patches; no biome size-rule disables for app code.
9. No pkgs → libs/apps imports.
10. Actor identity comes from session auth only (never trust client-supplied
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
- Expecting multi-device domain edits &lt;100ms → use Room DO.
- Importing `@pkgs/sync-engine/src/...` → not public.
- Treating `writes` as enforced permissions — they’re not.
- Reintroducing boot vs shell subscription special cases without measuring
  paint cost.

---

## Glossary

| Term | Definition |
|------|------------|
| Scope | One subscribed `(queryName, params)` identity (`scope_hash`) |
| Session queries | Scopes held for engine lifetime; paint gate waits on them |
| Tombstone | Domain row with `_deleted_at` set; still synced |
| Nudge | Pubsub message that wakes overlapping query scopes |
| Replay | Server re-executes mutation SQL idempotently |
| Re-apply | Client re-runs pending mutation SQL after a merge |
| Paint gate | UI blocked until session queries first-sync |
| Durable / cache | Local tables that survive vs wipe on epoch/cache clear |

---

## Related docs

- Root [`AGENTS.md`](../../AGENTS.md) — monorepo hard rules
- [`src/sim/README.md`](src/sim/README.md) — deterministic simulation
- Product defs: `libs/<feature>/src/shared/{queries,mutations}/`
- Topics: `libs/db/src/shared/sync-topics.ts`
- Schema: `libs/db/src/shared/app-schema.ts`
