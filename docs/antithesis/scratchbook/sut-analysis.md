---
sut_path: /Users/chrisvouga/gamezilla
commit: ddde94db466ae77df20385c54ead0c79ae20b2c8
updated: 2026-09-01
external_references: []
---

# SUT Analysis — Gamezilla

Scope answer used: **"Just this directory"**. External references: none. In-tree docs and code are leads, not verified facts. Claimed guarantees are phrased as claims.

HEAD: `ddde94db466ae77df20385c54ead0c79ae20b2c8`. The working tree has substantial uncommitted work (auth OAuth, db-indexes, sync notify). Analysis reflects the tree as read on 2026-09-01.

## Summary

Gamezilla is a social lobby + games product (Expo iOS/web). A fresh install is a real anonymous `users` row with a per-user local SQLite file. Signed-in users create/join spaces and play **chess puzzles inside a space** (host solves, guests spectate). Durable social state (profile, spaces metadata, friends, puzzle stats, notifications, `client_config`) is a **local-first sync-engine**. Live play is a **separate room event log** on a Cloudflare Durable Object.

Two write planes must not be confused:

1. **`@pkgs/sync-engine`** — SQLite ↔ Postgres via HTTP (`POST /api/query`, `POST /api/mutations`, protocol **v3**) plus optional MQTT row-image fanout. The system claims **server-authoritative LWW by upload arrival**, not a CRDT. Snapshots are the claimed truth path; MQTT is a lossy optimization.
2. **`@pkgs/room` + `RoomServerDurableObject`** — WebSocket event log per `space:{id}`, wire `v=1`, `commandId` dedup, `RoomModule.hash(state)`.

The in-house `@pkgs/sim` sim already injects clock, RNG, HTTP, and an in-process network mesh. `SIM_FIDELITY=max` boots real Postgres/MinIO/EMQX **and skips world-mesh partitions**. Antithesis is not a duplicate of that sim: it is the class of faults (real sockets, process kill, disk, wall-clock, asymmetric partitions) that PBT policy declined (`PBT_AUDIT.md`: Hono/Wrangler/live Neon/e2e “not isolated”).

No Antithesis SDK is present. See `existing-assertions.md`.

## Architecture and data flow

[architecture]

### Deployed processes

| Process | Entry | Notes |
|---|---|---|
| API Worker `gamezilla-api` | `apps/server/src/server.ts` | Cloudflare Worker; prod `api.gamezilla.app`. Cron `*/1 * * * *` drains outbox. |
| Room Worker `gamezilla-room` | `apps/room-server/src/room.ts` | Separate Worker; owns `RoomServerDurableObject`. API binds it cross-script (`script_name = "gamezilla-room"`). |
| Expo client | `apps/client` → `createClient(wallClientEnv())` | iOS / web. Per-user SQLite `user_<first12HexOfUsersId>`. |
| Sim console | `product/console` `createSim` | Dev only. In-process Hono + loopback rooms. Reports port 7789. |

Production sidecars: Neon Postgres, Railway EMQX, Backblaze B2. Optional: Stripe, ElevenLabs, OpenAI (503 if secrets missing). Local sim default: postgres-mem + sqlite-mem; `max` boots embedded Postgres + MinIO + EMQX.

Sim collapses Worker+DO+EMQX into one process (`serveFetch`, `createInMemoryPubSub`, `createRoomServer`). That is a **fidelity gap**, not the production topology.

### Ingress

Worker `handleWorkerFetch` before Hono:

1. `GET\|HEAD /api/health` — **no boot, no DB**. `{ status: 'ok' }`.
2. Misrouted `GET\|HEAD /sso-callback` — 302 to web origin.
3. CORS preflight.
4. `ensureApp` — one-shot `createServer`. Config errors latch fatal → 503 `{ error: 'api misconfigured' }` while health stays 200.
5. Uncaught → 500.

Hono: observability → `createRequestDbMiddleware` (Postgres + ALS + session auth + `client_config` materialize) → CORS → routes → `onError`. Per-request SQL is opened and `disconnect()`’d in `finally`. Post-success `POST …/mutations` also drains the outbox on the same SQL.

Auth is **token-only**. README claims the API never reads/sets cookies. Clients send `Authorization: Bearer` and always `x-anon-id` (install UUID). Sync JWT `sub` is claimed to always be `users.id`.

### Request map (prefix `/api`)

| Path | Role |
|---|---|
| `GET /health` | Liveness of the isolate only |
| `/auth/oauth/launch`, `/auth/callback/:provider`, `/auth/session`, `/auth/sign-out` | IdP |
| `POST /identity/anon/ensure`, `/identity/refresh` | Anon mint / upgrade / switch |
| `POST /query`, `POST /mutations` | Sync protocol v3 (`x-sync-protocol: 3`) |
| `POST /pubsub/token` | MQTT JWT (15 min, ACL on `user:{id}`, `system:client_config`, `room:{spaceId}`) |
| `GET /room?topic&module&token&anonId&clientId` | WebSocket upgrade → DO. Gateway **never blocks on auth**; bearer failure falls back to `anonId` then a fresh `createId()`. |
| `POST /friends/search` | Cross-user REST exception |
| Billing / TTS / LLM | Optional vendors; 503 if unconfigured |
| Matchmaking | Mounted; no product UI found |
| Notifications REST | OOB domain writes + `notifyChannels` |

### Sync path

```
UI mutate()
 → local SQLite txn: domain SQL + INSERT sync_engine_mutations
 → POST /api/mutations (max 64)
 → one Postgres txn: replay (now pinned to mutation createdAt) + mutations_applied
 → allocateTopicPushSeqs + fire-and-forget EMQX publish
 → peers: MQTT row images (if contiguous pushSeq) OR POST /api/query refetch
 → upsert intersecting columns (incl. deleted_at) + rebase pending mutations
```

Client session queries are held for engine life. Product `paintReady` is an identity-match gate after local DB open — docs claim it does **not** wait for first-sync. Web: only the `sync-owner:` Web Lock holder uploads and attaches MQTT.

### Room path

```
RoomClient → ws(s)://{api}/api/room?topic=space:{id}&module=space&token&anonId&clientId
 → env.ROOM.get(idFromName(topic)).fetch (Upgrade preserved)
 → RoomServerDurableObject → RoomServer
```

Wire JSON `WIRE_VERSION = 1`. Committed events have monotonic `seq` per topic. Persistence keys `room.do.v3.*`. Same `(identity, clientId)` take-over closes prior socket **4000**. Module name `'space'` composed from chess. Sim uses loopback `RoomServer` — no WS, no DO.

### Serialization boundaries

| Boundary | Format | Version |
|---|---|---|
| Sync HTTP | JSON snapshots + mutation batch | `x-sync-protocol: 3` (source file still `protocol/v2.ts`) |
| Sync push | JSON MQTT | `pushSeq` string |
| Room WS | JSON frames | `v: 1` |
| Pubsub auth | MQTT username `jwt` | HS256, 15 min |
| Three sequences | Must not be conflated | checkpoint (query scope), pushSeq (topic), client mutation `seq` |

## State management and persistence

[state]

### Synced domain (`appSchema`) — Postgres + per-user SQLite

`auth_users`, `auth_devices`, `auth_external_accounts`, `profile`, `spaces`, `spaces_users`, `spaces_open_sessions`, friends tables, chess puzzle tables, `client_config`, `notifications`. Managed columns `id`, `created_at`, `updated_at`, `deleted_at`. The system claims **soft-delete only** on domain tables; mutation wrap throws `NO_HARD_DELETE`. Snapshots **include** tombstones; UI filters `deleted_at IS NULL`.

### Framework tables

**Server Postgres:** `sync_engine_mutations_applied` (idempotency; claimed never pruned), `sync_engine_write_rejections`, `sync_engine_topic_seq`. Plus outbox, kv, entity_store, matchmaking — **not** in `appSchema`.

**Client SQLite:** `sync_engine_mutations` is the **durable upload queue** (survives `SCHEMA_EPOCH` cache wipe). Scope meta, push_applied, local rejections, optimistic peer rows are cache. `SCHEMA_EPOCH = 12`.

### Not synced

- **IdP** (`idp_*`): sessions, OAuth state, provider codes. Postgres only.
- **Room log:** Durable Object SQLite keys `room.do.v3.*`. Client room cache is platform Kv (localStorage / AsyncStorage), **not** the identity SQLite file.
- **Object store:** S3/B2 with prefix `gamezilla/`; missing secrets → in-memory (isolate-local).
- **EMQX:** ephemeral. Publish is HTTP from the Worker (publish-only port). Subscribe is MQTT WSS from the client. Broker URL is a **synced `client_config` row** — cold start is poll-only until that row hydrates.

### Consistency claims (to test)

- Offline sync is **LWW by upload arrival**, not timestamp compare, not CRDT. Merge upserts snapshot columns verbatim.
- Fanout may be lost/reordered/duplicated; snapshots + 30s reconcile (`QUERY_RECONCILE_INTERVAL_MS`) are the claimed repair. Sim uses 500ms.
- `notifyChannels` allocates `pushSeq` in Postgres **then** fire-and-forget publish. Failures logged, never retried. A kill between allocate and publish leaves a **permanent seq gap**.
- Empty snapshot / empty secondary scope must not wipe unrelated domain rows (pinned by wipe/clobber tests).
- Device-private rows (`spaces_open_sessions.device_id`) must not land via user-topic fanout.
- Room: contiguous seq; live state equals log fold; `commandId` applies once.

## Concurrency model

[concurrency]

Product code is TypeScript on JS event loops. No OS mutexes on the write path. Concurrency is promise-chain serialization + multiple Worker isolates + one SQLite writer per local DB + one DO isolate per room topic.

Hottest races (claims to test, not established):

- **`acquireLock` is a no-op.** Per-user mutation serialization is “outer request txn + unique mutation id.” Postgres isolation is default READ COMMITTED (never set).
- **Outbox `claimDueDeliveries` is SELECT without `FOR UPDATE` / `SKIP LOCKED`.** Drain runs after `/mutations`, from notification actions, **and** from cron on a second DB session. Comment says “single Worker drain.” Two isolates can both select the same rows. Cron does not set ALS → can mark processed and **skip EMQX notify**.
- **`handlePush` is fire-and-forget per MQTT message.** `last_push_seq` read → contiguous check → apply → record spans awaits. Two `N+1` deliveries can both pass. Merge of snapshots **is** single-flight per `SqlClient`.
- **Upload `stop()` orphans in-flight POST.** Server may have applied; retry depends on `mutations_applied`.
- **DO `webSocketMessage` is not wrapped in `blockConcurrencyWhile`.** Restore/create is. RoomServer uses `storageChain` + per-connection `commandChains`; both `.catch(() => undefined)`.
- **Web:** three ownership schemes — SQL SharedWorker/Web Lock, `sync-owner:` lock, per-tab room `clientId`. A tab can own SQL, not own sync, and still be a live room peer. Followers do not upload.
- **Checkpoint allocator** is isolate-local (`checkpointSeq` in `createSyncApp`), not a DB sequence.

## Claimed safety guarantees

[safety]

These are **claims**. Do not treat them as facts.

**Sync:** no domain hard deletes; replay idempotent by mutation id including crash-after-accept; pending seqs strictly increasing; rejected ids not queued; push seq and scope checkpoint never regress; revoke wipes identity SQLite, expiry/`upgrade_required` must not; optimistic body must not flicker after own ack; actor identity from session only; denied query detaches scope meta but keeps domain rows; cross-tenant rows never hydrate; account-switch pending A must not appear in B; **exactly-once UI effects are explicitly not provided**.

**Room:** one log per topic; live hash equals fold; commandId once across reconnect/take-over/flood; remaining time in committed events; elapsed uses server `command.ts`; take-over does not transfer ownership; forged frames must not change authority.

**Auth:** token-only API; per-user SQLite isolation (not encrypted at rest); peppered SHA-256 of tokens; sign-out invalidates only that session; `upsertExternalAccount` never reassigns `user_id`.

**Schema/indexes:** Postgres reconcile refuses DROP/ALTER TYPE/RENAME; SQL engines must not mint time or ids; non-deploy must never reach production Postgres.

**Pubsub:** malformed frames dropped, never thrown; `publish` resolve means accepted, not delivered; `close()` terminal.

## Claimed liveness guarantees

[liveness]

No failover-within-X-seconds SLO was found.

- Missed notify / lost push: next reconnect, foreground, reconcile tick (30s product / 500ms sim), or membership `wakeAll` eventually refetches. Sweeps claimed to pause while backgrounded.
- Durable mutation queue eventually uploads once origin is reachable and auth is valid (not revoked). Topic subscribe waits until the local queue drains.
- After harness heal, DST worlds claim client–server domain match. That is **test-world settle**, not production recovery without those nudges.
- `paintReady` is **not** a hydration liveness property.
- MQTT adapters reconnect; 600s session expiry; overflow → domain HTTP is the catch-up. QoS1 is not claimed eventually delivered.
- Outbox: 8 attempts, then park `available_at` + 1 year. Not unbounded eventual delivery.
- Room: `sync(fromSeq)` + commandId dedup after reconnect; WS heartbeat 20s / pong miss 8s; DO `alarm()` recreates servers after eviction.
- Expired token refreshes; queued mutations then drain. Anon ensure retries on `HttpNetworkError` while origin availability is down.

## Bug history and density

[bugs]

Confirmed, pinned defects cluster in four framework packages. `PBT_FINDINGS.md` records **harness-only** failures and an empty production table. A filed issue is not in scope (just this directory); pins below are in-tree tests with mechanism comments.

**Hotspots (primary evidence in tests/comments):**

1. **sync-engine wipe/clobber/same-account fanout** — empty profile fanout blanking peer username; device-private open-session leaking across devices; friend-hosted space missing on cold hydrate; `not_modified` clobbering pending; client-ahead columns overwritten; empty secondary snapshot wiping live rows; wrong topic-map silent staleness; account-switch SQLite close order.
2. **db-schema rebuild data-loss** — five documented planner/emit bugs in `bugs-found.md` (indexes lost after rebuild, backfill omitted, `copyColumns: []`, in-place type change, `_meta` ident). All marked fixed with pins.
3. **db-indexes planner crashes** — unique `autoidx_*` imposter; stale fingerprint assert.
4. **sql-client Hermes bigint** — Postgres `int8` as `bigint` crashed Expo hydrate.

Room/chess/matchmaking have large **designed** failure catalogs (not a bug graveyard). Chess competition races Gc4–Gc6 are `test.skip`.

**Quiet / undertested (no bugs-found, no pin comments):** `libs/friends` graph mutations, billing, profile (the empty-username wipe is pinned in sync-engine’s Acme fixture, not `@libs/profile`), client-config materialize, `apps/server` outbox composition, `pkgs/outbox`, `pkgs/auth` (young DST), matchmaking (volume but no findings log).

Unvalidated git subjects (do **not** treat as confirmed defects): SQL injection in upload handler; spaces invite accounting.

## Existing test strategy vs Antithesis

[tests]

~581 unit/spec files, ~202 sim tests, 8 system PBT worlds, ~63 pbt files.

The determinism harness: virtual `SimClock`, in-process `SimNetwork` (delay/loss/dup/hold/undirected partition), in-process crash = dispose+remake (often `preserveLocalDb: true`). Settle **heals then checks**. Mid-fault safety lives in named `never` pins, not in shrinking PBT postconditions.

Auth PBT: no partitions, no crash, fake Google. Product Playwright: auth OAuth harness + sql-client OPFS only — **no product Expo/web e2e**. Load: none as a campaign. `fidelity: max` skips mesh.

**Antithesis unique value (do not duplicate named sim pins):**

| Fault | Sim | Antithesis |
|---|---|---|
| Timing | Discrete scheduler; no deadline reorder | Thread pause, CPU modulation, real async across processes |
| Clock | Logical skew offset | Wall-clock jump (TLS, MQTT keepalive, session TTL, DO alarms) |
| Network | In-process undirected mesh | Real TCP/TLS/WSS/MQTT; **asymmetric** loss; new IPs after restart |
| Process | In-process remake | Kill API / client; lose non-durable FS; DO eviction |
| Disk | Armed `SQLITE_FULL` | Real ENOSPC, fsync fail, WAL tear — especially vs `journal_mode=MEMORY` |

## Failure and degradation modes

[failure]

No circuit breakers. Recovery is backoff + 30s reconcile + idempotent replay.

**Health lies:** `/api/health` is 200 while boot is fatal, Postgres is down, or EMQX is down. Client origin gate treats 2xx `{status:'ok'}` as available. Completed **5xx** also `noteSuccess`. Only thrown `HttpNetworkError` marks unavailable.

**Messy states of highest Antithesis interest:**

- Mutations committed, `pushSeq` allocated, publish lost — peers stale until 30s tick.
- Outbox processed, notify skipped (cron/ALS/pubsub miss).
- Double outbox delivery (unlocked SELECT).
- Exhausted outbox parked +365d — silent.
- `upgrade_required` — local DB intact, uploads retry forever, no upgrade UI found.
- OAuth `consumeExchangeCode` is SELECT then DELETE — two concurrent exchanges can both create sessions.
- Google code consumed, attach failed — user exists, client has no session.
- Room stale bearer → anon actor — host checks see the wrong identity.
- SQLite `journal_mode=MEMORY` — crash mid-txn can corrupt; recovery **deletes the DB file** (pending queue gone).
- EMQX `publish()` `waitUntilConnected` has **no timeout**.
- Multi-tab: owner tab down → queue stuck on followers.
- Isolate restart: in-memory S3 fallback empty; in-flight 500.

## External dependencies

[deps]

Product request path has **almost no timeouts** on Neon connect, S3, EMQX HTTP publish, Google, Stripe, ElevenLabs, OpenAI. `fetchWithRetry` is provision-only.

| Dep | Prod | Default sim | `max` |
|---|---|---|---|
| Postgres | Neon TCP per request | postgres-mem | Embedded Postgres |
| Client SQL | expo-sqlite / OPFS | bun:sqlite / mem | Real SQLite |
| Object store | B2 S3 | In-memory | MinIO |
| PubSub | EMQX HTTP + MQTT WSS | In-memory bus | Embedded EMQX |
| Room | Cross-script DO | In-process RoomServer | Still in-process |
| Google | Real | Fake / oauth-dev | Fake |

Missing EMQX secrets: HTTP pubsub `get()` undefined → **silent no-op** while `status()` reports `'connected'`. Missing S3 → in-memory. Optional vendors → 503.

Infisical, Cloudflare API, Railway, Expo, Turbo are control-plane, not request path.

## Product context

[product]

Ranked user workflows: cold start → Google upgrade / returning-account **file switch** → offline mutations → create/join/leave/end spaces → chess puzzles in a space → account isolation → friends + search → notifications → profile. Billing checkout currently 503; matchmaking has no client UI.

Worst user-visible failures are **confirmed success then later contradiction**: left but still seated; friends but cannot join; puzzle solved then not; previous anon’s data after Google switch.

Anon users cannot create/join spaces. Default space visibility is private. Write rejections have **no product inbox**.

## Unproven assumptions

[assumptions]

| Id | Axiom | Likely Antithesis break |
|---|---|---|
| A1 | Injected clock / no wall I/O | DO `setAlarm` is CF wall time; Web Locks `AbortSignal.timeout`; SQLite `busy_timeout` |
| A2 | LWW by arrival, not `updated_at` | Clock jump should not change winners **if** arrival order is preserved; UI/sort and ISO code-unit `<` can still break |
| A3 | DO single-thread + contiguous append | Swallowed `storageChain` errors; hibernation restore |
| A4 | SQLite name = 12 hex of user id | 48-bit prefix collision; shared `user_pending` |
| A5 | `upgrade_required` does not wipe | Clients that treat every `error: 'auth'` as revoked |
| A6 | `notifyChannels` exhaustiveness | Runtime OOB + missing ALS silent-return; CI is static only |
| A7 | Soft-delete wrap | Unclassifiable DELETE parse_error can fall through; OOB SQL is not wrapped |
| A8 | Applied rows never pruned | Kill after apply before ack; concurrent same id different args |
| A9 | Allocate then best-effort publish | Process kill / partition after allocate = permanent gap |
| A10 | Contiguous pushSeq or refetch | Overlapping `handlePush`; 30s heal only if foreground |
| A11 | MEMORY journal + wipe-on-corrupt | Process kill mid-txn **deletes local DB including pending queue** |
| A12 | Web Locks release on tab death | Followers never upload if owner is hung not dead |
| A13 | Room commandId + heartbeat | Clock jump vs 20s/8s |
| A14 | Token refresh 4s then stale bearer | Partition during refresh |
| A16 | Object store / EMQX may be absent | Wrapper reports connected |

## Wildcard / frame issues

[wildcard]

- **Dual testing religions.** The sim looks like Antithesis and can create false confidence. `max` fidelity **drops** the faults the fake tier injects. Native “real” fabric opens **mem** engines. PBT explicitly declined Wrangler/Neon.
- **Identity collapsed then forked.** `accountId === userId` in product auth; sync `clientId === deviceId`; presence UI has used `profileId={deviceId}`; room actor can silently become the install id on a **DB hiccup** during WS upgrade; room `clientId` is a per-tab UUID, not the sync clientId.
- **Protocol archaeology.** Wire v3 lives in `protocol/v2.ts`. Version mismatch is `{ error: 'auth', reason: 'upgrade_required' }` — a protocol cut classified as auth.
- **Dialect inversion.** Shared SQL is SQLite-shaped; Postgres is shimmed (`postgres-sqlite-compat`). Engine detect: `SELECT sqlite_version()` success ⇒ SQLite, catch ⇒ Postgres. Nested txs flattened — no SAVEPOINT. Hermes int8 already bit.
- **Push URL is a synced row.** You need sync to learn how to receive push.
- **Two merge theories.** Rooms: deterministic replay + hash. Social: LWW by arrival. Pending mutations can rebase onto tombstones and **revive** deleted rows. Two hashers (`hashRoomState` vs `canonicalJson`) may not share integer-key sort rules (`PBT_AUDIT.md`).
- **Isomorphic fiction.** Local `cloudflare.d.ts` stubs `WebSocketPair` / `blockConcurrencyWhile` because workers-types fight Expo DOM. Constructing `Request` wrong **strips Upgrade** → 426.

## Failure-prone areas (Antithesis priority)

1. Sync merge/fanout isolation (wipe, clobber, device-private, same-account multi-device) under real MQTT+HTTP asymmetric partition.
2. Mutation idempotency across process kill (apply before ack; MEMORY-journal local crash wiping the queue).
3. `pushSeq` allocate-then-drop + overlapping `handlePush` + 30s reconcile foreground gate.
4. Outbox unlocked claim + cron skipping notify.
5. Auth: OAuth double-consume; revoke vs expire vs `upgrade_required` wipe policy; returning-user SQLite switch.
6. Room: gateway auth fallback to anon; hibernation restore; commandId under reconnect storm; DO alarm vs wall clock.
7. Health-OK while DB/EMQX/boot are dead (origin gate opens, clients hammer).
8. Schema/index crash-safety if migrate runs under traffic (secondary; already well pinned in-sim).

## Assumptions

- Whole-product SUT; user did not narrow to a subsystem. Topology should still stay **minimal** (sync core first; room as a second process only if room properties are in the first catalog).
- Cloudflare Workers and Durable Objects do not run as-is in typical Antithesis Linux VMs. Topology will use the isomorphic Hono `createServer` on Node plus an in-process or sidecar `RoomServer`, not live CF.
- Production Neon/EMQX/B2 hostnames live in secrets, not this tree.

## Open Questions

- Confirm whether Antithesis should target the **sim composition** (already deterministic, misses prod walls) or a **containerized Node API + Postgres + EMQX + real client SQLite** (the declined PBT class). Downstream setup should prefer the latter for unique value.
- Live Neon URL shape (pooler vs compute, suspend, statement timeout) is not in-repo.
- Whether product UI treats `upgrade_required` as a blocking screen.
- Whether `journal_mode=MEMORY` applies on native expo-sqlite (shared pragma path suggests yes).
- Whether two Worker isolates in production make the unlocked outbox claim real (CF concurrency is expected).
- Matchmaking / billing / TTS appear unshipped in the client — out of first-pass topology unless properties demand them.
- Chess “multiplayer” is shared puzzle play, not 1v1. No second chess mode registered.

## Provenance of major findings

| Finding | Focuses |
|---|---|
| Two write planes (sync LWW vs room log) | architecture, state, wildcard |
| Health lies; origin gate | failure, deps, liveness |
| Allocate-then-drop pushSeq | state, concurrency, assumptions, failure |
| Outbox SELECT without claim; cron skips notify | concurrency, failure, deps |
| Room gateway never blocks on auth | architecture, failure, wildcard, product |
| MEMORY journal + wipe-on-corrupt | assumptions, failure, tests |
| Sim vs max fidelity inversion | tests, wildcard |
| Wipe/clobber pin cluster | bugs, safety, product |
| No Antithesis SDK | wildcard (scan) |
| `paintReady` ≠ hydration | liveness, product, wildcard |
| Identity collapse / room demotion | wildcard, safety, product |
