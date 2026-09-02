---
sut_path: /Users/chrisvouga/gamezilla
commit: ddde94db466ae77df20385c54ead0c79ae20b2c8
updated: 2026-09-01
external_references: []
---

# Evaluation — Antithesis Fit

Lens: whether each cataloged property requires a state space that deterministic tests cannot cover (timing, concurrency, partial failure, combinatorial interleavings). Flag unit/integration-test territory, assertion types that do not match the testing mode, and places where Antithesis value is underestimated.

Inputs: `property-catalog.md`, `sut-analysis.md`, `deployment-topology.md`, `existing-assertions.md` (all at `ddde94db466ae77df20385c54ead0c79ae20b2c8`), plus per-property evidence under `properties/`. Catalog frontmatter was briefly drifted to `b2cd713c…` when this lens ran; synthesis aligned it. No external references. Assertion-type language is grounded in [Antithesis assertions](https://antithesis.com/docs/concepts/properties_assertions/assertions.md) and [Sometimes assertions](https://antithesis.com/docs/concepts/properties_assertions/sometimes_assertions.md): `Always` must be encountered at least once; `AlwaysOrUnreachable` treats “never hit” as pass; `Sometimes` is a situation-coverage checkpoint that also steers search; `Reachable` / `Unreachable` are location coverage.

This lens does **not** categorize findings as Gap / Bias / Refinement.

## Catalog-wide read

The first-pass High set (12) is mostly in Antithesis’s sweet spot. Sync LWW, MQTT vs HTTP, mutation lost-ack, MEMORY-journal kill, `handlePush` TOCTOU, outbox unlocked claim, OAuth SELECT-then-DELETE, room `commandId` vs two KV keys, room gateway auth fallback, and health-ok-while-DB-down all need real sockets, process kill, thread pause, or asymmetric partition — the class `sut-analysis.md` [tests] says PBT declined and the in-process sim does not replay.

The catalog already parks nine slugs as deferred, and the deferred table’s *reasons* are mostly honest about fit (`room-and-sync-canonicalizers-agree-integer-keys` = “fixture Always is cheap unit territory”; `paint-ready-before-first-sync` = “Useful `Sometimes` hint, not a first Always”). That self-sorting is a pass for the lens. The remaining problems sit in the **active** High/Medium set (properties that look like protocol-classifier unit tests but carry High/Medium budget) and in **deferred** slugs whose deferral reason understates uniqueness versus the sim.

No Antithesis SDK exists (`existing-assertions.md`). Every suggested `Always` / `Sometimes` / `Reachable` is missing. That does not change fit; it means first-campaign properties will be workload-evaluated unless SUT instrumentation is added. Fit still depends on whether the *invariant* needs fault-injected state space.

## Sweet-spot properties (pass)

These require interleavings, partitions, or process kill that the determinism harness cannot faithfully produce (virtual mesh, dispose+remake crash, settle-then-check). They belong in Antithesis.

| Slug | Why it is in the sweet spot |
|---|---|
| `lww-merge-no-wipe-clobber` | Overlapping `handlePush` vs snapshot merge, asymmetric MQTT+HTTP, kill mid-`applyFullMerge`. In-sim pins heal first; mid-fault safety is the gap. `AlwaysOrUnreachable` on regressive profile images is the right type (product `ensureProfile` may never emit empty username). |
| `lww-upload-arrival-under-partition` | Two devices, concurrent `POST /api/mutations`, `acquireLock` no-op, clock jump must not change winner if arrival order is unchanged. `Sometimes(multi_writer_conflict)` is a search checkpoint, not a substitute for the post-heal `Always`. |
| `mutation-id-first-wins-ack-applied` | Kill API after commit before 200; kill client after 200; two isolates same id different args. At-least-once upload is designed. |
| `memory-journal-crash-wipes-queue` | SIGKILL mid-txn under `PRAGMA journal_mode=MEMORY`. Sim crash is dispose+remake, often `preserveLocalDb`. First topology fail-closes Expo auto-wipe — still unique vs sim. |
| `tombstone-sync-and-pending-revive` | Partition so tombstone fanout and pending upsert race. `Sometimes` on pending-rebase revive is situation coverage of a claimed (not buggy) path. |
| `device-private-rows-stay-local` | Same-account MQTT `user:{id}` plus optimistic `pushSeq: '0'`. Confirmed pin class; needs real fanout. |
| `overlapping-handle-push-seq-toc-tou` | Pause between `readLastPushSeq` and `recordPushApplied`; MQTT dup/reorder. Classic TOCTOU. |
| `mqtt-http-independent-fault-domains` | Cut EMQX independently of API; kill after allocate before publish; background the 30s tick. `Sometimes(mqtt_down_http_up)` / `Sometimes(pushseq_gap_then_http_refetch)` are the right search hints. |
| `stale-push-images-after-snapshot-merge` | Pause after `isContiguousNext`, before `withMergeSingleFlight`. Timing-only. |
| `emqx-url-hydrates-over-http-without-push` | EMQX down, HTTP up, cold SQLite has no broker URL. Liveness under partial failure. |
| `concurrent-mutations-noop-lock` | Two API sessions paused across the flattened request txn; READ COMMITTED; no `FOR UPDATE`. |
| `multi-device-same-actor-converge` | Partition one install; the other writes; heal HTTP only. Complements device-private. |
| `oauth-exchange-code-consumed-once` | Pause between SELECT and DELETE under READ COMMITTED. Auth DST has no partition/crash. |
| `denied-scope-no-fanout-leak` | Unfriend while a 15-minute MQTT JWT still lists `room:{id}`; image between deny and unsubscribe. |
| `private-space-join-requires-acl` | Concurrent `removeFriend` + `joinSpace`. Static ACL alone would be unit; the catalog’s race is the property. |
| `room-gateway-fallback-not-host` | Pause/kill Postgres during WS upgrade; `anonId=<victim>`. Sim `RoomServer` never runs `createRoomApp`. |
| `room-command-id-applies-once` | Kill after `appendCommittedEntries` before `putDedupOutcome` (separate KV keys). Hibernation refolds without rebuilding missing dedup. |
| `room-welcome-truncation-resync` | Grow log past 512; kill mid-welcome. Sim loopback rarely hits the cap. |
| `sync-membership-and-room-seat-agree` | Two merge theories (event-log vs LWW) plus gateway demotion of `x-actor-id`. Cross-plane, fault-timed. |
| `outbox-handler-at-most-once` | Overlap cron (second DB session, no ALS) with post-`/mutations` drain; pause after both SELECTs. |
| `outbox-processed-without-notify` | Cron marks `processed_at` and skips `notifyChannels`; recipients must still heal via snapshot. Partial-failure + 30s foreground gate. |
| `health-ok-db-down-opens-gate` | Pause/kill Postgres while Worker stays up; 5xx still `noteSuccess()`; `openPgClient` has no connect timeout. |
| `health-200-while-boot-fatal` | Overlapping `bootApp` can overwrite `fatal` with `ready`. `Unreachable(fatal then ready)` is a concurrency latch, not a config unit test. |
| `account-switch-close-then-open-sqlite` | Pause between soft-stop and close; returning-Google while A has an in-flight upload. |
| `mixed-schema-column-intersect-merge` | Two binaries + HTTP snapshots and MQTT images. In-sim pins exist; mid-fault merge is the Antithesis increment. Topology must actually run two schemas (see Uncertainties). |

`web-sync-owner-single-uploader` is also sweet-spot (hung-not-dead owner vs Web Locks) but the first Node topology cannot run it. That is a topology hold, not a fit miss. Catalog Medium + “not first topology” is correct.

## Finding 1 — Auth classifier properties are unit/integration tests wearing High/Medium labels

**Properties:** `upgrade-required-no-local-wipe` (High), `unclassified-401-defaults-expired` (Medium)

**Scope:** property-specific (two slugs that share one HTTP 401 parser)

**Concern:** The checkable first-topology experiments do not need Antithesis’s state-space search. They need a fixed request and a file-existence check.

`upgrade-required-no-local-wipe` evidence (`properties/upgrade-required-no-local-wipe.md`) already says the unique value is “mixed-version processes plus kill/partition during the 401 → error-classify → optional wipe window — **not the unit gate itself**.” Investigation then shows:

- Product `isAuthRevoked` is `reason === 'revoked'` only; `upgrade_required` never enters `revokeDatabase`.
- First topology has one client image; Reachable “old client” is a workload header `2` / strip (`deployment-topology.md` config notes).
- No third host remaps every `error: 'auth'` to wipe.

So the High `Always` (“after that 401, domain rows and pending ids still exist”) is: send `x-sync-protocol: 2`, assert the SQLite file still has rows. That is a contract/integration test of `assertSyncProtocol` + `sync-http-client.ts` + `isAuthRevoked`. The wipe path is not racing anything unless a host that treats all 401s as revoke exists — and this tree does not have one. Search budget spent “hunting interleavings” around a synchronous classify-then-maybe-delete will not find a new class of bugs.

`unclassified-401-defaults-expired` is the same parser, four lines:

```
const json = (await response.json().catch(() => ({}))) as { reason?: unknown };
if (json.reason === 'upgrade_required') throw …('upgrade_required');
throw new SyncApiAuthError(json.reason === 'revoked' ? 'revoked' : 'expired');
```

Evidence: “No unit test asserts the `json().catch(() => ({}))` → expired default.” That sentence is the tell. Empty/HTML/partial JSON 401s are a table of inputs, not a timing/concurrency space. The 4s `raceFreshToken` interleave is a thin Antithesis garnish on a classifier.

The two properties also collide: a stripped `upgrade_required` body becomes `expired` (unclassified-401) and must not wipe (upgrade-required). One parser, two catalog rows, High+Medium.

**Suggested action:** Keep a cheap workload `Always` if a driver already sends header `2` and a malformed 401 (one assertion family). Do not treat them as first-wave search targets. Add the missing unit pin on the 401 body parser. Demote uniqueness vs `oauth-exchange-code-consumed-once` / `account-switch-close-then-open-sqlite`.

## Finding 2 — `mutation-actor-from-session-only` is a per-request unit invariant

**Property:** `mutation-actor-from-session-only`

**Scope:** property-specific

**Concern:** “Forged batch envelopes; `ownerId` spoof” does not require fault injection. Replay already copies `MutationEnv` from `deps.auth` (`properties/mutation-actor-from-session-only.md`). Investigation found no `actorId` / `accountId` / `isAnon` fields on product `defineMutation` args. Chess `ownerId` is a local `=== env.actorId` check — unit.

The catalog’s Antithesis Angle also lists “account-switch with in-flight upload.” That race is already `account-switch-close-then-open-sqlite` (pending ids on A ∉ B). Folding session-wins-on-replay into that property’s postcondition is enough; a standalone Medium row will consume timeline budget asserting `env.actorId === deps.auth.actorId` on every replay, which a deterministic test can exhaust.

`Always` at the start of `applyReplayMutationInTxn` is a fine *production* defensive assertion if an SDK is added later. It is not a reason to spend Antithesis exploration on forged envelopes.

**Suggested action:** Treat as a unit/SUT defensive `Always` (or drop from the first workload). Keep account-switch + in-flight upload on `account-switch-close-then-open-sqlite`.

## Finding 3 — Deferred table correctly parks some unit tests; two slugs still over-argue Antithesis

**Properties:** `room-and-sync-canonicalizers-agree-integer-keys`, `sqlite-version-probe-failure-is-not-postgres`

**Scope:** property-specific (deferred set)

**Concern:** Catalog deferral reasons are right; the evidence files still sell a sweet-spot story that the first topology cannot cash.

`room-and-sync-canonicalizers-agree-integer-keys` — catalog: “Both currently `Object.keys().sort()`; fixture Always is cheap unit territory unless a ‘fix’ lands.” Evidence then argues Hermes vs V8 vs Bun after reconnect/hibernate. First topology is Node API + Node clients (`deployment-topology.md`). The functions are pure copies. A fixture `{ "10": 1, "2": 2 }` in a unit test is the whole property. `Reachable` when a live `RoomState` has an integer-like key may stay silent (seats are UUIDs) — evidence already notes this; a fixture `Always` is then the only hit, which is unit.

`sqlite-version-probe-failure-is-not-postgres` — catalog: “First topology is Node API + Postgres, not matchmaking-on-SQLite.” The dangerous path is **faulted SQLite** classified as Postgres. That path is not in the first cluster. On the API Postgres client, `SELECT sqlite_version()` always throws (undefined function); `Reachable("probe threw")` is trivial, not a search hint. Evidence’s invariant section also says `Reachable` on “probe threw then `sqlite_version()` succeeded” (the inversion) and later `Unreachable` for the same inversion. Reachable-on-the-bug is the wrong type; Unreachable is the type.

**Suggested action:** Leave both deferred. Do not promote on a “multi-engine” story unless the topology adds a SQLite-backed installer or a second JS engine. Fix the evidence contradiction: inversion is `Unreachable`, not `Reachable`.

## Finding 4 — `Always` on the revoke-wipe branch will fail if never encountered

**Property:** `unclassified-401-defaults-expired` (also touches `upgrade-required-no-local-wipe` Unreachable)

**Scope:** property-specific (assertion type)

**Concern:** Antithesis `Always` fails if the assertion is never encountered. Product sync 401s are `expired` only; `reason: 'revoked'` is README/sim-only (`properties/unclassified-401-defaults-expired.md` investigation). Catalog `Always`: “well-formed `revoked` does wipe.”

If the first workload does not inject a well-formed `revoked` 401, that `Always` is “not encountered” → property fail, even though the interesting default (malformed → expired, no wipe) held. That is the wrong type for an optional / injected-only branch. Docs: use `AlwaysOrUnreachable` when the path may not appear; use `Reachable` / `Sometimes` to force the workload to hit the wipe fork.

`Unreachable`: wipe from `upgrade_required` is fine (must_hit false).

**Suggested action:** Split: `Always` (or workload check) that non-`revoked` 401 does not wipe; `AlwaysOrUnreachable` or injected `Reachable` + `Always` on the wipe branch; do not use a must-hit `Always` on a body the product API never emits.

## Finding 5 — `Always` “connect/publish settles” without a bound is not a safety property

**Properties:** `postgres-per-request-connect-settles`, `emqx-publish-wait-until-connected-settles`

**Scope:** property-specific (deferred; assertion type)

**Concern:** Both evidence files want `Always` that an unbounded waiter eventually settles. Today the code has **no** application deadline (`openPgClient` has no `connectionTimeoutMillis`; MQTT `waitUntilConnected` is an unbounded `Set`; HTTP publish `fetch` has no `signal`). An `Always(settled before N)` is either:

- false on every hung timeline (the bug is the missing bound — but then N is a new product contract, not a claimed guarantee), or
- `Unreachable` for “hung across a quiet period,” which evidence for EMQX already warns against: “today the code allows it.”

`Sometimes(fail-fast while health is 200)` on Postgres connect is likely **never true** until a timeout is added — a `Sometimes` that cannot fire fails the campaign as “tests too weak” when the real issue is “situation is unreachable by design.” That is the astronomically-unlikely / never-reachable `Sometimes` the lens is supposed to catch.

These are still *high Antithesis value* as hang/leak explorations (see Finding 6). The assertion *type* as currently worded is wrong.

**Suggested action:** Until a numeric bound exists: `Reachable` on “connect parked while health 200” / “`connectWaiters` grew while status down”; `Always` on a **count** bound (`in-flight connects ≤ N`, `connectWaiters.size ≤ 64`) if that is the intended resource contract; do not `Always` “settles” or `Sometimes` “fails fast” until the SUT can fail fast.

## Finding 6 — Deferred “resource / seq / schema” slugs underestimate Antithesis uniqueness

**Properties:** `three-seq-spaces-unconflated`, `postgres-per-request-connect-settles`, `emqx-publish-wait-until-connected-settles`, `lagging-client-schema-catchup`, `paint-ready-before-first-sync`, `presence-online-matches-room-actor-id`

**Scope:** catalog-wide (deferred-set composition vs SUT “Antithesis unique value” table)

**Concern:** Several deferral reasons read as “hard to instrument / already pinned / naming overlap,” which hides that these are *more* unique to Antithesis than some High protocol-classifier rows.

### `three-seq-spaces-unconflated` (strongest underestimate)

Catalog: “Strong invariant; needs SUT-side seq probes. Port after SDK lands.”

Evidence (`properties/three-seq-spaces-unconflated.md`): sim keeps one `createSyncApp` and one checkpoint allocator for the world lifetime. Product allocator is isolate-local, no `initialLast` from Postgres. Server field named `checkpoints` holds **pushSeqs**. `compareCheckpoint` compares both spaces; query checkpoint shape matches the legacy wall-clock pushSeq. Process kill + remake + concurrent `/mutations` + MQTT is exactly the class that remints checkpoints below a client’s `last_checkpoint` (silent snapshot freeze) or floors `ackSeq` into `sync_engine_push_applied`.

That is timing + process kill + combinatorial mix-up of three integer spaces. Instrumentation cost is not low *value*. It is higher unique-to-Antithesis than `upgrade-required-no-local-wipe`.

### `postgres-per-request-connect-settles` and `emqx-publish-wait-until-connected-settles`

Catalog: “Resource hang; pairs with health-lie” / “No-timeout waiter set. Hard to bound without an agreed N.”

SUT analysis [failure] / [deps]: product request path has almost no timeouts; health stays 200. `health-ok-db-down-opens-gate` (High) already includes “hang is in-scope, not only 500.” The deferred pair is the **resource** half of that High property: unbounded TCP sessions / unbounded `connectWaiters` under partition. Antithesis is the tool that can hold Postgres blackholed while counting leaked promises. Deferring them as “hard to bound” is an implementability note, not a fit note. Fit is high. See Finding 5 for how to assert without inventing N as a fake `Always`.

### `lagging-client-schema-catchup`

Catalog: “Needs two schema-version binaries; planner already well pinned in-sim.”

Evidence: DST settle *forces* `advancePeer` on mem engines. Antithesis unique increment is persist a real SQLite file at vN, deploy vN+k, kill during rebuild (`rename → create → copy → drop`). That is crash + real engines — the PBT class declined. `mixed-schema-column-intersect-merge` covers the *old binary still running* case; this slug is the *new binary opening the old file* case. Topology-blocked today (one image), but uniqueness is underestimated if the reason is “already pinned.”

### `paint-ready-before-first-sync`

Catalog: “Documents a non-guarantee (`paintReady` ≠ hydration). Useful `Sometimes` hint, not a first Always.”

The Always deferral is correct (an `Always(!paintReady || !hasSynced)` would be false; a tautological Always is worthless — evidence already rejects `Always("paint-ready-does-not-require-hasSynced", !paintReady || true)`). The underestimate is dropping the **`Sometimes(paintReady && !hasSynced)`** from first-wave *search guidance*. Antithesis Sometimes assertions exist to checkpoint rare situations and restart timelines from them. Cold start + API down after health 200 is cheap to hit and steers the High heal properties. Wrong-identity paint under account-switch is already a High/Medium race (`account-switch-close-then-open-sqlite`).

### `presence-online-matches-room-actor-id`

Catalog: “Naming bug; overlaps gateway fallback.”

`room-gateway-fallback-not-host` (High) is privilege. This slug is the user-visible roster: tile keyed by account `A` while socket actor is install `D` → “connected and offline.” `Sometimes(actor_ne_account)` is the search hint *for* the gateway property. Overlap is real; treating it as low-value naming is an underestimate of Sometimes-as-checkpoint (same docs as paint-ready).

**Suggested action:** When ranking the second wave, promote `three-seq-spaces-unconflated` ahead of auth-classifier High/Medium. Keep resource-hang slugs as siblings of `health-ok-db-down-opens-gate` with count/`Reachable` assertions (Finding 5). Add `Sometimes(paintReady && !hasSynced)` and `Sometimes(room actor ≠ account)` as first-wave search hints even if their Always forms stay deferred. Do not promote `lagging-client-schema-catchup` until a second schema image exists.

## Finding 7 — `room-single-log-per-topic` is vacuous on the first topology

**Property:** `room-single-log-per-topic`

**Scope:** property-specific

**Concern:** Split-brain (two `RoomServer` processes persisting one topic) is the Antithesis-interesting claim. First topology folds RoomServer into `api` (`deployment-topology.md`: “Dual-process variant deferred”). Catalog already says `Unreachable` dual-process in the first single-writer topology.

What remains is `Always` live hash equals fold of a contiguous seq log — the same oracle as `room-command-id-applies-once` / room DST `live-vs-log`. Running both as Medium+High on one in-process log spends budget on a unit/sim-shaped fold check plus a split-brain `Unreachable` that is never installed (Unreachable never called → pass, no search guidance).

**Suggested action:** Keep hash-equals-fold as part of `room-command-id-applies-once` / welcome resync. Hold the split-brain `Always` until a dual-process (or empty-disk restart) variant exists. An `Unreachable(second room process committed)` in a one-process cluster does not steer search.

## Finding 8 — `optimistic-fanout-buffer-drop-oldest` Sometimes/Always is vacuous if the buffer is off

**Property:** `optimistic-fanout-buffer-drop-oldest`

**Scope:** property-specific (deferred; assertion type)

**Concern:** `bufferOutboundLive` defaults **false** (`properties/optimistic-fanout-buffer-drop-oldest.md`). The 256 drop-oldest queue is only created when `bufferOutbound` is true. A `Sometimes(overflow dropped oldest)` or `Always(queue ≤ 256)` on the buffer object will never be encountered in product defaults → `Always` fails (not encountered) or `Sometimes` fails (never true).

The connected fast path (the default) piles in-flight `publish()` promises — that is `emqx-publish-wait-until-connected-settles`, not this cap.

Catalog deferral (“product `bufferOutboundLive` may be off”) is right. The evidence’s implied Always/Sometimes still needs a must-enable flag or `AlwaysOrUnreachable`.

**Suggested action:** Do not enable this property unless the Antithesis build sets `bufferOutboundLive: true`. Then `Always(queue.length ≤ 256)` plus `Sometimes(drop-oldest ran)` is real capacity exploration (good fit). Otherwise leave deferred.

## Finding 9 — `schema-epoch-preserves-durable-queue` happy path is sim-exhausted; crash+partition is the only increment

**Property:** `schema-epoch-preserves-durable-queue`

**Scope:** property-specific

**Concern:** Pins already cover epoch bump, mid-offline bump, crash-during-epoch, cache-clear preserve (`properties/schema-epoch-preserves-durable-queue.md`). The catalog Medium `Always` after wipe (mutation ids unchanged) is the same postcondition. First topology is one process per volume; evidence tagged the two-binary shared-file case as not a shipping path.

Antithesis increment that remains: real SIGKILL between `dropCacheTables` and `PRAGMA user_version` **while HTTP is still partitioned**, so drain is post-heal, plus a second kill during `createCurrentSchema`. That is real, but thinner than High merge/outbox/OAuth. If the workload only bumps `schemaEpoch` on a live origin, the property is a sim duplicate.

**Suggested action:** Keep Medium. Gate the workload on (offline queue) ∧ (kill mid-migrate) ∧ (origin down). Do not treat a clean epoch bump as an Antithesis win.

## Finding 10 — `health-200-while-boot-fatal` Sometimes is a designed split, not a rare race

**Property:** `health-200-while-boot-fatal`

**Scope:** property-specific (assertion type — minor)

**Concern:** Health is **intentionally** isolate liveness (`sut-analysis.md` [failure]; `handleHealthRequest` does not read boot state). `Sometimes(health200 && bootFatal)` will fire on any timeline that latches fatal and then probes health — a scripted setup, not a 1/1000 interleaving. That is still a valid Sometimes (situation coverage: “we did hit the lie”), but it should not be sold as steering toward a rare combo. The rare combo is `Unreachable(fatal then ready)` from overlapping `bootApp` — that is the sweet-spot clause (Finding sweet-spot table).

**Suggested action:** Keep `Sometimes` as a coverage hint that the workload actually latched fatal. Put search weight on the overlapping-boot `Unreachable` / post-settle `Always`.

## Passes (checked, look correct)

- High cluster for LWW, fanout TOCTOU, lost-ack idempotency, MEMORY journal, MQTT/HTTP split, outbox double-claim, OAuth consume, room commandId, room gateway, health-ok-vs-DB is the right first-wave *shape* for this SUT. Matches `sut-analysis.md` failure-prone areas 1–7.
- `AlwaysOrUnreachable` on regressive profile drop (`lww-merge-no-wipe-clobber`) and client-ahead mutate (`mixed-schema-column-intersect-merge`) matches Antithesis “rare path, pass if never hit.”
- `Sometimes` on `multi_writer_conflict`, `mqtt_down_http_up`, `pushseq_gap_then_http_refetch`, pending-rebase revive, `outbox.heal_via_reconcile`, `origin.split_brain_health_vs_db` are situation checkpoints, not fake Always-liveness.
- Deferred table already names unit-shaped slugs (`room-and-sync-canonicalizers`, paintReady as non-Always) instead of smuggling them into High.
- `web-sync-owner-single-uploader` is not oversold for a Node-only cluster.
- `tombstone-sync-and-pending-revive` correctly refuses to treat claimed LWW revive as `Unreachable`.
- `mqtt-http-independent-fault-domains` correctly refuses to Always `last_push_seq` catch-up (`commitPendingPushSeqs` can floor).
- `outbox-processed-without-notify` correctly refuses “cron always publishes.”
- `health-ok-db-down-opens-gate` is bounded backoff, not a readiness rewrite — matches the product’s documented health lie.
- Existing assertions scan is empty; nothing in the catalog double-counts an in-tree SDK call.

## Uncertainties

- **Process-fault and clock-fault availability** on the tenant (`property-catalog.md` catalog-wide open questions). MEMORY-journal, mutation lost-ack, room commandId, three-seq remake, and OAuth pause all degrade if node termination is off. Fit ranking assumes those faults are on, as `deployment-topology.md` requires.
- **SUT SDK vs workload-only.** Several underestimated slugs (`three-seq-spaces-unconflated`) are deferred *because* they need SUT-side probes. If the first campaign is workload-only, their implementability drops; their *fit* stays high. This lens cannot resolve the instrumentation decision.
- **`mixed-schema-column-intersect-merge` and `lagging-client-schema-catchup`** need two declared schemas / two binaries. First topology is one client image. If the workload only crafts intersecting snapshots against one schema, mixed-schema collapses toward a unit upsert test. Whether setup will ship a second image is not decided here.
- **`memory-journal-crash-wipes-queue`:** first topology uses bun/better-sqlite3, not `impl-expo-sqlite` wipe-on-corrupt (`deployment-topology.md` open questions). Node last-commit vs Expo empty-file is a different outcome. Fit stays (kill mid-MEMORY-txn); the Expo `Sometimes(wipe.lost_pending_queue)` may be Unreachable on this image.
- **`schema-epoch` vs Expo wipe-on-corrupt** mid-DROP (partial in evidence): if open fails, A11 dominates and epoch policy never runs. Whether Antithesis will see heal vs full-file delete depends on the SQLite engine choice.
- **`private-space-join-requires-acl`:** if the workload never overlaps `removeFriend` and `joinSpace`, the remaining Always is a unit ACL table. Fit depends on the driver constructing the race.
- **Room hash-equals-fold** under in-process `RoomServer`: wall-clock DO `alarm()` / hibernation is not in this topology. `room-command-id-applies-once` kill-between-KV-keys still applies; alarm-vs-clock uniqueness does not. How much room sweet-spot survives the Node composition is a setup question.
- Catalog frontmatter was briefly `b2cd713c…` during this lens; synthesis aligned it to `ddde94db…`. Uncommitted working-tree work (auth, db-indexes, sync notify) was not treated as changing property fit.

## Assumptions

- Whole-product first campaign on the Node + Postgres + EMQX + two-client topology in `deployment-topology.md`.
- In-tree sim pins are oracles, not Antithesis coverage — a property can be both “pinned in-sim” and “high Antithesis value” if the pin heals before check or uses a virtual mesh.
- Claimed guarantees remain claims; this lens only asks whether *testing the claim* needs Antithesis.
