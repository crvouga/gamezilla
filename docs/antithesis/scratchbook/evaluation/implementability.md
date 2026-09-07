---
sut_path: /Users/chrisvouga/gamezilla
commit: ddde94db466ae77df20385c54ead0c79ae20b2c8
updated: 2026-09-01
external_references: []
---

# Implementability evaluation

Lens: can each cataloged property actually be checked given this topology (Node API + Postgres + EMQX + 2 SQLite clients, in-process RoomServer, no OPFS / Wrangler / DO)? Observability, SUT instrumentation, workload preconditions, 30s reconcile, process-fault requirement.

Do **not** treat this file as Gap / Bias / Refinement categorization. Those labels belong in synthesis.

Scope answer used: **"Just this directory"**. External references: none. Catalog frontmatter was briefly `b2cd713c…` when this lens ran; analysis, topology, catalog, and this evaluation now pin `ddde94db466ae77df20385c54ead0c79ae20b2c8`.

## Verdict key

| Verdict | Meaning |
|---|---|
| **Checkable** | Topology can produce the faults; an oracle exists or can be built from existing product tables once a read path is added |
| **Checkable if setup adds X** | Topology is the right shape, but the current compose + product surfaces do not expose the observation or the precondition |
| **Partial** | Some clauses of the invariant are checkable; a named clause is not |
| **Not in first topology** | Needs OPFS/Chromium, web SQLite wipe path, a second binary, a DO, a proxy, or UI that this compose does not run |

---

## Catalog-wide findings

### 1. Workload cannot read Postgres as drawn

**Properties:** catalog-wide (every server-side Always)

**Concern:** `deployment-topology.md` networks `postgres` to **api only**. The workload container reaches `api`, `client-alice`, and `client-bob`. There is no product admin SQL route. `idp_sessions`, `sync_engine_mutations_applied`, outbox `processed_at`, and the LWW-authoritative row body therefore have **no read path** from the test template.

**Evidence:** topology container table (`postgres` network = api only; `workload` network = api + both clients). Product request map has no inspect/debug prefix. `existing-assertions.md`: no SUT SDK that could assert those tables from inside `api`.

**Suggested action:** Setup must add one of: (a) workload→postgres network + a read-only SQL client in the template, (b) authenticated debug GETs on `api`, (c) TypeScript SDK assertions compiled into `api`. Until then, High properties whose Always is a Postgres count (`mutation-id-first-wins-ack-applied`, `oauth-exchange-code-consumed-once`, `outbox-handler-at-most-once`, LWW “equals last mutation Postgres applied”) are unobservable.

### 2. Clients have no control or probe surface

**Properties:** catalog-wide (every client-SQLite Always / every mutate driver)

**Concern:** Product clients are web/Solid. Topology specifies “headless `createClient` / sync-engine + RoomClient” but does not define an HTTP control plane. The workload is supposed to “drive both clients + probe API.” There is nothing in-tree to: enqueue a named mutation, wait for first-sync (not `paintReady`), dump `sync_engine_*` / domain tables, read `last_push_seq`, flip `AppLifecycle` foreground, call `ensurePush`, or switch `users.id`.

**Evidence:** `apps/client` has no Antithesis/debug listener. `createLocalSyncEngine` is a library entry, not a container API. Room inspect (`RoomServerApp.inspect`) exists only on the in-process sim host, not as an HTTP route.

**Suggested action:** Specify a tiny per-client command HTTP (or a shared volume + sidecar `sqlite3`) before workload authoring. Shared-volume reads fail while the Node process holds the MEMORY-journal file; prefer an in-process probe that runs on the SQLite owner thread.

### 3. Process (node termination) faults are load-bearing and off by default

**Properties:** `mutation-id-first-wins-ack-applied`, `memory-journal-crash-wipes-queue`, `room-command-id-applies-once`, `schema-epoch-preserves-durable-queue` (crash-mid-DROP), `health-200-while-boot-fatal` (restart mid-`bootApp`), `account-switch-close-then-open-sqlite` (kill during `opChain`)

**Concern:** Antithesis node termination is **disabled by default** on many tenants (`references/faults.md`). Catalog Assumptions already say process faults must be enabled. If they are not, those High/Medium Always clauses are unfound or vacuously true (no post-crash open ever happens).

**Evidence:** topology “Must enable process (node termination) faults”; catalog “Catalog-wide open questions — Confirm tenant process-fault + clock-fault availability.”

**Suggested action:** Confirm tenant webhook before the first campaign. Do not treat a green run without kills as coverage of lost-ack or MEMORY-journal.

### 4. 30s reconcile + foreground gate vs headless Node

**Properties:** all HTTP-heal liveness (`mqtt-http-independent-fault-domains`, `outbox-processed-without-notify`, `lww-upload-arrival-under-partition`, `multi-device-same-actor-converge`, `tombstone-sync-and-pending-revive`, `stale-push-images-after-snapshot-merge` “confirming snapshot”)

**Concern:** Product `QUERY_RECONCILE_INTERVAL_MS = 30_000`. Sweeps pause on `background`. Headless default is `alwaysOnLifecycle()` (always foreground) — good for heal, **bad** for the catalog angle “background the client (30s tick pauses)” on `mqtt-http-independent-fault-domains`. Quiet periods / `eventually_` windows must be **> 30s** unless the Antithesis image shortens the interval. `ANTITHESIS_STOP_FAULTS` restores killed containers but does not by itself fire a foreground refetch.

**Evidence:** `subscription-runtime.ts` background clears the tick; `app-lifecycle.ts` `alwaysOnLifecycle`; topology config note already says shorten or size eventually > 30s.

**Suggested action:** Bake a short reconcile (sim uses 500ms) **or** size `eventually_` / stop-faults ≥ 45s. If the MQTT-down / background interaction is in-scope, the client image must inject `createControllableLifecycle` and the workload must flip it.

### 5. No Antithesis SDK — TOC-TOU Always depends on luck or instrumentation

**Properties:** `overlapping-handle-push-seq-toc-tou`, `stale-push-images-after-snapshot-merge`, `outbox-handler-at-most-once` (pause after both SELECTs), `oauth-exchange-code-consumed-once` (SELECT then DELETE), `room-command-id-applies-once` (append then `putDedupOutcome`), `concurrent-mutations-noop-lock`

**Concern:** Those invariants are checkable **after** the race, but `Reachable(overlap)` and the interesting Always need the pause window. Thread pause requires coverage instrumentation. CPU modulation can approximate some interleavings without SDK. Workload-only MQTT dup / two POSTs can hit some races; they will not reliably pause between `readLastPushSeq` and `recordPushApplied`.

**Evidence:** `existing-assertions.md` (zero SDK); topology SDK paragraph names exactly these files; faults.md thread-pause requires instrumentation.

**Suggested action:** First campaign can still assert post-quiescence safety (seq never regresses; sessions ≤ 1; handler count ≤ 1) without `Reachable(overlap)`. Treat overlap Reachable as “needs SUT SDK or custom fault,” not as a workload-only Sometimes.

### 6. In-process RoomServer is memory + DO-shaped gateway

**Properties:** `room-command-id-applies-once`, `room-single-log-per-topic`, `room-welcome-truncation-resync`, `room-gateway-fallback-not-host`, `sync-membership-and-room-seat-agree`

**Concern:** Two separate setup holes:

1. **Storage.** Product sim `createRoomServer` uses `InMemoryRoomStorage`. API kill loses events **and** dedup together. The catalog’s unique window (append committed entries, then a later `putDedupOutcome` on a **durable** KV) does not exist unless setup persists room storage across process restart. Hibernation / DO `alarm()` is not in this topology.

2. **Gateway.** `createRoomApp()` requires `c.env.ROOM` and returns 503 if the binding is missing (`apps/server/src/room/route.ts`). The fallback-to-`anonId` logic lives **only** in that file. Sim `create-sim.ts` uses loopback `createRoomServer` and never runs `createRoomApp`. Topology says “in-process RoomServer behind `/api/room`” and “gateway-auth still run,” but that is an unimplemented adapter: a Node stub that still calls `resolveRoomActorId` and then `RoomServer`, without Wrangler.

**Evidence:** `create-room-server.ts` header (“LoopbackRoomTransport — no browser WebSocket / Durable Object”); `createRoomApp` `ns === undefined → 503`; topology “No Wrangler + real DO”; room-gateway evidence assumption “topology includes `createRoomApp`, not only in-process RoomServer.”

**Suggested action:** Setup must ship a Node `ROOM` binding that preserves `resolveRoomActorId`. For commandId crash-window, persist `InMemoryRoomStorage` export/import on a volume **or** drop the kill-between-keys clause and keep reconnect/flood-only.

---

## Per-property

### High (first workload)

#### lww-merge-no-wipe-clobber — **Checkable if setup adds client SQL probe**

Two clients + real MQTT/HTTP + asymmetric partition match the topology. Oracle is local SQLite after merge: omitted ids/keys unchanged; non-empty `profile.username` not replaced by empty/NULL. Empty secondary snapshot is a workload query-set choice (subscribe a second scope that returns `{}`).

Mid-merge kill is explicitly deferred to `memory-journal-crash-wipes-queue`. `AlwaysOrUnreachable` “regressive profile image dropped” is product-path (`ensureProfile`); reachable if alice/bob run `ensureProfile`.

Does **not** need Postgres if the Always is “local columns vs pre-merge snapshot” taken by the client probe.

#### lww-upload-arrival-under-partition — **Checkable if setup adds Postgres read + client SQL + clock faults**

Topology has two devices and independent HTTP vs MQTT partitions. Winner is “last mutation Postgres applied for that id” — **needs Finding 1**. Clock jump is catalog-wide (all containers equally); arrival order still observable if the workload records POST completion order. `paintReady` must not be the heal signal (`waitForFirstSync` / scope hash / row compare). `Sometimes(multi_writer_conflict)` needs both clients mutating the same id while partitioned from each other but able to reach api (or serialized POSTs after heal).

#### mutation-id-first-wins-ack-applied — **Partial (lost-ack yes; two-isolate race yes as two clients; needs process faults + Postgres)**

Lost HTTP ack: kill `api` after commit, before the client reads 200 — **process faults**. Retry from durable `sync_engine_mutations` is the product path. Always “`mutations_applied` count = 1” is Postgres (Finding 1). Domain-body-equals-first-apply can use Postgres or a later snapshot.

“Race two isolates with the same id” does **not** need two API containers: alice and bob (or two sessions on one actor) can POST the same `mutation_id` with different args. One Node event loop still interleaves two in-flight Hono requests. Unique index may convert one to an unmapped `23505` — that is the property.

`Reachable(duplicate)` is server-internal unless the wire keeps exposing `applied` for both.

#### memory-journal-crash-wipes-queue — **Partial (Node last-commit / fail-closed only)**

Topology clients are bun/better-sqlite3. They issue `PRAGMA journal_mode=MEMORY` and **assert** on connect failure — no `deleteDatabaseAsync`. Catalog already splits: first topology MEMORY yes, web SQLite wipe no.

Checkable: SIGKILL mid-txn; next successful open is last-commit or the process dies. `Unreachable(torn mix served)`. Needs process faults + durable vs ephemeral volume (topology already notes both).

**Not** checkable here: web SQLite wipe-empties-queue, `Sometimes(wipe.lost_pending_queue)`, follower-tab POST of a pre-wipe image (no tabs). Do not treat a green Node run as web SQLite A11 coverage.

#### overlapping-handle-push-seq-toc-tou — **Partial (post-hoc Always yes; overlap Reachable needs SDK/pause)**

Fault domains are right (separate EMQX, QoS1 dup/reorder). `last_push_seq` lives in client SQLite (`sync_engine_push_applied`) — Finding 2. Always “recorded last never decreases” is checkable after each apply if the probe samples that table.

`Reachable(same-topic overlap)` and the TOCTOU overwrite (pause between re-read and upsert) are not workload-reliable without instrumentation. Unknown-baseline after drop+readd **is** a workload precondition (unfriend/leave then rejoin) and does not need a pause.

#### mqtt-http-independent-fault-domains — **Checkable if setup adds client SQL + 30s-or-short reconcile**

Cutting EMQX independently of api is exactly why those containers are split. Heal oracle is **domain rows vs server** (not `last_push_seq`). That needs Finding 1 **or** a trusted snapshot the workload fetches itself via `POST /api/query` as a third session (workload can be a protocol client against api without opening Postgres). Prefer workload-as-query-client over punching postgres.

`Sometimes(mqtt_down_http_up)` is free (partition emqx). Background-the-client is **not** free on `alwaysOnLifecycle` (Finding 4). `Unreachable(local mutation acked without mutations_applied)` is Postgres or an api-side SDK line.

#### upgrade-required-no-local-wipe — **Checkable if setup adds client SQL**

Workload owns the header. Topology already says one command sends `x-sync-protocol: 2`. Always: domain rows + pending ids still exist after that 401. No old-client image required. `Unreachable(revokeDatabase from upgrade_required)` needs either a probe that the file still exists or SUT SDK on `handleError`.

#### oauth-exchange-code-consumed-once — **Checkable if setup adds Postgres (or session-count API) + oauth-dev**

Topology: fake Google / oauth-dev, two pre-created users. Workload can mint a code and double-POST `/auth/session`. Sequential retry after 200 is easy (HTTP-only: second is `invalid_code`). Concurrent overlap needs thread pause or two in-flight fetches — same as Finding 5.

Always “sessions from one code ≤ 1”: **no FK from `idp_sessions` to the code** (evidence file). Workload must record `token` / session ids from 200 bodies, or SELECT `idp_sessions` (Finding 1). Lost-ack after consume cannot remint — that is consume-once working, not a second session.

#### room-gateway-fallback-not-host — **Checkable if setup wires `createRoomApp` on Node; else not in first topology**

The interesting fault (pause/kill Postgres during WS upgrade) is in-topology. The code path is `createRoomApp` → `tryResolveAccount` catch → `anonId`. If setup uses sim loopback and never mounts `createRoomApp`, the Always is vacuously about a file that is not running.

Oracle: after upgrade, room identity ≠ victim account `A` when bearer failed. Needs RoomClient to expose resolved identity (or welcome/roster). `anonId=<victim account>` is a workload query-string. `Reachable(tryResolveAccount catch)` needs SDK or a forced DB throw.

DO adapter `parseUpgradeIdentity` is not in this topology; a Node stub must still honor `x-actor-id` overwrite (gateway overwrites the header today).

#### room-command-id-applies-once — **Partial (reconnect/flood yes; kill-between-keys no unless room storage is durable)**

Reconnect, take-over, and flood against a **live** in-process `RoomServer` are checkable (one api process, two RoomClients). Always “seqs appear once; live hash equals fold” needs `inspect` exported over HTTP or SDK.

Kill after `appendCommittedEntries` before `putDedupOutcome`: **not checkable** on `InMemoryRoomStorage` — both key families vanish together. Hibernation refold is DO-only. Topology deferred independent room kill; killing `api` kills the room process.

#### outbox-handler-at-most-once — **Partial (cron∩mutations overlap yes in one process; handler count needs SUT counter or Postgres)**

One `api` replica can still overlap `drainOutboxOnCron` (second DB session, no ALS) with post-`/mutations` drain. Two Cloudflare isolates are **not** modeled; that is fine for the SELECT-without-claim race.

Always “handler success count is 1” is not in any product table (friends upsert hides doubles). Need SUT counter on `runDelivery` or a side-effect that is not idempotent. Weaker oracle: `pushSeq` allocated twice for one notify — still needs Postgres `sync_engine_topic_seq` or MQTT sniffer.

`Reachable(two drain txns selected the same row)` is SDK/pause.

Open question on intended at-most-once vs at-least-once is not an implementability block; it is whether a double-handler is a finding.

#### health-ok-db-down-opens-gate — **Checkable (timing from client logs / probe)**

Pause or partition `postgres` while `api` stays up. Health stays 200 by construction. Always “failed mutation POSTs ≥ `ERROR_DELAY_MS` apart” is observable from the **client** upload loop if the probe timestamps POSTs (Finding 2) or from api access logs. `Unreachable(fail → waitUntilAvailable in tens of ms → POST)` same.

Hang (no connect timeout) is in-scope: in-flight POST, gate open. Do not require a 500.

`Sometimes(origin.split_brain_health_vs_db)` is free.

Does not need process faults. Does not need MQTT.

---

### Medium (same topology, second wave)

#### tombstone-sync-and-pending-revive — **Checkable if setup adds HTTP snapshot oracle + pending mutate**

Soft-delete + snapshot tombstones are product. Partition so tombstone fanout races a pending upsert. Check after HTTP snapshot/refetch, not MQTT-only. `Sometimes(pending rebase revives)` is a workload sequence (local mutate after peer tombstone, before upload). Two clients are enough.

#### device-private-rows-stay-local — **Checkable if setup adds client SQL**

Same-account alice/bob + MQTT `user:{id}` is the topology’s reason for two clients. Always: live `spaces_open_sessions.device_id` is this engine’s `deviceId`. `Unreachable(applyRowImages upserts foreign device_id)` is cleaner as SUT SDK; workload can still SELECT the table.

#### stale-push-images-after-snapshot-merge — **Partial (safety after confirming snapshot yes; check-then-merge Reachable needs pause)**

Same as overlapping handlePush: post-snapshot row-age vs server is Finding 1/2 + 30s-or-short. The named window (contig check passed, snapshot finished, then stale `applyRowImages`) needs thread pause. Do not bound heal at 30s (`not_modified` + background). Compare a replica **without** pending rewrite of those columns (rebase remasks the writer).

#### emqx-url-hydrates-over-http-without-push — **Checkable if headless driver calls `ensurePush`**

Cut EMQX, leave HTTP up, cold SQLite: topology + seed note. Safety (session `clientConfig` merge with MQTT down) is HTTP + client SQL. Liveness “owner calls `ensurePush`” is **SUT-internal**. Evidence already warns: a headless driver that never calls `ensurePush` false-fails. Product path is a React effect (`SyncEmqxPushFromClientConfig`). Node image must invoke the same hook after hydrate.

`Unreachable(waiting on pubsub before clientConfig query)` needs SDK on the query path or a watchdog that session queries ran while `createPubSub` was null.

If Worker desired URL is null, skip the Sometimes (intended poll-only).

#### concurrent-mutations-noop-lock — **Checkable if two sessions can POST overlapping batches**

Two clients, one actor (multi-device) or alice/bob friend pair. No `FOR UPDATE`. `Reachable(two same-actorId txns overlap)` is two in-flight POSTs; pause helps but is not required if the window is wide (friend-request SELECTs). Oracle is Postgres domain tables (Finding 1) or a later snapshot both clients agree on. Distinct from same-id retry.

#### web-sync-owner-single-uploader — **Not in first topology**

Catalog and topology already skip this. Node has no `navigator.locks` / OPFS / tabs. Native path always owns. Do not run the Always (null locks → every tab owns — that would false-fail or be vacuous). Chromium/OPFS variant later.

#### multi-device-same-actor-converge — **Checkable if setup adds HTTP heal oracle**

Same compose as LWW + device-private. Partition one install, other writes, heal HTTP only. Complements `device-private-rows-stay-local` (MQTT leak path). Two clients are sufficient; no third.

#### unclassified-401-defaults-expired — **Not in first topology without a response injector**

Product sync 401s are well-formed `{ reason: 'expired' }`. Repo does not emit `revoked` (README/sim only). Malformed empty/HTML/partial JSON requires a **proxy, custom fault, or SUT hook** that mangles the API response. Topology has no sidecar proxy; clients talk to api directly.

Well-formed `revoked` wipe: same injector (or a debug route). Sequential “401 expired does not delete the file” using a real expired token **is** checkable (product emit path) and is only a slice of the property.

`upgrade-required-no-local-wipe` already covers the other classified 401.

#### mutation-actor-from-session-only — **Checkable (HTTP-only)**

Workload forges `actorId` / `ownerId` in the mutation batch while using alice’s bearer. Oracle: Postgres/domain row owner is the session account, not the body. Finding 1 or a query-as-alice vs query-as-victim. Account-switch with in-flight upload needs the switch driver (see below). Anon-ensure body `userId` is out of this invariant (evidence).

#### denied-scope-no-fanout-leak — **Checkable if setup adds client SQL + friend/unfriend sequence**

Alice/bob as friends then unfriend while MQTT JWT still lists `room:{id}` (15 min, remint on reconnect only). Product `rowImageFanout: true`. Oracle: bob’s SQLite must not gain ids created after deny that only the denied query would return. Leftover pre-deny rows may stay. `Reachable(deny)` is the sweep response — workload can POST `/api/query` and see `denied`, or watch scope_meta.

Leave-while-friends is **not** a deny (remint still lists the room) — do not use that as the precondition.

#### private-space-join-requires-acl — **Checkable**

Two accounts, private space, `removeFriend` ∥ `joinSpace`. Oracle is `spaces_users` after applied `joinSpace` (snapshot or Postgres). Anon cannot join — workload must use signed-in users (topology seeds them). Room WS does not enforce this; do not use seat presence as the oracle.

Device-drift `host_account_id` rewrite is a human-input question, not a blocker.

#### room-single-log-per-topic — **Partial (live-equals-fold yes; split-brain Unreachable by construction)**

One in-process RoomServer: dual-writer is `Unreachable` unless setup accidentally starts two. Empty-disk restart (API kill + `InMemoryRoomStorage`) can look like a **new** empty log while a client still holds a room Kv cache — that is the open question, not two live writers. Always “live hash equals fold” needs inspect (Finding 6). Do not spend search budget on dual-process until a second room container exists.

#### room-welcome-truncation-resync — **Partial (grow-past-512 yes if RoomClient is real WS; kill-mid-welcome loses memory log)**

Need ≥ 513 committed events on one topic (chess/space commands). Sim loopback rarely hits 512; Antithesis can. Client Always `setSynced(true)` only when applied seq equals welcome `lastSeq` is **RoomClient-internal** — probe or SDK.

Kill mid-welcome on in-memory storage restarts an empty server; that is not “truncated welcome,” it is log loss. `v ≠ 1` drop: workload can inject a bad frame only if it speaks the WS (or a proxy). Headless RoomClient will not send `v=2` by itself — need a raw WS client in the template.

#### sync-membership-and-room-seat-agree — **Checkable if gateway is mounted + both oracles exist**

Quiet-interval Always: no `seats[A]` if `A`’s `spaces_users` is tombstoned. Needs room inspect **and** sync snapshot. The demote-during-upgrade fault needs `createRoomApp` + Postgres pause (Finding 6). Headless must fire **both** `LeaveSpaceSeat` and `leaveSpaceMutation` (product `useLeaveSpace` order). A mutate-only driver that skips the room command will false-fail (“left but still seated” by construction).

`Sometimes` mid-run disagreement is free if both planes are sampled.

#### outbox-processed-without-notify — **Checkable if 30s-or-short + HTTP heal**

Fire cron after friend-request; drop EMQX after allocate (api↔emqx partition). Liveness: recipient snapshot eventually has the notification. `Unreachable(permanently missing after foreground reconcile)` needs Finding 4. Do not assert “cron always publishes” (cron has no ALS).

#### health-200-while-boot-fatal — **Partial (health-vs-503 yes with custom config fault; latch race needs first-request overlap)**

Killing Postgres does **not** latch `fatal` (connect is request-path after `ready`). Need `ConfigurationError` / secret-store error: missing `SECRETS_ENV` or `DATABASE_URL` at `bootApp`. That is a **custom fault / restart with bad env**, not a default network fault.

Once latched: health 200 + product 503 is HTTP-only (checkable). `Unreachable(fatal then ready)` needs SDK on `bootState` or a workload that never sees a later product 200 on that process. Overlapping first `ensureApp` is two concurrent product requests against a pending isolate — doable at api start, easy to miss if `setup_complete` already booted a ready app.

#### account-switch-close-then-open-sqlite — **Checkable if one client can switch `users.id`**

Topology has two containers, but the property is **one process, two files**. Alice must run returning-Google / `EnsureInternalAccountUseCase` to a second `users.id` (bob’s account), not first-time upgrade (same id, same file). Needs oauth-dev + the switch driver (Finding 2). Always “pending ids on A ∉ B” is two SQLite names on alice’s volume.

Pause between soft-stop and close needs instrumentation. OPFS exclusive-handle is web-only — do not require it.

#### schema-epoch-preserves-durable-queue — **Checkable if setup exposes `schemaEpoch` bump; crash-mid-DROP is Partial**

Single binary bakes `SCHEMA_EPOCH = 12`. Product has no runtime bump. DST already passes `schemaEpoch: SCHEMA_EPOCH + 1` on remake. Headless `createLocalSyncEngine` must accept an override (env / control RPC) and reopen the same file.

Always “mutation ids unchanged after wipe” is client SQL. `Unreachable(DROP sync_engine_mutations)` is SDK or a schema dump.

Kill between `dropCacheTables` and `PRAGMA user_version`: process faults. On Node, connect failure **asserts** (no web SQLite file delete) — heal-if-open-succeeds is the Node clause. Two binaries on one volume are **not** required (evidence: first topology is one process per volume).

#### mixed-schema-column-intersect-merge — **Partial (omitted-key on one schema yes; two binaries not in first topology)**

Omitted-key / empty-table merge is already `lww-merge-no-wipe-clobber` on one image. Client-ahead extra column and server-ahead unknown key need **two declared schemas**. Topology ships one client image and one api image. Catalog deferred `lagging-client-schema-catchup` for this reason but left this property Medium — the two-binary half is the same block.

`AlwaysOrUnreachable` “client-ahead mutate does not wipe engine” is untestable without a client that writes an unknown column.

---

### Deferred (evidence on disk)

These are implementability notes, not a request to promote them.

| Slug | First-topology implementability |
|---|---|
| `paint-ready-before-first-sync` | **Not in first topology** as a UI latch. Headless has no splash / `SyncEngineBoot`. A weaker “`connect()` returns while `hasSynced` is still false” **is** checkable if the probe exposes both flags — and that is a Sometimes hint, which is why it was deferred. |
| `three-seq-spaces-unconflated` | **Checkable if client SQL + mutation 200 body** (compare magnitudes of `last_checkpoint` vs `last_push_seq` vs `ackSeq`). Catalog deferred for SUT probes; workload can still do the column compare. Isolate remake without `initialLast` **is** in-topology (api process kill). |
| `postgres-per-request-connect-settles` | Fault is in-topology (pause postgres). Oracle (pinned TCP / `too many clients`) needs `pg_stat_activity` (Finding 1) or api metrics. Pairs with `health-ok-db-down-opens-gate`. Resource hang, not a 30s Always. |
| `emqx-publish-wait-until-connected-settles` | Can induce (partition MQTT, optimistic publish). **No agreed N** — hang vs “eventually reconnects” is unbounded (jitter max 30s, waiters flush only on connect/close). Needs SDK on waiter-set size or an explicit deadline the product does not have. |
| `optimistic-fanout-buffer-drop-oldest` | Product client does **not** pass `bufferOutboundLive` (default false). Queue is unused unless the Antithesis image opts in. Cap is in-memory — SDK on `enqueue`. Correctly deferred. |
| `presence-online-matches-room-actor-id` | **UI-only** (`SpaceMemberTileRail` / `profileId={deviceId}`). Headless Node has no badges. Overlaps gateway fallback. Not checkable without a rendered client. |
| `sqlite-version-probe-failure-is-not-postgres` | First topology API is Postgres; clients are SQLite. Matchmaking-on-SQLite is not in the compose. Probe-throw-on-faulted-SQLite would need matchmaking boot on a client file — out of topology. |
| `room-and-sync-canonicalizers-agree-integer-keys` | Pure function compare. No containers required. Correctly parked as unit territory. |
| `lagging-client-schema-catchup` | **Not in first topology** (two schema-version binaries + migrate-on-open). Same block as mixed-schema’s two-binary half. |

---

## Property × topology matrix (first campaign)

Assumes setup adds: client command/probe HTTP, workload `POST /api/query` (or postgres read), Node `createRoomApp` stub, process faults, reconcile shortened or eventually > 30s. Does **not** assume SUT SDK unless marked.

| Slug | Verdict | Blocking missing piece if any |
|---|---|---|
| lww-merge-no-wipe-clobber | Checkable if probe | Client SQL |
| lww-upload-arrival-under-partition | Checkable if probe | Query-as-oracle or Postgres; clock faults optional |
| mutation-id-first-wins-ack-applied | Partial | Process faults; applied-count oracle |
| memory-journal-crash-wipes-queue | Partial | Process faults; web SQLite wipe **out** |
| overlapping-handle-push-seq-toc-tou | Partial | SDK/pause for overlap Reachable |
| mqtt-http-independent-fault-domains | Checkable if probe | 30s window; query oracle |
| upgrade-required-no-local-wipe | Checkable if probe | Client SQL |
| oauth-exchange-code-consumed-once | Checkable if probe | Session count; oauth-dev |
| room-gateway-fallback-not-host | Checkable if `createRoomApp` | Node ROOM stub |
| room-command-id-applies-once | Partial | Durable room KV for kill window |
| outbox-handler-at-most-once | Partial | Handler counter (SDK) |
| health-ok-db-down-opens-gate | Checkable | Client POST timestamps |
| tombstone-sync-and-pending-revive | Checkable if probe | — |
| device-private-rows-stay-local | Checkable if probe | Client SQL |
| stale-push-images-after-snapshot-merge | Partial | SDK/pause for named window |
| emqx-url-hydrates-over-http-without-push | Checkable if `ensurePush` | Headless must call it |
| concurrent-mutations-noop-lock | Checkable if probe | Domain oracle |
| web-sync-owner-single-uploader | Not in first topology | OPFS / Web Locks |
| multi-device-same-actor-converge | Checkable if probe | — |
| unclassified-401-defaults-expired | Not in first topology | Response injector |
| mutation-actor-from-session-only | Checkable | Forged body |
| denied-scope-no-fanout-leak | Checkable if probe | Unfriend + MQTT still up |
| private-space-join-requires-acl | Checkable | — |
| room-single-log-per-topic | Partial | Dual-process deferred; inspect |
| room-welcome-truncation-resync | Partial | 512+ cmds; `setSynced` probe |
| sync-membership-and-room-seat-agree | Checkable if gateway | Both leave paths |
| outbox-processed-without-notify | Checkable if 30s | — |
| health-200-while-boot-fatal | Partial | Custom bad-config restart |
| account-switch-close-then-open-sqlite | Checkable if switch driver | Two `users.id` on one client |
| schema-epoch-preserves-durable-queue | Checkable if epoch hook | `schemaEpoch` override |
| mixed-schema-column-intersect-merge | Partial | Two binaries **out** |

---

## Passes

- Catalog Assumptions match the topology (two SQLite clients, process faults, 30s reconcile, web-owner skipped). That alignment is real; the holes are **observation and adapters**, not a wrong container list.
- Independent EMQX vs API vs Postgres vs two clients is the right fault-domain split for the High sync properties. Folding pubsub in-process would make `mqtt-http-independent-fault-domains` and `emqx-url-hydrates-over-http-without-push` unimplementable; the topology refused that.
- `upgrade-required-no-local-wipe` is one of the few High properties that is almost workload-only (header + “file still there”).
- `health-ok-db-down-opens-gate` and `private-space-join-requires-acl` / `mutation-actor-from-session-only` do not need MQTT, room, or a second binary.
- Deferred set is mostly honest about topology blocks (web owner, web SQLite wipe, matchmaking-on-SQLite, two schema binaries, UI presence). Exception: `mixed-schema-column-intersect-merge` stayed Medium while `lagging-client-schema-catchup` was deferred for the same two-binary requirement.
- In-tree sim pins are correctly treated as oracles to port, not as existing Antithesis assertions (`existing-assertions.md`).
- Clock-fault “all containers equally” still lets `lww-upload-arrival-under-partition` test “jump does not change winner if arrival order is unchanged.”

---

## Uncertainties

- **Exact Node entry + ROOM stub.** Topology leaves “`apps/server` vs a new `antithesis/` adapter” open. If the adapter skips `createRoomApp`, three High/Medium room properties change verdict together. Not verified in this tree (no Antithesis Dockerfile yet).
- **Tenant process-fault and clock-fault bits.** Catalog already flags this. This lens cannot see the webhook.
- **Whether setup will punch postgres or impersonate `/api/query`.** Both work; they change which High oracles are cheap.
- **Headless `AppLifecycle`.** If the image accidentally wires `AppState`, backgrounding could stall every 30s heal without the workload knowing.
- **better-sqlite3 vs bun:sqlite MEMORY honor.** Same uncertainty as the web SQLite engine: pragma is issued; this lens did not empirically `PRAGMA journal_mode` after connect in a container.
- **OAuth-dev code mint in a headless container.** Topology says fake Google; the exact HTTP sequence for a double-consume race is setup work, not blocked in principle.
- **Room inspect over HTTP.** `RoomServerApp.inspect` exists in-process; whether the Node api image exports it is unset.
- **Catalog commit drift (resolved).** This lens originally saw catalog frontmatter at `b2cd713c…`; synthesis aligned it to `ddde94db…`. Slugs were not re-diffed against the intervening product commits. Uncommitted working-tree work was not treated as changing implementability.

---

## Assumptions used by this lens

- First topology is exactly the six containers in `deployment-topology.md` (no MinIO, no third client, no Chromium, no Wrangler).
- Workload is a separate process that outlives client kills (topology “Why not fewer”).
- No Antithesis SDK will be present on day one unless setup adds it; verdicts that say “Checkable if probe” assume a **new** observation path, not an existing one.
- `external_references: []` — no out-of-tree Antithesis tenant docs were consulted for enabled fault types.
