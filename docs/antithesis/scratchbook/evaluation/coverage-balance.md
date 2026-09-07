---
sut_path: /Users/chrisvouga/gamezilla
commit: ddde94db466ae77df20385c54ead0c79ae20b2c8
updated: 2026-09-01
external_references: []
---

# Coverage Balance — Property Catalog vs SUT + Topology

Lens: is this the **right SET** given `sut-analysis.md` and `deployment-topology.md`? Not “is each property good.” Findings are not labeled Gap / Bias / Refinement.

Inputs: catalog (body, not the overview counts), SUT analysis at `ddde94db466ae77df20385c54ead0c79ae20b2c8`, topology, `existing-assertions.md` (no SDK), `property-relationships.md`, evidence under `properties/` as cited. Scope: `external_references: []`. Catalog frontmatter was briefly `b2cd713c…` when this lens ran; synthesis aligned it to the same HEAD.

## Method

1. RandomActionsReport SUT sections `[architecture]` … `[wildcard]` and the numbered **Failure-prone areas**.
2. For each high-risk or claimed guarantee, ask whether the first-pass catalog (High + Medium) has a corresponding property, a deferred evidence-only slug, or nothing.
3. Compare density to risk, not to “number of interesting bugs we already pinned.”
4. Check safety / liveness / reachability mix, then component coverage against the six-container topology.
5. Look for the discovery-miss patterns this lens calls out: cross-subsystem interactions, bug-history that did not map to one focus, lifecycle/operational transitions, optional/configurable behavior.

## Portfolio snapshot

The catalog overview table says High 12 / Medium 17 / Low 9. Counting the body:

| Band | Count | Slugs |
|---|---|---|
| High | 12 | matches overview |
| Medium | **19** (overview says 17) | tombstone, device-private, stale-push, emqx-url, concurrent-mutations, web-sync-owner, multi-device, unclassified-401, mutation-actor, denied-scope, private-space-join, room-single-log, room-welcome, sync-membership, outbox-processed, health-200, account-switch, schema-epoch, mixed-schema |
| Deferred | 9 | matches the deferred table |

`properties/` has 40 evidence files = 12 + 19 + 9.

**Type column (first-pass only):** Safety 28, Liveness 3 (`mqtt-http-independent-fault-domains`, `emqx-url-hydrates-over-http-without-push`, `outbox-processed-without-notify`), Reachability **0**. Many Safety cards still embed `Reachable` / `Sometimes` / `Unreachable` in the Invariant field. No Antithesis SDK exists (`existing-assertions.md`), so those clauses are planned, not live search guidance.

**High band vs SUT priority list:** 11 Safety + 1 Liveness. The High twelve map onto SUT failure-prone areas 1–7 (merge, idempotency, pushSeq, outbox, auth wipe/OAuth, room gateway/commandId, health-lie). Area 8 (schema/migrate under traffic) is intentionally Medium/deferred.

---

## SUT risk walkthrough

### Failure-prone areas (SUT § priority 1–8)

| # | SUT risk | First-pass coverage | Density vs risk |
|---|---|---|---|
| 1 | Sync merge/fanout isolation under real MQTT+HTTP partition | `lww-merge-no-wipe-clobber`, `lww-upload-arrival-under-partition`, `tombstone-sync-and-pending-revive`, `device-private-rows-stay-local`, `stale-push-images-after-snapshot-merge`, `mixed-schema-column-intersect-merge`, `multi-device-same-actor-converge` | Highest density. Matches confirmed wipe/clobber pin cluster. Relationships already warn not to drop wipe because arrival-order does not cover omitted-key / empty-image. Appropriate, not over-weight. |
| 2 | Mutation idempotency + MEMORY-journal crash | `mutation-id-first-wins-ack-applied`, `memory-journal-crash-wipes-queue` | Right count. Web SQLite wipe-on-corrupt (the silent queue-loss half) is **fail-closed** in the first Node topology — see Finding F2. |
| 3 | `pushSeq` allocate-then-drop + overlapping `handlePush` + 30s foreground gate | `overlapping-handle-push-seq-toc-tou`, `mqtt-http-independent-fault-domains` | PushSeq race + HTTP heal are present. The third sequence space and isolate-local **checkpoint** remake live only in deferred `three-seq-spaces-unconflated` — see F1. |
| 4 | Outbox unlocked claim + cron skip-notify | `outbox-handler-at-most-once`, `outbox-processed-without-notify` | Matches the two named messy states. Exhausted park `available_at + 365d` is called out in evidence as a *different* hole and has no card — see F3. |
| 5 | OAuth double-consume; revoke/expire/`upgrade_required` wipe; returning-user file switch | `oauth-exchange-code-consumed-once`, `upgrade-required-no-local-wipe`, `unclassified-401-defaults-expired`, `account-switch-close-then-open-sqlite`, `mutation-actor-from-session-only` | Strong on wipe policy and consume-once. SUT messy state “Google code consumed, attach failed — user exists, client has no session” is explicitly **out of scope** in the OAuth evidence file — see F4. Token-refresh → queue drain is a claimed liveness with no card — see F5. |
| 6 | Room: gateway fallback; hibernation restore; commandId storm; DO alarm vs wall clock | `room-gateway-fallback-not-host`, `room-command-id-applies-once`, `room-single-log-per-topic`, `room-welcome-truncation-resync`, `sync-membership-and-room-seat-agree` | Gateway + commandId + cross-plane seats are representable. Hibernation, DO alarm, and dual-process split-brain are **outside this topology** (in-process `RoomServer` in `api`). `room-single-log-per-topic` is Unreachable by construction — see F6. |
| 7 | Health-OK while DB / EMQX / boot are dead | `health-ok-db-down-opens-gate`, `health-200-while-boot-fatal` | DB-down and fatal-boot lies are covered. EMQX-down + health 200 is listed in SUT #7 but is the *correct* split if HTTP is the truth path (`mqtt-http-independent-fault-domains`). Not a missing safety card. Hang-without-timeout is in-scope for health-ok; a bounded connect-settle card is deferred (`postgres-per-request-connect-settles`). |
| 8 | Schema/index crash-safety under traffic | `schema-epoch-preserves-durable-queue`, `mixed-schema-column-intersect-merge`; deferred `lagging-client-schema-catchup`, `sqlite-version-probe-failure-is-not-postgres` | SUT marks this secondary and “already well pinned in-sim.” Light first-pass is consistent. Five documented `db-schema` planner bugs stay out of the campaign — accepted deprioritization, not a blind spot of the same class as #1–7. |

### Claimed liveness (SUT `[liveness]`) vs Type mix

| Claim | Where it landed |
|---|---|
| Missed notify / lost push heals via foreground reconcile | `mqtt-http-independent-fault-domains`, `outbox-processed-without-notify` |
| Durable queue eventually uploads once origin+auth are good | Folded into mqtt-http “domain rows vs server after HTTP heal” and health-ok “when DB returns, queue drains.” No standalone card. Adequate *if* auth is valid. |
| Topic subscribe waits until local queue drains | **No property** |
| `paintReady` is not hydration | Correctly deferred (`paint-ready-before-first-sync`) |
| MQTT reconnect / 600s / overflow | Covered as “HTTP still converges” (mqtt-http), not as MQTT delivery liveness |
| Outbox 8 attempts then park +1 year | **No property.** SUT says this is *not* unbounded eventual delivery. |
| Room `sync(fromSeq)` after reconnect | Partial: `room-welcome-truncation-resync` is “do not `setSynced` early,” not “eventually catch the tip after kill mid-welcome” |
| Expired token refreshes; queued mutations then drain | **No property** (F5) |
| Anon ensure retries on `HttpNetworkError` | **No property** |

Three Liveness-typed cards in a 31-property first pass, and one of the three High cards, is a real mix problem: the catalog’s Type column is a safety portfolio. Several SUT liveness claims are either implied by mqtt-http or absent.

### Product worst-failures (SUT `[product]`)

SUT names four “confirmed success then later contradiction” failures:

| User-visible contradiction | Catalog |
|---|---|
| Left but still seated | `sync-membership-and-room-seat-agree` (Medium) |
| Friends but cannot join | `private-space-join-requires-acl` + `concurrent-mutations-noop-lock` (both Medium) |
| Puzzle solved then not | Only via `room-command-id-applies-once` (hash equals fold / commandId once). No card that **sync-plane puzzle stats** agree with the room fold — see F7. |
| Previous anon’s data after Google switch | `account-switch-close-then-open-sqlite` (Medium) |

Three of four have a dedicated social/identity card. Chess is the ranked play workflow and a named worst-failure, but it has no first-class property of its own.

### Quiet / undertested packages (SUT `[bugs]`)

| Area | Catalog |
|---|---|
| `libs/friends` graph | Uniqueness + private-join ACL only. Accept / decline / cancel / remove / block under partition are not cards. Post-heal friends rows are implied by `multi-device-same-actor-converge` if the workload writes them. |
| Profile | Username wipe via `lww-merge-no-wipe-clobber` only |
| `client_config` materialize | URL bootstrap only (`emqx-url-hydrates-over-http-without-push`) |
| `@pkgs/auth` (young DST) | OAuth consume + 401 wipe policy; not attach-fail, sign-out-one-session, `upsertExternalAccount` never reassigns, anon mint |
| Billing / matchmaking / TTS / LLM | None — matches topology (503 / no UI) |
| `db-schema` planner, engine bigint | None — secondary / web-native; first topology is Node + Postgres |

### Topology containers vs property weight

```
postgres     — outbox races, OAuth SELECT/DELETE, concurrent mutations, health-ok
emqx         — mqtt-http, overlapping handlePush, emqx-url hydrate
api          — health, boot latch, mutations, OAuth, room gateway, outbox, protocol cut
client-alice / client-bob — LWW, device-private, multi-device, MEMORY journal, account-switch, wipe policy, schema epoch
workload     — driver
RoomServer   — in-process inside api (not a container)
```

Distribution is not “all assertions on one service.” It *is* concentrated on sync-engine + two SQLite clients, which matches SUT #1–3 and the topology principle (HTTP, MQTT, Postgres, client SQLite as separate fault domains).

Two topology-vs-set tensions:

1. **Two clients, two identity regimes.** Topology: “alice/bob = second device / second account. No third client.” LWW / device-private / multi-device need **same `actorId`**. Friends ACL / private join need **two accounts**. Account-switch needs a returning-user id. One timeline cannot be all three without mid-run identity rewrite (which is itself `account-switch`). The SET assumes all three; the topology refuses the extra replica that would make them simultaneous — see F8.
2. **Room High properties vs in-process room.** SUT said “room as a second process only if room properties are in the first catalog.” The catalog put two room slugs in High, then topology folded RoomServer into `api` and deferred independent room kill. Gateway fallback (pause Postgres during WS upgrade) and in-process commandId still work. Hibernation / DO alarm / dual-writer do not — see F6.

**Topology-blocked Medium cards still in the first-pass count:** `web-sync-owner-single-uploader` (explicitly “Not in the first Node topology”). `room-single-log-per-topic` split-brain half is Unreachable. These inflate Medium without first-campaign search value.

---

## Findings

### F1 — Checkpoint / three-seq is SUT #3, but only a deferred card

- **Property/Properties:** catalog-wide; deferred `three-seq-spaces-unconflated`; first-pass `overlapping-handle-push-seq-toc-tou`, `mqtt-http-independent-fault-domains`
- **Concern:** SUT serialization table and `[concurrency]` call out three unconflated spaces (scope checkpoint, topic `pushSeq`, client mutation `seq`) and an **isolate-local** checkpoint allocator that remints on process remake. First-pass covers pushSeq TOCTOU and “HTTP heals a gap.” It does not cover “api kill remints checkpoints below every client’s `last_checkpoint` → every later snapshot looks stale.” That fault is unique to this topology (process kill of `api`); the in-house sim keeps one `createSyncApp` for the world lifetime (evidence file). Deferring the card because “needs SUT-side seq probes” leaves a high-risk, Antithesis-shaped hole in the *set*, not just in instrumentation.
- **Scope:** Catalog-wide
- **Evidence:** SUT `[architecture]` three-sequence table; `[concurrency]` “Checkpoint allocator is isolate-local”; `properties/three-seq-spaces-unconflated.md` failure scenario 3; catalog deferred table “Port after SDK lands.”
- **Suggested action:** Promote a checkpoint-regression / three-seq Always into the first-pass set (workload can compare column *magnitudes* even without SDK probes), or explicitly accept that isolate remake freeze is out of campaign 1.

### F2 — MEMORY-journal High card’s user-visible half is fail-closed

- **Property/Properties:** `memory-journal-crash-wipes-queue`
- **Concern:** SUT #2 and A11 care about web SQLite wipe-on-corrupt deleting the identity file (pending queue gone, no rejection inbox). Catalog High invariant: first topology is MEMORY journal **yes**, web SQLite auto-wipe **no** (fail-closed). Search will mostly check “Node must not serve torn pages.” The silent-loss outcome that makes this High is not in the VM.
- **Scope:** Property-specific (also set-composition: a High slot that cannot fire its worst Sometimes)
- **Evidence:** Catalog invariant line; topology open question on bun/better-sqlite3 vs the web SQLite impl; SUT `[failure]` MEMORY + wipe-on-corrupt.
- **Suggested action:** Keep the Node torn-page Always, but do not treat this High as covering web SQLite queue wipe until the client image uses the wipe path — or drop the web SQLite Sometimes from campaign-1 expectations.

### F3 — Outbox park +365d is a named SUT messy state with no card

- **Property/Properties:** catalog-wide; adjacent `outbox-processed-without-notify`, `outbox-handler-at-most-once`
- **Concern:** SUT `[liveness]` “8 attempts, then park `available_at` + 1 year. Not unbounded eventual delivery” and `[failure]` “Exhausted outbox parked +365d — silent.” Outbox evidence says a *failed* handler park is a different silent hole from processed-without-notify. The first-pass pair tests exclusive drain and snapshot heal after *successful* process. Recipients of a delivery that exhausted and parked have no Sometimes/Always that (a) park is reachable and (b) HTTP snapshot still heals the domain row — or that park is an accepted permanent miss.
- **Scope:** Catalog-wide
- **Evidence:** SUT lines 180, 236; `properties/outbox-processed-without-notify.md` “Exhausted deliveries park… a *failed* handler is a different silent hole.”
- **Suggested action:** Add a liveness-or-non-guarantee card for exhausted park, or record in the catalog that park is an accepted silent miss (so synthesizers do not treat it as covered by outbox-processed).

### F4 — OAuth consume-once leaves the attach-failed messy state uncovered

- **Property/Properties:** `oauth-exchange-code-consumed-once`; catalog-wide auth
- **Concern:** SUT `[failure]` lists two OAuth messy states. The catalog High card is the first (double session). Evidence investigation log: lost HTTP 200 after consume → row gone, retry `invalid_code`, **client has no token**, user row exists. That is consume-once *working*, and it is the second SUT messy state. No liveness/recovery card (restart-OAuth eventually yields a session; no orphan user without a client session that the workload still treats as signed-in).
- **Scope:** Catalog-wide (auth lifecycle)
- **Evidence:** SUT line 239; `properties/oauth-exchange-code-consumed-once.md` “Lost-ack after a successful consume is a different shape.”
- **Suggested action:** Add a recovery/liveness property for consume-success + client-without-session, or mark attach-fail as explicitly out of campaign 1 next to the OAuth card.

### F5 — Token-refresh → drain is claimed liveness, clock-jump-ready, and missing

- **Property/Properties:** catalog-wide
- **Concern:** SUT `[liveness]` “Expired token refreshes; queued mutations then drain.” A14: partition during the 4s refresh. Topology: clock jump hits “OAuth TTL, 4s token refresh.” `unclassified-401` uses “expire the 4s refresh race” only as a *wipe-classification* angle. mqtt-http’s precondition is “a client that can reach POST /query and /mutations” — false while the bearer is expired. Auth TTL + partition is a cross-cut (auth session + upload queue) that discovery often drops between focuses.
- **Scope:** Catalog-wide
- **Evidence:** SUT `[liveness]`, A14; topology “Faults this topology can see” clock-jump list; no slug for refresh-then-drain.
- **Suggested action:** Add a Liveness card: after bearer expiry or clock jump past TTL, a successful refresh is followed by queue drain, and expired 401s do not wipe (`unclassified-401` already covers the wipe half).

### F6 — Room High set vs in-process topology: SUT #6 is only half-representable

- **Property/Properties:** `room-gateway-fallback-not-host`, `room-command-id-applies-once`, `room-single-log-per-topic`, `room-welcome-truncation-resync`; deferred `presence-online-matches-room-actor-id`
- **Concern:** Five first-pass room/cross-plane cards (two High) against a topology that cannot independently kill a room process, evict a Durable Object, or fire DO `alarm()` vs wall clock. `room-command-id` Antithesis angle cites “Hibernation refolds the log but does not rebuild missing dedup” — that path is not in the VM. `room-single-log-per-topic` “Always at most one live room process” is Unreachable in the first single-writer topology (catalog says so). Gateway fallback and membership/seat still earn their keep. The *set* over-indexes room persistence/split-brain relative to what the planned containers can search.
- **Scope:** Catalog-wide
- **Evidence:** SUT failure-prone #6; topology “No separate room container”; catalog `room-single-log` Antithesis angle; `room-command-id` hibernation sentence.
- **Suggested action:** Keep gateway + commandId (reconnect/take-over without claiming DO hibernation) + seats. Treat split-brain and hibernation as a later dual-process/DO variant. Do not spend first-campaign budget asserting Unreachable dual-process.

### F7 — Only one cross-plane agreement card; chess play has none

- **Property/Properties:** `sync-membership-and-room-seat-agree`; catalog-wide
- **Concern:** SUT `[wildcard]` “Two merge theories” and `[product]` “puzzle solved then not.” The catalog has exactly one cross-plane Always (seats vs `spaces_users`). Chess puzzle *stats* are synced domain mutations (`append-puzzle-interaction`, `upsert-puzzle-profile`); live play is the room module. A room fold that says solved while SQLite puzzle stats say not (or the reverse after LWW heal) is the named contradiction and is not a property. Room commandId prevents *double-apply* of one command; it does not bind the two stores.
- **Scope:** Catalog-wide
- **Evidence:** SUT `[product]` worst-failures; `properties/mutation-actor-from-session-only.md` chess mutation table; `properties/room-gateway-fallback-not-host.md` chess host/reclaim; no slug for stats vs fold.
- **Suggested action:** Add a post-quiescence Always: for a space that ran puzzle play, durable chess tables vs room fold agree on “solved / current puzzle” after HTTP heal + room sync — or drop “puzzle solved then not” from the campaign’s user-visible targets.

### F8 — Two-client topology cannot host the isolation + friends + LWW set at once

- **Property/Properties:** `lww-upload-arrival-under-partition`, `multi-device-same-actor-converge`, `device-private-rows-stay-local`, `private-space-join-requires-acl`, `concurrent-mutations-noop-lock`, `account-switch-close-then-open-sqlite`
- **Concern:** The first-pass SET requires same-actor two-device, two-account friend pair, and returning-user file switch. Topology: two clients, “Add a third only if a later property needs it.” The catalog already needs it if those properties are meant to be co-active. Workload role-switching mid-timeline is possible but then *is* account-switch and destroys the prior same-actor pair.
- **Scope:** Catalog-wide (set vs topology)
- **Evidence:** Topology “Why not fewer / No third client”; catalog assumptions “two SQLite clients”; relationship clusters Isolation vs Room identity vs LWW.
- **Suggested action:** Either add a third client, or split the first campaign into persona templates (same-actor vs friend-pair vs switch) and stop presenting the Medium band as one simultaneous portfolio.

### F9 — Safety-heavy Type mix; several SUT liveness claims have no home

- **Property/Properties:** catalog-wide
- **Concern:** 28 Safety / 3 Liveness / 0 Reachability-typed in the first pass. Embedded `Reachable` clauses on Safety cards (duplicate replay, deny branch, overlapping handlePush, OAuth double-POST, double outbox SELECT) are good search hints *if* the SDK is added. They do not replace missing *liveness* cards: refresh-then-drain (F5), attach-fail recovery (F4), outbox park (F3), `upgrade_required` retry-forever (evidence on `upgrade-required-no-local-wipe`: no upgrade UI, uploads keep retrying — scoped out of that safety card), topic-subscribe-waits-for-queue-drain, room “eventually at tip after reconnect.” Deferred list is where hang/resource liveness went (`postgres-per-request-connect-settles`, `emqx-publish-wait-until-connected-settles`). Campaign 1 will search for “bad thing never” far more than “good thing eventually,” which is a poor match for a system whose stated repair is 30s reconcile + backoff.
- **Scope:** Catalog-wide
- **Evidence:** Catalog Type fields (29 first-pass cards); deferred table; SUT `[liveness]` (no SLO, but several eventual claims); upgrade-required evidence “uploads keep retrying.”
- **Suggested action:** Keep the High safety core. Add 2–3 first-pass Liveness cards from F3–F5 / upgrade_required-bounded-retry so the set matches the repair story. Do not add a Reachability-*typed* property just to balance the column if Reachable clauses already name the rare paths — but do not defer three-seq Reachable (F1) solely for lack of SDK.

### F10 — Write-rejection fate and optimistic-ack flicker are claimed safeties with no card

- **Property/Properties:** catalog-wide; adjacent `tombstone-sync-and-pending-revive`, `mutation-id-first-wins-ack-applied`
- **Concern:** SUT `[safety]` “rejected ids not queued” and “optimistic body must not flicker after own ack.” Product: write rejections have **no inbox**. Tombstone evidence: reject stores `sync_engine_write_rejections` and does not revert domain. That is not “rejected id stays rejected and is not retried forever” and not “UI/row image does not flicker after ack.” Both are user-visible contradiction class (local success then server reject; own MQTT echo after ack).
- **Scope:** Catalog-wide
- **Evidence:** SUT `[safety]`, `[product]` “Write rejections have no product inbox”; `properties/tombstone-sync-and-pending-revive.md` reject path; no flicker slug.
- **Suggested action:** Decide whether rejection durability / no-requue and post-ack flicker are campaign-1 (they are Antithesis-shaped under partition) or accepted as sim-pinned only.

### F11 — Friends graph and anon/identity mint are component blind spots

- **Property/Properties:** `private-space-join-requires-acl`, `concurrent-mutations-noop-lock`, `mutation-actor-from-session-only`; catalog-wide
- **Concern:** SUT `[bugs]` flags `libs/friends` as quiet (no bugs-found). Ranked workflow includes friends + search and cold-start anon mint (`POST /identity/anon/ensure`). The set tests friend-request uniqueness and private-join ACL — the “friends but cannot join” slice — not the rest of the graph under partition, not `POST /friends/search` leakage, not anon-ensure idempotency / retry (SUT liveness). `mutation-actor` evidence notes anon-ensure `userId` is a **separate mint path** and excludes it from the session-only invariant.
- **Scope:** Catalog-wide
- **Evidence:** SUT `[bugs]` quiet list, `[product]` workflows, request map; `properties/mutation-actor-from-session-only.md` anon-ensure table.
- **Suggested action:** If campaign 1 is “sync core + two social contradictions,” the current friends slice is enough. If the SUT quiet-package list was meant to pull discovery, add graph-convergence and/or anon-ensure idempotency. Do not assume `multi-device-same-actor-converge` exercises friends unless the workload writes those tables.

### F12 — Medium band includes topology-blocked weight

- **Property/Properties:** `web-sync-owner-single-uploader`, `room-single-log-per-topic`
- **Concern:** Overview “Medium 17” already under-counts. Two of the real 19 Medium cards cannot fire their interesting branch on the first topology (Web Locks/OPFS; dual room process). That is over-investment *in the first-pass portfolio listing*, not in risk (web hung-owner and split-brain are real). They dilute “what the first workload must implement.”
- **Scope:** Catalog-wide
- **Evidence:** Catalog `web-sync-owner` “Not in the first Node topology”; `room-single-log` “Dual-process variant deferred”; topology “Web Locks / OPFS are not in this Node topology.”
- **Suggested action:** Move both to the deferred table (evidence stays) so Medium means “same topology, second wave.”

---

## Passes

- **SUT #1 density is justified.** Seven merge/fanout/isolation cards match the confirmed wipe/clobber / same-account pin cluster. Relationships correctly refuse to collapse wipe into arrival-order.
- **SUT #2, #4, #7 have the right number of first-pass cards** (idempotency + MEMORY; outbox safety+liveness pair; two distinct health lies). EMQX-down is correctly *not* a third health-lie card.
- **SUT #8 is correctly light.** Epoch-preserve + mixed-schema + deferred lagging-client matches “secondary, well pinned.”
- **Matchmaking / billing / TTS / object-store / MinIO omitted.** Matches topology and unshipped UI. Not a blind spot.
- **MQTT-is-lossy is the coordination story.** One High Liveness (`mqtt-http-independent-fault-domains`) plus overlapping handlePush plus outbox-processed-without-notify is the right shape for “no Raft.”
- **Auth wipe policy is split correctly.** `upgrade_required` vs malformed 401 vs `revoked` are three cards; product `isAuthRevoked === reason === 'revoked'` is the shared predicate (relationships).
- **`paintReady` non-guarantee was not promoted to Always.** Deferred Sometimes-only is the right set decision.
- **Device-private kept beside multi-device converge.** Relationships’ anti-dominance note is a coverage pass: converge-only could hide a leaked session row both devices “agree” on.
- **No SDK is acknowledged.** Catalog and existing-assertions agree every Invariant is missing instrumentation; the set does not pretend production assertions exist.
- **Optional `bufferOutboundLive` / dialect probe / hasher integer keys** sit on the deferred table instead of burning first-pass slots. Correct relative to risk.

---

## Uncertainties

- **Whether isolate remake of `createSyncApp` is in the first `api` image.** If setup persists checkpoint high-water across process restart, F1’s freeze scenario shrinks. Evidence says product does not pass `initialLast`; setup is not written yet.
- **In-process RoomServer storage durability.** If room KV is memory-only, `room-command-id` kill-between-append-and-dedup is meaningless (whole log dies with `api`). If it is a file next to the process, reconnect-after-kill is closer to DO eviction. Topology does not specify. Affects how much of F6 is “blocked” vs “degraded.”
- **Workload persona plan.** F8 is a set problem only if one test template tries to hold all Medium cards. A serial_driver that re-roles alice/bob per command would cover the SET sequentially. That plan is not in the catalog or topology.
- **Friends/chess tables on the converge Always.** `multi-device-same-actor-converge` says “user-scoped rows match server.” If that includes friends + chess stats, F7/F11 shrink for the *heal* case and remain open only mid-fault.
- **Web SQLite MEMORY journal on the client image.** Topology open question. F2 depends on engine choice.
- **Process-fault + clock-fault availability** (catalog-wide open question). F1, F2, F5, and health-ok hang all assume those faults exist on the tenant.
- **Uncommitted tree vs HEAD `ddde94d`.** SUT notes working-tree auth/db-indexes/sync-notify work. This evaluation did not re-scan those diffs for new risk areas.
- **Overview Medium count (17 vs 19).** Clerical; does not change the set, but any downstream “second wave is 17 cards” plan is off by two.

## Assumptions

- Evaluated the catalog *set* against SUT + topology only; did not re-score individual Antithesis-fit or implementability except where set-vs-topology made a property unsearchable.
- Deferred slugs are “evidence on disk, not first-pass portfolio” per the catalog — they count as known and parked, not as coverage of campaign 1.
- “Just this directory”; no issues or external design notes.
