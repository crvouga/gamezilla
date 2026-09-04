---
sut_path: /Users/chrisvouga/gamezilla
commit: ddde94db466ae77df20385c54ead0c79ae20b2c8
updated: 2026-09-01
external_references: []
---

# Property Catalog

First-pass portfolio for Gamezilla. Claimed guarantees are **claims to test**. No Antithesis SDK exists — every Invariant below is missing instrumentation (`existing-assertions.md`). Priorities: **High** = first workload; **Medium** = same topology, second wave; **Low** = evidence on disk, deferred.

Focus provenance is in each evidence file. Duplicate discovery slugs were merged (see evidence “Synthesis merge” sections).

Gap-fill (evaluation, 2026-09-01): `rejected-write-still-paints-optimistic`, `own-ack-optimistic-body-no-flicker`, `outbox-exhausted-park-not-delivered`, `presence-online-matches-room-actor-id` (promoted), plus liveness `expired-token-refresh-then-drain`, `oauth-consume-orphan-no-client-session`, `api-remake-foreground-query-applies`, `upgrade-required-retry-bounded`. First topology: Node API + Postgres + EMQX + 2 clients; in-process memory RoomServer — api kill wipes the room log.

## Overview

| Priority | Count | Emphasis |
|---|---|---|
| High | 18 | Sync LWW/idempotency, MQTT vs HTTP, auth, outbox, health-lie, reject-paint, own-ack, token/OAuth/API-remake liveness |
| Medium | 18 | Isolation, schema, lifecycle, room gateway/welcome/seats, presence, outbox park |
| Low (deferred) | 11 | Web-owner, dual-room, seq probes, resource hangs, hashers, dialect, paintReady, schema-catchup |

**Human-input questions still open** (full logs in evidence files):

| Property | Question |
|---|---|
| `unclassified-401-defaults-expired` | Future revoke: sync 401 `reason: 'revoked'` vs a dedicated channel? |
| `private-space-join-requires-acl` | Device-drift host rewrite of `host_account_id` intended? |
| `room-gateway-fallback-not-host` | No-bearer `anonId` UUID-only? |
| `outbox-handler-at-most-once` | At-most-once vs at-least-once + idempotent handlers? |
| `outbox-exhausted-park-not-delivered` | Shorten `maxAttempts` in the Antithesis image? |
| `oauth-consume-orphan-no-client-session` | Lost 200 after `createSession`: leave unused `idp_sessions` live? |
| `upgrade-required-retry-bounded` | Park after N vs forever 2s…60s retry? |


---

## Data integrity under faults

Merge/upsert, crash, tombstones, optimistic reject/ack. Highest density of confirmed in-tree pins.

### lww-merge-no-wipe-clobber — LWW merge does not wipe or clobber

| | |
|---|---|
| **Priority** | High |
| **Type** | Safety |
| **Property** | A committed snapshot or row-image merge on an intact DB file upserts intersecting columns only and never deletes or NULLs domain rows or columns the incoming batch did not write (absent ids **and** omitted keys). |
| **Invariant** | `Always` after merge (post-quiescence if overlapping `handlePush`): omitted ids/keys unchanged; a non-empty local `profile.username` is never replaced by empty/NULL from a peer image. `Reachable`: empty secondary snapshot. `AlwaysOrUnreachable`: regressive profile image dropped (product `ensureProfile` does not emit empty username). Mid-merge kill / torn file is `memory-journal-crash-wipes-queue`. |
| **Antithesis Angle** | Real MQTT+HTTP asymmetric partition, overlapping `handlePush` vs snapshot merge, kill mid-`applyFullMerge`. Sim pins heal first. |
| **Why It Matters** | Confirmed wipe/clobber cluster (empty profile fanout, empty secondary snapshot, client-ahead column, `not_modified`). User sees “username gone” after a successful write. |

**Open Questions:**

- None


### lww-upload-arrival-under-partition — LWW winner is upload arrival

| | |
|---|---|
| **Priority** | High |
| **Type** | Safety |
| **Property** | After HTTP heal, every online replica’s user-scoped row body equals the last mutation Postgres applied for that id; the winner is commit order, not `updated_at`, `createdAt`, or MQTT order. Actor-wide state may mix rows from concurrent POSTs; a single contested id is still last-commit. |
| **Invariant** | `Always` after HTTP heal + foreground reconcile (SQLite/Postgres or `waitForFirstSync` — **not** `paintReady`): intersecting columns including `deleted_at` match the server for that id. `Sometimes(multi_writer_conflict)` mid-partition. Clock jump must not change the winner if arrival order is unchanged. |
| **Antithesis Angle** | Concurrent `POST /api/mutations` from two devices; wall-clock jump; `acquireLock` is a no-op. |
| **Why It Matters** | Only “consensus” on social state. Wrong winner is confirmed-then-contradicted (rename/profile revert). |

**Open Questions:**

- None


### mutation-id-first-wins-ack-applied — Mutation id applied at most once

| | |
|---|---|
| **Priority** | High |
| **Type** | Safety |
| **Property** | A `mutation_id` is applied at most once; a later POST of the same id — including different args, lost HTTP ack, or `stop()` orphan — does not re-run domain SQL and the wire verdict is `applied`. |
| **Invariant** | `Always`: live `sync_engine_mutations_applied` count for that id is 1; domain matches first apply. `Reachable`: replay returned `duplicate`. |
| **Antithesis Angle** | Kill API after commit before the client reads 200; kill client after 200 is sent; race two isolates with the same id and different args (loser’s whole flattened batch rolls back). |
| **Why It Matters** | At-least-once upload is designed. Double-apply or hostile args flipping the first write is a user-visible lie. |

**Open Questions:**

- None


### memory-journal-crash-wipes-queue — MEMORY-journal crash does not serve torn state

| | |
|---|---|
| **Priority** | High |
| **Type** | Safety |
| **Property** | After a process kill under MEMORY journal, a successful SQLite open is last-commit (Node) or a freshly wiped empty DB (Expo wipe-on-corrupt) — never a torn mix. If Expo wipe ran, un-acked local writes are gone and must not still look durable on screen. |
| **Invariant** | `Always`: successful post-crash open is last-commit or (Expo) empty. `Unreachable`: open succeeds on a torn mix. `Sometimes(wipe.lost_pending_queue)` on Expo. Distinct from epoch cache wipe, which claims to **keep** the queue. First topology: MEMORY yes, Expo auto-wipe no (fail-closed). |
| **Antithesis Angle** | SIGKILL mid-txn with `PRAGMA journal_mode=MEMORY`. Sim crash is dispose+remake, often `preserveLocalDb`. |
| **Why It Matters** | Expo recovery deletes the identity file — domain **and** pending uploads. Silent loss with no rejection inbox. Node image must not serve torn pages. |

**Open Questions:**

- Does native iOS expo-sqlite honor MEMORY journal in practice? `(partial: pragma is issued; no WAL override; not empirically verified)`
- Can a follower tab POST a pre-wipe queue image? `(partial: followers do not upload; first topology has no tabs)`


### tombstone-sync-and-pending-revive — Tombstones sync; pending rebase may revive

| | |
|---|---|
| **Priority** | Medium |
| **Type** | Safety |
| **Property** | Domain rows are never hard-deleted; snapshots carry tombstones; after a replica applies a confirming snapshot of a scope containing the id, it matches the server’s live-vs-tombstone (including revive). Upload reject does not itself revert domain — the next snapshot does. |
| **Invariant** | `Always`: no domain `DELETE FROM` on apply/replay; post-snapshot, payload ids exist locally with that `deleted_at`. `Sometimes(cond)`: pending rebase revives a just-tombstoned row. Revive is claimed LWW, not a bug. Check after HTTP snapshot/refetch, not MQTT-only. |
| **Antithesis Angle** | Partition so tombstone fanout and pending upsert upload race. |
| **Why It Matters** | Missing tombstone leaves a stale live row; disagreeing revive looks like leave/delete undone on one device. |

**Open Questions:**

- None


### device-private-rows-stay-local — Device-private rows never land on another install

| | |
|---|---|
| **Priority** | Medium |
| **Type** | Safety |
| **Property** | A client’s SQLite never contains a `spaces_open_sessions` row for another `device_id` that arrived via merge or push. Only product synced table with a `device_id` column. |
| **Invariant** | `Always`: live `spaces_open_sessions.device_id` equals this engine’s `env.deviceId` unless this device wrote it. `Unreachable`: `applyRowImages` / `applyFullMerge` upserts a foreign `device_id`. |
| **Antithesis Angle** | Same-account MQTT `user:{id}` plus optimistic `pushSeq: '0'` (no contig check). |
| **Why It Matters** | In-tree pin: tablet appears seated in a space it never opened. |

**Open Questions:**

- None


### rejected-write-still-paints-optimistic — Permanent reject still paints optimistic body

| | |
|---|---|
| **Priority** | High |
| **Type** | Safety |
| **Property** | After the server permanently rejects a mutation, the writer’s live `deleted_at IS NULL` row must not remain the optimistic body while Postgres differs — product has no rejection inbox, so painted local success is the only user-visible state. |
| **Invariant** | `Always` after a local `rejected` verdict (queue row gone): live intersecting columns match the server **or** no longer equal the optimistic args. `Reachable`: reject stored, domain still optimistic, no product observer. `Sometimes(reject.not_modified_leaves_paint)` while a sweep has not completed heal-by-local-hash (background / partitioned query). Distinct from tombstone/revive (that Always is post-snapshot). |
| **Antithesis Angle** | Concurrent `claimUsername` or `removeFriend` ∥ `joinSpace`; partition `/api/query` after the reject 200; background the 30s tick. Headless SQLite vs Postgres (or workload query session). |
| **Why It Matters** | `mutate()` returns `ok: true` locally. Reject writes `sync_engine_write_rejections` and does not revert domain. No `libs/` inbox. User sees join/username succeed, then contradiction (or never). |

**Open Questions:**

- None


### own-ack-optimistic-body-no-flicker — Acked optimistic body never flashes stale

| | |
|---|---|
| **Priority** | High |
| **Type** | Safety |
| **Property** | After the writer’s mutation is acked `applied`, that client’s live intersecting columns must never briefly equal the pre-ack server image (own stale snapshot or own MQTT echo). |
| **Invariant** | `Always` from `applied` ack until the next writer-owned mutation on that id: live body stays the acked optimistic value. `Reachable`: delayed/reordered snapshot or own fanout after ack. `Unreachable`: live body equals the last pre-ack server image after `mutationStatus === 'confirmed'`. Claimed generation fence + `pushSeq` floor; sim pins exist. |
| **Antithesis Angle** | Pause after ack before `bumpGenerations` / `recordPushApplied`; hold a pre-replay query 200; MQTT echo of the old row. Sample writer SQLite after every merge — not `paintReady`. |
| **Why It Matters** | Claimed safety (README + SUT). Writer sees their own confirmed edit revert, then maybe return. Distinct from peer wipe/clobber and from reject-paint. |

**Open Questions:**

- None


---

## Push, HTTP, and distributed coordination

No Raft. Coordination is LWW + lossy MQTT + HTTP snapshots.

### overlapping-handle-push-seq-toc-tou — Overlapping handlePush never double-applies

| | |
|---|---|
| **Priority** | High |
| **Type** | Safety |
| **Property** | Two overlapping `handlePush` calls on one topic never both apply as contiguous-next, and `last_push_seq` never regresses. |
| **Invariant** | `Always`: apply only when `pushSeq === last + 1` if a baseline exists; recorded last never decreases (`ON CONFLICT` is not GREATEST — pause between re-read and upsert). `Reachable`: same-topic overlap; unknown baseline after first subscribe or drop+readd (not remake of a live topic). |
| **Antithesis Angle** | Pause between `readLastPushSeq` and `recordPushApplied`; MQTT dup/reorder; membership drop+readd. |
| **Why It Matters** | Peer can take gapped images and look caught up; `not_modified` skips heal. |

**Open Questions:**

- None


### mqtt-http-independent-fault-domains — MQTT down does not block HTTP convergence

| | |
|---|---|
| **Priority** | High |
| **Type** | Liveness |
| **Property** | A client that can reach `POST /api/query` and `POST /api/mutations` eventually converges even if MQTT is partitioned, session-expired (600s), overflowing, or publish-lost. MQTT delivery is never required for correctness. |
| **Invariant** | `Always` after HTTP heal + foreground refetch: **domain rows vs server** (not `last_push_seq` catching up — `commitPendingPushSeqs` can floor after `not_modified` / `denied` / generation-skip). `Sometimes(mqtt_down_http_up)`, `Sometimes(pushseq_gap_then_http_refetch)`. `Reachable`: commit-pending without full merge. `Always`: non-contiguous `pushSeq` does not `applyRowImages`. `Unreachable`: local mutation acked without `mutations_applied`. |
| **Antithesis Angle** | Cut EMQX independently of the API. Kill after `allocateTopicPushSeqs` before publish. Background the client (30s tick pauses). |
| **Why It Matters** | Snapshots are the claimed truth path; a permanent seq gap is by design. |

**Open Questions:**

- None


### stale-push-images-after-snapshot-merge — Fanout contig check must not clobber a newer snapshot

| | |
|---|---|
| **Priority** | Medium |
| **Type** | Safety |
| **Property** | A snapshot merge at checkpoint C is not clobbered by `applyRowImages` whose contig check ran before that merge. Check replicas that have no pending mutation rewriting those columns (rebase can remask the writer). |
| **Invariant** | `Always`: after fanout that follows a snapshot on overlapping tables, intersecting rows are not older than that snapshot vs server (or a peer without pending rewrite). `Reachable`: contig-checked push still outside the merge gate while snapshot completes. Safety after a confirming snapshot — not a 30s liveness bound (`not_modified` + background can delay heal). |
| **Antithesis Angle** | Pause after `isContiguousNext`, before `withMergeSingleFlight`. |
| **Why It Matters** | Wipe/clobber while the client thinks fanout is current. Fanout does not update `last_hash`. |

**Open Questions:**

- None


### emqx-url-hydrates-over-http-without-push — Broker URL bootstraps over HTTP

| | |
|---|---|
| **Priority** | Medium |
| **Type** | Liveness |
| **Property** | MQTT must not be a prerequisite for hydrating `client_config.emqx_wss_url`; after a **non-empty** live row exists locally, the sync owner eventually calls `ensurePush`. |
| **Invariant** | `Always`: session `clientConfig` can merge with MQTT down. `Sometimes(cond)`: poll-only → non-empty URL via HTTP → owner `ensurePush` (skip when desired URL is null). `Unreachable`: waiting on pubsub before the `clientConfig` query. Followers’ `ensurePush` is a no-op without `pushOptions`. |
| **Antithesis Angle** | Cut EMQX, leave HTTP up. Cold SQLite has no URL. |
| **Why It Matters** | Broker address is a synced row. Gating query on push would deadlock first-sync. |

**Open Questions:**

- None


### concurrent-mutations-noop-lock — Concurrent mutations stay serializable for unique domain rules

| | |
|---|---|
| **Priority** | Medium |
| **Type** | Safety |
| **Property** | Concurrent `/mutations` batches produce only domain states a serial replay would allow for friend-request uniqueness and private-space join. |
| **Invariant** | `Always`: at most one pending `friends_requests` per ordered pair; private-space join visibility holds at commit. `Reachable`: two same-`actorId` txns overlap. Distinct from same-id retry. |
| **Antithesis Angle** | Two API sessions paused across the flattened request txn. No `FOR UPDATE`. |
| **Why It Matters** | Bidirectional pending friend requests, or join of a private space after unfriend. |

**Open Questions:**

- None



### multi-device-same-actor-converge — Two devices of one actor converge without leaking private rows

| | |
|---|---|
| **Priority** | Medium |
| **Type** | Safety |
| **Property** | After HTTP heal, two devices of the same `actorId` agree on user-scoped rows; a live `spaces_open_sessions` row for B never appears as this-install state on A. |
| **Invariant** | `Always` user-scoped tables match server on both devices after heal. `Always` no live foreign `spaces_open_sessions.device_id` in local SQLite after merge (HTTP query is already device-scoped; MQTT `applyRowImages` is the leak path). Complements `device-private-rows-stay-local`. |
| **Antithesis Angle** | Partition one install; the other writes; heal HTTP only. |
| **Why It Matters** | Same-account multi-device is the confirmed pin cluster. |

**Open Questions:**

- None


---

## Auth, protocol, and security

### upgrade-required-no-local-wipe — Protocol cut does not wipe SQLite

| | |
|---|---|
| **Priority** | High |
| **Type** | Safety |
| **Property** | Missing or non-v3 `x-sync-protocol` returns HTTP 401 `{ error: 'auth', reason: 'upgrade_required' }` and must not delete the identity DB or `sync_engine_mutations`. |
| **Invariant** | `Always`: after that 401, domain rows and pending ids still exist. `Unreachable`: `revokeDatabase` entered from `upgrade_required`. |
| **Antithesis Angle** | Workload sends `x-sync-protocol: 2` or strips the header on the current binary; mangle the 401 body. Sim flips an auth knob, not the real gate. No old-client image in the topology. |
| **Why It Matters** | Cut is classified as **auth**. A host that treats every `error: 'auth'` as revoke destroys local-only work. No product upgrade UI. |

**Open Questions:**

- None


### unclassified-401-defaults-expired — Malformed 401 is expired, not revoked

| | |
|---|---|
| **Priority** | Medium |
| **Type** | Safety |
| **Property** | A 401 on `/query` or `/mutations` wipes local SQLite only when JSON `reason === 'revoked'`. Empty, HTML, or unparseable bodies classify as expired. |
| **Invariant** | `Always`: 401 whose body is not `{ reason: 'revoked' }` does not `deleteDatabase`. `Always`: well-formed `revoked` does wipe. |
| **Antithesis Angle** | Return 401 with empty/HTML/partial JSON; expire the 4s refresh race. |
| **Why It Matters** | Product API emit path for `revoked` on sync 401 is thin. Same status also carries protocol-cut. |

**Open Questions:**

- Should a future product revoke use sync 401 `reason: 'revoked'`, or a dedicated channel? `(needs human input)`


### oauth-exchange-code-consumed-once — OAuth exchange code mints at most one session

| | |
|---|---|
| **Priority** | High |
| **Type** | Safety |
| **Property** | An OAuth exchange code (and provider auth code) is consumed at most once; a second `POST /auth/session` must not mint another `idp_sessions` row. |
| **Invariant** | `Always`: sessions from one code ≤ 1; later consumes are `invalid_code`. `Reachable`: overlapping double-POST. |
| **Antithesis Angle** | Pause between SELECT and DELETE under READ COMMITTED. Auth DST has no partition/crash. |
| **Why It Matters** | One redirect, two live API tokens. Sign-out invalidates only one. |

**Open Questions:**

- None



### denied-scope-no-fanout-leak — Denied queries never hydrate stranger rows via fanout

| | |
|---|---|
| **Priority** | Medium |
| **Type** | Safety |
| **Property** | Unauthorized queries never hydrate stranger rows; after deny, leftover domain rows stay but new unauthorized rows must not arrive via MQTT images. |
| **Invariant** | `Always`: never-authorized tenants have zero of the owner’s rows; after deny, ids created after deny that only that query would return are absent. `Reachable` on the deny branch. |
| **Antithesis Angle** | Unfriend / authorize-false while a 15-minute MQTT JWT still lists `room:{id}` (remint only on reconnect). Image between deny and incremental unsubscribe. Leave-while-friends still remints the room. Acme pin **disables** `rowImageFanout`; product Worker/client set it `true`. |
| **Why It Matters** | `applyRowImages` does not re-run `authorize`. Product has fanout on. |

**Open Questions:**

- None


### private-space-join-requires-acl — Private join requires host, friend, or existing ACL

| | |
|---|---|
| **Priority** | Medium |
| **Type** | Safety |
| **Property** | A private live space gains a new `spaces_users` row only for host, live friendship, or existing ACL. |
| **Invariant** | `Always` after applied `joinSpace`: private ⇒ host ∨ live friends ∨ pre-existing live `spaces_users`. Anon ⇒ not signed in. |
| **Antithesis Angle** | Concurrent `removeFriend` + `joinSpace`; friend → join → unfriend → rejoin. |
| **Why It Matters** | Default visibility is private. Room WS does not enforce this. |

**Open Questions:**

- Is device-drift host rewrite of `host_account_id` intended space takeover? `(needs human input)`


### room-gateway-fallback-not-host — Gateway auth fallback is not host

| | |
|---|---|
| **Priority** | High |
| **Type** | Safety |
| **Property** | Runtime/seat room checks use only the gateway-resolved actor; a stale-bearer fallback or unauthenticated `anonId` must not pass as another user’s account. |
| **Invariant** | `Always` after upgrade: `x-actor-id` is session account, else offered `anonId`, else a server-minted id — never WS body. A failed bearer resolve must not equal account `A`. `Reachable` on the `tryResolveAccount` catch. |
| **Antithesis Angle** | Pause/kill Postgres during WS upgrade; `anonId=<victim account>`. Sim `RoomServer` never runs `createRoomApp`. |
| **Why It Matters** | Gateway never blocks on auth. Chess host/seat is string equality on that header. Reclaim is any-connected-identity, not an ACL check. |

**Open Questions:**

- Should no-bearer `anonId` require UUID form? `(needs human input)`


---

## Room log

### room-command-id-applies-once — Room commandId applies once

| | |
|---|---|
| **Priority** | High |
| **Type** | Safety |
| **Property** | A room `commandId` produces at most one apply; reconnect, take-over, and flood re-ack the stored outcome and do not append more events. |
| **Invariant** | `Always`: a committed dedup outcome’s seqs appear once; live hash equals fold. `Unreachable`: two committed outcomes for one id. |
| **Antithesis Angle** | Kill after `appendCommittedEntries` and before `putDedupOutcome` (separate KV keys). Hibernation refolds the log but does not rebuild missing dedup. |
| **Why It Matters** | Room is deterministic replay, not LWW. Double move forks spectators. |

**Open Questions:**

- None



### room-welcome-truncation-resync — Welcome lastSeq is the tip; entries may be a prefix

| | |
|---|---|
| **Priority** | Medium |
| **Type** | Safety |
| **Property** | A wire-v1 `welcome` may truncate `entries` at 512. `lastSeq` is the log tip. The client must not `setSynced(true)` until applied seq equals welcome `lastSeq`. |
| **Invariant** | `Always`: `setSynced(true)` only when applied seq equals last welcome `lastSeq`. A `v ≠ 1` frame is dropped and must not mutate log/state. |
| **Antithesis Angle** | Grow a log past 512; kill mid-welcome. Sim loopback rarely hits the cap. |
| **Why It Matters** | Treating `entries.length > 0` as done drops the tail. Live hash ≠ log fold. Silent drop is the only bad-version behavior (no `upgrade_required`). |

**Open Questions:**

- None


### sync-membership-and-room-seat-agree — Room seats vs sync membership

| | |
|---|---|
| **Priority** | Medium |
| **Type** | Safety |
| **Property** | After leave (or join) has applied on both planes, room `seats` keys and live `spaces_users` for that account agree. |
| **Invariant** | `Always` after quiet interval: no `seats[A]` if `A`’s membership is tombstoned (scoped to accounts that had a live row). `Sometimes(cond)` when the two id sets differ mid-run. |
| **Antithesis Angle** | Gateway demotes `x-actor-id` to the install id; client leave-seat uses only `useMyId()`, so the command stays unauthorized while `leaveSpaceMutation` still tombstones. |
| **Why It Matters** | “Left but still seated.” Two merge theories (event-log vs LWW). |

**Open Questions:**

- None


### presence-online-matches-room-actor-id — Account online iff room actor is that account

| | |
|---|---|
| **Priority** | Medium |
| **Type** | Safety |
| **Property** | For a signed-in connection, the account is online on the room roster iff that connection’s server-assigned actor id is the account — not privilege, not React badges. |
| **Invariant** | `Always` after each roster snapshot: `roster.some(p => p.id === A) === (own !== undefined && own.id === A)` where `A` is session `users.id` and `own` is the roster row for this `clientId`. `Sometimes(space.presence.actor_ne_account)` when a bearer was offered and `own.id !== A` (anonId after failed resolve, or minted UUID when anonId is missing). Api kill wipes in-memory RoomServer; empty roster is offline for everyone (iff holds). Do not require durable DO storage. |
| **Antithesis Angle** | Pause/kill Postgres during `/api/room` upgrade (gateway fallback). Sample `RoomClient.getRoster()` + session id — no Expo. Bob’s roster is a second observer of Alice’s actor. |
| **Why It Matters** | Demotion makes the user still in the puzzle room while account-keyed “online” is false (or a ghost account tile stays online). Distinct from `room-gateway-fallback-not-host`. |

**Open Questions:**

- After take-over, can two roster rows share account `A` long enough that `accountOnline` is true while this `clientId`’s `own.id` is still catching up? `(partial: same-(id,clientId) take-over is sync supersede; two tabs sharing A is first-topology-off; demotion same clientId can leave A+D)`


---

## Outbox, health, lifecycle, schema

### outbox-handler-at-most-once — Outbox handler runs at most once per delivery

| | |
|---|---|
| **Priority** | High |
| **Type** | Safety |
| **Property** | A given `(event_id, consumer_id)` runs its handler at most once per successful processing, including when mutation-path drain overlaps cron. |
| **Invariant** | `Always`: handler success count is 1 after `processed_at`. `Reachable`: two drain txns selected the same due row. |
| **Antithesis Angle** | Overlap cron (second DB session, no ALS) with post-`/mutations` drain. Pause after both SELECTs. |
| **Why It Matters** | Double notify / extra `pushSeq`. Claim SQL has no `FOR UPDATE`. |

**Open Questions:**

- Intended contract: exclusive at-most-once, or at-least-once with idempotent handlers? `(needs human input)`


### outbox-processed-without-notify — Processed without MQTT still heals

| | |
|---|---|
| **Priority** | Medium |
| **Type** | Liveness |
| **Property** | A delivery marked `processed_at` without `notifyChannels` must still reach recipients via snapshot/reconcile. |
| **Invariant** | `Sometimes(outbox.heal_via_reconcile)`. `Unreachable`: recipient permanently missing a server notification after a foreground reconcile window. Do not assert “cron always publishes.” |
| **Antithesis Angle** | Fire cron after friend-request apply; drop EMQX after allocate. |
| **Why It Matters** | Sender sees success; recipient inbox empty until foreground refetch. `notificationsActive` is a session query; background clears the 30s tick. |

**Open Questions:**

- None


### outbox-exhausted-park-not-delivered — Exhausted outbox is parked, not eventually delivered

| | |
|---|---|
| **Priority** | Medium |
| **Type** | Safety |
| **Property** | After `maxAttempts` (default 8) or a permanent parse/validate failure, an outbox delivery is parked (`available_at` ≈ now + 365d, `processed_at` NULL) and must not be treated as eventually delivered. |
| **Invariant** | `Always` after the park UPDATE: `processed_at` is NULL, attempts at cap (or permanent), `available_at` is ~365d ahead, handler success count is 0. `Sometimes(outbox.exhausted_park)`. `Unreachable`: `processed_at` set on a row whose handler never succeeded. Do **not** assert recipient snapshot heal (that is `outbox-processed-without-notify` for **processed** rows only). |
| **Antithesis Angle** | Handler throws under paused Postgres until cap; or invalid payload (park on first attempt). Clock jump of minutes must not unpark; +365d is a separate reclaim scenario, not “original delivery succeeded.” |
| **Why It Matters** | SUT names park as a silent messy state. Copying processed-heal liveness onto exhausted rows fails a designed miss; ignoring park hides inbox actions that never ran. |

**Open Questions:**

- Should the Antithesis image shorten `maxAttempts` so park is reachable without eight backoffs (last step 300s)? `(needs human input)`


### health-ok-db-down-opens-gate — Health-ok must not tight-loop uploads

| | |
|---|---|
| **Priority** | High |
| **Type** | Safety |
| **Property** | `GET /api/health` 200 `{status:'ok'}` must not drive a zero-delay mutation retry loop while Postgres/boot cannot serve writes; when DB returns, the pending queue drains. |
| **Invariant** | `Always`: failed mutation POSTs for the same batch are at least `ERROR_DELAY_MS` apart unless a 2xx ack landed. `Unreachable`: fail → `waitUntilAvailable` resolves in tens of ms → POST again while health is 200 and DB is down. `Sometimes(origin.split_brain_health_vs_db)`. |
| **Antithesis Angle** | Pause/kill Postgres while the Worker stays up. Completed 5xx still `noteSuccess()`. Request `openPgClient` has no connect timeout — hang is in-scope, not only 500. |
| **Why It Matters** | Clients look online and hammer a Worker that cannot reach Neon. Health is documented liveness; the property is bounded backoff, not a readiness rewrite. |

**Open Questions:**

- None


### health-200-while-boot-fatal — Health 200 while boot is fatal

| | |
|---|---|
| **Priority** | Medium |
| **Type** | Safety |
| **Property** | After a fatal `ensureApp` latch, non-health `/api/*` stays 503 `api misconfigured` even while `/api/health` is 200. A concurrent `bootApp` must not overwrite `fatal` with `ready`. |
| **Invariant** | `Always` after in-flight boots settle: `bootState.kind === 'fatal'` ⇒ product routes 503. `Unreachable(fatal then ready)`. `Sometimes(health200 && bootFatal)`. |
| **Antithesis Angle** | Pause between health 200 and `bootApp`; overlap two first product requests; config-error latch. |
| **Why It Matters** | Origin gate opens on a poisoned isolate. Distinct from DB-down (connect failures do not latch). |

**Open Questions:**

- None


### account-switch-close-then-open-sqlite — Account switch serializes SQLite open

| | |
|---|---|
| **Priority** | Medium |
| **Type** | Safety |
| **Property** | Identity change to a different `users.id` closes the prior engine+SQLite before opening `user_<12hex>`. Pending rows in A never appear in B. |
| **Invariant** | `Always`: `deactivatePrevious` before next open. `Always`: pending ids on A ∉ B. First-time Google keeps the same id — tests must use two users. |
| **Antithesis Angle** | Pause between soft-stop and close; returning-Google while A has an in-flight upload. |
| **Why It Matters** | Wrong-account flash; anon queue leaking into the returning account. |

**Open Questions:**

- None


### schema-epoch-preserves-durable-queue — SCHEMA_EPOCH wipes cache, not the upload queue

| | |
|---|---|
| **Priority** | Medium |
| **Type** | Safety |
| **Property** | Bumping `SCHEMA_EPOCH` (code constant 12) drops cache tables but `sync_engine_mutations` rows survive and later upload. |
| **Invariant** | `Always` after wipe: mutation ids unchanged. `Unreachable`: `DROP TABLE sync_engine_mutations` during epoch migrate. Distinct from MEMORY-journal full-file delete. |
| **Antithesis Angle** | Offline queue + kill between `dropCacheTables` and `PRAGMA user_version`. |
| **Why It Matters** | App update while offline would delete queued writes. |

**Open Questions:**

- Crash mid-DROP vs Expo wipe-on-corrupt? `(partial: MEMORY has no WAL; native deletes on any open failure; heal only if open succeeds)`
- Can an old binary upload while a new binary epoch-migrates the same file? `(partial: in-process pool serializes; first topology is one process per volume)`


### mixed-schema-column-intersect-merge — Mixed schemas merge by column intersect

| | |
|---|---|
| **Priority** | Medium |
| **Type** | Safety |
| **Property** | When client and server disagree on columns, merge upserts only the intersection: omitted local columns keep their values, extra server keys are ignored, and a client-ahead write that fails upload does not wipe the engine. |
| **Invariant** | `Always` after merge: omitted local columns unchanged. `AlwaysOrUnreachable` on client-ahead mutate: engine stays mounted. |
| **Antithesis Angle** | Two binaries on one account; HTTP snapshots and MQTT images. |
| **Why It Matters** | Named wipe/clobber hotspot. Pins exist in-sim; mid-fault merge is the gap. |

**Open Questions:**

- None

---

## Auth and API liveness (gap-fill)

### expired-token-refresh-then-drain — Expired session; queued mutations drain after remint

| | |
|---|---|
| **Priority** | High |
| **Type** | Liveness |
| **Property** | After a session is expired, a client that later holds a valid bearer eventually uploads the durable queue; expired 401s do not wipe. Product `getFreshToken` is store-read only — remint is workload oauth-dev / e2e. |
| **Invariant** | `Always`: 401 `expired` does not `deleteDatabase`. `Always` after a later server-accepted request: pre-expiry pending ids are in `mutations_applied` (or queue empty and writer matches Postgres). `Sometimes(auth.expired_401_then_valid_drain)`. `Unreachable`: upload stopped with a non-empty queue while a valid bearer is stored and HTTP is up. |
| **Antithesis Angle** | Clock jump or `UPDATE expires_at`; 4s `raceFreshToken` timeout; then workload remint. Sim `refreshExpired()` is not in this image. |
| **Why It Matters** | Local writes look durable while every upload is 401 expired. mqtt-http heal assumes a bearer the server still accepts. |

**Open Questions:**

- Can the tenant jump clock ≥ 30d, or must the workload `UPDATE expires_at`? `(partial: topology lists OAuth TTL jump; no tenant max; SQL expire works)`

### oauth-consume-orphan-no-client-session — OAuth consume without a client session

| | |
|---|---|
| **Priority** | High |
| **Type** | Liveness |
| **Property** | If an exchange/provider code is consumed and the client never persists a bearer, the IdP user exists, the client is not signed in, and a new OAuth launch for the same subject eventually yields a session for that same `idp_users.id`. |
| **Invariant** | `Always` after consume without a persisted bearer: client bearer empty. `Always` after a later successful ceremony for the same subject: session `user_id` equals the pre-existing user. `Sometimes(oauth.orphan_user_no_client_session)`. Complement of `oauth-exchange-code-consumed-once`. |
| **Antithesis Angle** | Kill after upsert before attach, or after consume before the client reads 200. Fake-Google and oauth-dev both re-issue on a second launch. |
| **Why It Matters** | Confirmed IdP success, then anonymous. A second ceremony that mints a **new** user splits profiles and SQLite files. |

**Open Questions:**

- Should a lost 200 after `createSession` leave the unused `idp_sessions` row live? `(needs human input)`

### api-remake-foreground-query-applies — After API remake, foreground query still applies

| | |
|---|---|
| **Priority** | High |
| **Type** | Liveness |
| **Property** | After the `api` process is remade (optionally after a forward clock jump), a foreground client that can complete `POST /api/query` eventually applies a snapshot whose subscribed domain matches Postgres. |
| **Invariant** | `Always` after remake + foreground query: live user-scoped rows match Postgres. `Sometimes(sync.checkpoint.remake_below_client_highwater)`. `Unreachable`: `hasSynced` from `not_modified` while local domain ≠ Postgres. Oracle is domain vs server, not seq columns. |
| **Antithesis Angle** | Process kill of `api` (`checkpointSeq` resets to 0). Forward clock jump then remake is the reliable freeze trigger; same-ms remake usually does not freeze. |
| **Why It Matters** | Isolate-local allocator: HTTP 200 while social state is frozen. Unique to this topology — sim keeps one `createSyncApp`. |

**Open Questions:**

- Will setup persist checkpoint high-water across `api` restart? `(partial: product is checkpointSeq=0; Dockerfile not written)`

### upgrade-required-retry-bounded — Protocol cut retries are bounded; queue drains after v3

| | |
|---|---|
| **Priority** | High |
| **Type** | Liveness |
| **Property** | While `/query` or `/mutations` returns 401 `upgrade_required`, pending ids are not acked as applied and uploads must not tight-loop; after the client again sends `x-sync-protocol: 3`, the durable queue drains. |
| **Invariant** | `Always` during the cut: pending ids still in `sync_engine_mutations`; not newly in `mutations_applied`. `Always`: failed POSTs ≥ `ERROR_DELAY_MS` apart unless 2xx. `Always` after header 3 + HTTP up: those ids applied. Wipe is `upgrade-required-no-local-wipe`. |
| **Antithesis Angle** | Workload forges header `2`. Health stays 200; completed 401 still `noteSuccess()`. Restore header 3. |
| **Why It Matters** | No upgrade UI. A 401 classified as network would hammer; a false `applied` ack drops local-only work. |

**Open Questions:**

- Park after N attempts vs bounded-forever retry until the binary is upgraded? `(needs human input)` — code retries forever at 2s…60s.

---

## Deferred (evidence on disk, not first-pass portfolio)

These remain as evidence files for a later pass. They are either unit-test-shaped, topology-blocked, or lower user impact.

| Slug | Why deferred |
|---|---|
| `web-sync-owner-single-uploader` | First topology is Node, no OPFS / Web Locks / tabs. Evidence kept. |
| `room-single-log-per-topic` | Split-brain needs two room processes; first topology is one in-process RoomServer (Unreachable by construction). Hash-equals-fold is covered by `room-command-id-applies-once`. |
| `mutation-actor-from-session-only` | Forged envelopes are unit/integration; account-switch in-flight is `account-switch-close-then-open-sqlite`. |
| `paint-ready-before-first-sync` | Documents a non-guarantee (`paintReady` ≠ hydration). Useful `Sometimes` hint. |
| `three-seq-spaces-unconflated` | Needs SUT-side seq probes. User-visible freeze is `api-remake-foreground-query-applies`. |
| `postgres-per-request-connect-settles` | Resource hang; pairs with health-lie. |
| `emqx-publish-wait-until-connected-settles` | No-timeout waiter set. Hard to bound without an agreed N. |
| `optimistic-fanout-buffer-drop-oldest` | Product `bufferOutboundLive` defaults off. |
| `sqlite-version-probe-failure-is-not-postgres` | First topology is Node API + Postgres. |
| `room-and-sync-canonicalizers-agree-integer-keys` | Both currently `Object.keys().sort()`; unit territory unless a “fix” lands. |
| `lagging-client-schema-catchup` | Needs two schema-version binaries. |

## Assumptions

- First topology: Node API + Postgres + EMQX + two SQLite clients (see `deployment-topology.md`). Web-only properties (`web-sync-owner-single-uploader`) are skipped until an OPFS variant. In-process RoomServer is heap memory — api process kill wipes the room log; do not require durable DO storage.
- Process (node termination) faults must be enabled.
- Reconcile interval: either shorten in the Antithesis build or size eventually windows > 30s.
- In-tree sim pins are oracles to port, not coverage of this topology.

## Catalog-wide open questions

- Confirm tenant process-fault + clock-fault availability.
- Whether to instrument the SUT (TypeScript SDK) in the first campaign or stay workload-only.
