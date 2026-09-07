---
sut_path: /Users/chrisvouga/gamezilla
commit: ddde94db466ae77df20385c54ead0c79ae20b2c8
updated: 2026-09-01
external_references: []
---

# Wildcard evaluation

Other lenses (not repeated here): **Antithesis Fit** — sweet spot vs unit/integration; **Coverage Balance** — right set vs SUT analysis and topology; **Implementability** — can it be checked given the planned containers.

This pass looks for framing problems, missing perspectives, cross-cuts (high-value but infeasible as written), and catalog smells.

Inputs: `property-catalog.md`, `sut-analysis.md`, `deployment-topology.md`, `existing-assertions.md`, `property-relationships.md` (all at `ddde94db466ae77df20385c54ead0c79ae20b2c8`), plus evidence files cited below. Catalog/relationships frontmatter was briefly `b2cd713c…` when this lens ran; synthesis aligned them.

---

## Framing problems

### F1. The catalog is a pin-port folio, not a product-failure folio

SUT analysis ranks user workflows (cold start → Google file-switch → offline mutations → spaces → **chess puzzles in a space** → isolation → friends → notifications → profile) and names the worst user-visible class as **confirmed success then later contradiction**: left but still seated; friends but cannot join; **puzzle solved then not**; previous anon’s data after Google switch.

The catalog’s High band is organized the way discovery found evidence: LWW upsert, `pushSeq` TOCTOU, mutation-id, MEMORY journal, MQTT-vs-HTTP, protocol-cut wipe, OAuth consume, room `commandId`, outbox claim, health-lie. Those are real. They are also **framework-shaped**. The product’s only game never appears in a catalog title, Why-It-Matters, or cluster name. Chess shows up in evidence (`room-gateway-fallback-not-host`, `sync-membership-and-room-seat-agree`) as a host-string example, not as a solve/spectate invariant.

`sut-analysis.md` already warned about this religion in `[wildcard]`: the in-house sim looks like Antithesis and can create false confidence; `max` fidelity **drops** the faults the fake tier injects. Catalog Assumptions then say “In-tree sim pins are oracles to port.” That sentence accepts the frame the SUT analysis asked to question. Porting settle-then-check oracles as `Always` after HTTP heal recreates the PBT postcondition, not the mid-fault `never` pins the analysis said are the unique value.

### F2. First topology silently changes the room durability contract

Production room state lives in Durable Object SQLite (`room.do.v3.*` event keys vs `.d.` dedup keys). The planned `api` container runs in-process `createRoomServer` (`deployment-topology.md`; `apps/room-server/src/app/create-room-server.ts` constructs `InMemoryRoomStorage`).

`InMemoryRoomStorage.appendCommittedEntries` and `putDedupOutcome` are two heap maps. They are not two durable KV puts. **SIGKILL of `api` drops the entire log, seats, and puzzle session.** Topology “must enable process faults” for mutation lost-ack and MEMORY-journal — the same faults erase live play.

`room-command-id-applies-once` (High) is written against the DO crash window (append persisted, dedup missing, hibernation refolds the log). That window does not exist in the first topology: kill loses both maps together; a remade process starts empty. Clients that reconnect get a new welcome from seq 0. That is exactly “puzzle solved then not,” and no catalog property states it — because the property is framed as commandId idempotency, not as “the game survives the faults we intend to inject.”

`room-single-log-per-topic` already admits split-brain is `Unreachable` in the first single-writer topology. The deeper frame issue: **the first topology cannot distinguish “commandId applied once” from “the room never survived a kill.”**

### F3. Identity collapse is the SUT’s own wildcard — the catalog deferred it as a naming overlap

`sut-analysis.md` `[wildcard]`: `accountId === userId`; sync `clientId === deviceId`; presence has used `profileId={deviceId}`; room actor can become the install id on a DB hiccup during WS upgrade; room `clientId` is a per-tab UUID.

The catalog has a full evidence file for this (`presence-online-matches-room-actor-id`) and then defers it: “Naming bug; overlaps gateway fallback.” That is the wrong merge. `room-gateway-fallback-not-host` is **privilege** (who may pass host-gated commands). Presence is **naming** (online / You / Runtime badges key a different id than the socket). Relationships put both in “Room identity vs social membership” and then the catalog drops the naming half from the first-pass table.

A reader of Coverage Balance could honestly say “identity is covered by gateway + seats-agree.” The user-visible failure the SUT analysis named (“You” off while still in the puzzle room) is the deferred file.

### F4. Headless Node clients vs web product

Topology clients are `createClient` + bun/better-sqlite3. Product is web. Several High/Medium properties are Worker-isolate-shaped:

| Property | Written against | First topology actually is |
|---|---|---|
| `memory-journal-crash-wipes-queue` | web SQLite wipe-on-corrupt deletes the identity file | Node engines fail-closed; no auto-wipe (evidence already splits this) |
| `health-200-while-boot-fatal` | CF Worker isolate latch, overlapping `ensureApp` | One Node process; isolate remake ≠ process remake |
| `upgrade-required-no-local-wipe` | Lagging binary / host that treats every `error: 'auth'` as revoke | Same headless image; workload forges `x-sync-protocol: 2` |
| `web-sync-owner-single-uploader` | Chromium Web Locks / OPFS | Explicitly not in topology, but still **Medium** in the “same topology, second wave” bucket |

The catalog knows most of this in footnotes. The **frame** still presents 12 High properties as the first workload on this topology.

### F5. `Always` after heal is the sim’s settle religion

High liveness/safety checks are repeatedly “after HTTP heal + foreground refetch / reconcile,” not “a replica must not look caught-up on a gapped push.” The latter exists (`overlapping-handle-push-seq-toc-tou`, `stale-push-images-after-snapshot-merge`). The former dominates Why-It-Matters (“username gone,” “confirmed-then-contradicted”).

That is a coherent product safety story **if** the user is foregrounded and the 30s tick runs. SUT analysis: sweeps pause while backgrounded; `notificationsActive` is a session query; product is a mobile app. The catalog treats foreground as a **precondition for the oracle**, not as a usage pattern to explore. A timeline that keeps both clients focused so `Always` after heal can fire will not represent “user backgrounds during partition,” which is the default web life.

---

## Missing angles

### A1. Puzzle solve lives on one plane; the catalog never says so

`appendPuzzleInteractionMutation` is registered in `libs/chess/src/root/mutations.ts` and has **no client/use-case hook and no other call site** in the tree (only the mutation def + registry). Live “solved” is room `ChessPuzzlePlay` status (`solved-monotonic.sim.test.ts`). Durable `chess_puzzle_interactions` is a sync table waiting for a writer.

So “puzzle solved then not” is not LWW clobber of a stats row. It is room-log revert: welcome truncation (`room-welcome-truncation-resync`, Medium), commandId double-apply (High, but see F2), gateway demotion so the host cannot move (`room-gateway-fallback-not-host`), or **api kill wiping in-memory storage** (unstated). The catalog never writes an invariant of the form: after a `solved` status was committed, a later welcome/fold/reconnect must not present `idle`/`playing` for that puzzle without a new `Start`.

That is a different perspective from “commandId applies once.” Idempotency can pass while the remade empty log looks like a new game.

### A2. Write rejection is a confirmed-success lie with no product surface

SUT analysis: write rejections have **no product inbox**. Framework has `sync_engine_write_rejections`, `listUnackedWriteRejections`, and `acknowledgeWriteRejectionMutation`. Grep under `libs/` finds no product UI or hook. `tombstone-sync-and-pending-revive` correctly says reject does not revert domain — the next snapshot does.

Missing perspective: **local `mutate()` success + permanent server reject + no inbox** is the product-shaped “confirmed then contradicted,” and it is foreground-gated the same way notify heal is. The catalog tests tombstone/revive mechanics, not “a rejected write remains painted as success until a snapshot the backgrounded client may never take.”

### A3. OAuth consume-once *creates* the orphan the SUT analysis named

`oauth-exchange-code-consumed-once` (High) is “at most one session per code.” Evidence file already records the complement: lost HTTP 200 after consume → retry is `invalid_code` → client has no token; recovery is restart OAuth. SUT analysis failure mode: “Google code consumed, attach failed — user exists, client has no session.”

The catalog tested the safety half and treated the liveness half as “working as intended.” The user-visible hole is the liveness half. Fake Google in the topology can still lose the session 200.

### A4. `upgrade_required` livelock

`upgrade-required-no-local-wipe` evidence: no product upgrade UI; `handleError` sets `online: false`; uploads keep retrying. Catalog property is “do not delete the file.” The operational failure under a permanent protocol cut (or a workload that keeps sending `x-sync-protocol: 2`) is **unbounded retry of a request that will never succeed**, next to a health-200 origin gate. That is a liveness/resource angle adjacent to `health-ok-db-down-opens-gate`, not a wipe-policy angle.

### A5. API process remake can freeze HTTP snapshots (deferred as “needs probes”)

`three-seq-spaces-unconflated` is deferred: “Strong invariant; needs SUT-side seq probes.” Evidence scenario 3 is not a probe problem. `createMonotonicCheckpoint` is isolate-local; product `createSyncApp` does not pass `initialLast`. Comments in `commit-checkpoint.ts` state the Antithesis case: clock jumped forward, clients stored high checkpoints, process remade with corrected `now()`, new checkpoints compare stale, merge drops every `ok` snapshot until wall clock catches up.

Topology enables clock jump **and** api kill. Reformulation that does not need seq-column probes: **after api restart (optionally after a forward clock jump), a foreground client that can POST `/api/query` eventually applies a snapshot whose domain matches Postgres** — or `Sometimes(checkpoint_freeze)` if every `ok` is `not_modified`/`isStale` while the server has newer rows. That is the same risk as MQTT-vs-HTTP liveness, triggered by process+clock, not by EMQX.

### A6. Own-ack optimistic flicker

Claimed safety (`sut-analysis` [safety]; sync-engine README): optimistic body must not revert to server-old after own ack. In-tree pins exist (`online-mutate-no-optimistic-body-flicker`, `delayed-sync-after-ack-no-optimistic-flicker`). Not in the catalog. Coverage Balance might fold this into LWW/stale-push. The perspective is different: **the writer’s own ack vs a reordered snapshot/echo**, not a peer clobber. Thread pause after ack before merge is the Antithesis move.

### A7. Two clients, four identity pairings

`client-alice` / `client-bob` are justified as “second device / second account” for LWW, device-private, multi-device, friends, and account-switch. Those are different pairings:

- same `actorId`, two `deviceId`s
- two accounts that are friends
- two accounts that are strangers (denied-scope)
- anon → Google file switch (same install, two `users.id` files)

A single timeline cannot be all four without reminting. The catalog writes each property as if alice/bob are whoever that property needs. Missing usage-pattern note: the **workload** must sequence identities, or the first campaign only ever tests one pairing and the others are paper coverage.

### A8. Exactly-once UI is a documented non-guarantee; only `paintReady` got a deferred file

SUT analysis: “exactly-once UI effects are explicitly not provided.” `paint-ready-before-first-sync` was kept as a deferred non-guarantee. The UI-effects non-guarantee has no evidence file. Inconsistent treatment of “document the non-guarantee so a future Always does not get written.”

---

## Cross-cuts (high-value as written, infeasible or misleading on this topology)

### X1. `room-command-id-applies-once` × in-memory room

Fit: kill-between-append-and-dedup is classic Antithesis. Implementability: first topology has no durable split keys. **Reformulation that matches the containers:** either (a) persist room storage on a volume so the DO crash window is real, or (b) drop kill-from-the-angle and keep flood/reconnect/take-over on a live process, plus an explicit **room-ephemeral-on-api-kill** property if that is the accepted contract. As written, a pass can mean “we never killed api during a game.”

### X2. `three-seq-spaces-unconflated` × “needs SDK”

Fit: isolate remake + clock jump is the class sim declines. Implementability: column-level Always on three tables wants SUT probes. **Reformulation:** A5 (domain still moves after api remake). Keep the column Always for an SDK wave; do not defer the user-visible freeze.

### X3. `memory-journal-crash-wipes-queue` × Node fail-closed

Fit: process kill + MEMORY journal is unique vs `preserveLocalDb` sim crashes. Implementability: web SQLite wipe is not in the image. Evidence already splits the property. Catalog still lists it High with Why-It-Matters “web SQLite recovery deletes the identity file.” **Reformulation for wave 1:** Node last-commit-or-fail-closed only; move wipe-empties-queue to an web/OPFS variant next to `web-sync-owner-single-uploader`.

### X4. `presence-online-matches-room-actor-id` × “overlaps gateway”

Fit: demotion under Postgres pause is timing-sensitive. Implementability: headless clients can compare `x-actor-id` to `users.id` and roster keys **without the Solid UI** (evidence already says this). Deferral reason (“naming bug; overlaps gateway”) is a Coverage-Balance merge, not an implementability block. **Keep a workload-visible Always:** account tile online iff gateway actor equals account. That is cheaper than the Solid UI rail and does not duplicate host-privilege.

### X5. `health-200-while-boot-fatal` × Node process

Fit: overlapping boot latch is a real race in the Worker source. Implementability: one Node `createServer` may boot once at process start, not per-isolate `ensureApp`. If setup uses the Worker `handleWorkerFetch` entry, the latch exists; if setup binds Hono after a successful `createServer`, the fatal/pending window never appears. Catalog does not say which entry the Dockerfile will use (`deployment-topology.md` Open Questions: `apps/server` vs `antithesis/` adapter). **Reformulation:** pin the entrypoint, or fold the latch into `health-ok-db-down-opens-gate` (the origin-gate storm) until the Worker fetch wrapper is actually on the container.

---

## Catalog smells

### S1. Provenance drift inside the scratchbook

| Artifact | `commit` |
|---|---|
| All top-level scratchbook files (after synthesis) | `ddde94db466ae77df20385c54ead0c79ae20b2c8` |

This lens originally saw catalog/relationships frontmatter at `b2cd713c…`. Synthesis aligned them. Downstream setup can treat analysis, topology, and catalog as one snapshot.

### S2. “Open Questions: None” on almost every High property

SUT analysis lists A1–A16 unproven assumptions. Catalog-wide open questions are only process-fault availability and SDK vs workload-only. High properties that still have live topology/runtime uncertainty in their evidence (`memory-journal` native MEMORY honor; `room-command-id` hibernation fold vs this topology; `oauth` lost-ack orphan; `upgrade-required` synthetic header vs old binary) show **None** in the catalog list. Evidence investigation logs are richer than the catalog admits. That makes the portfolio look more settled than the tree is.

### S3. Medium means “same topology, second wave” except when it does not

Overview: Medium = “same topology, second wave.” `web-sync-owner-single-uploader` is Medium and “**Not in the first Node topology**.” Assumptions later correctly skip it. The overview table is the lie a workload author will read first.

### S4. Deferred reasons flatten distinct judgments

`presence-online-matches-room-actor-id` deferred as overlap. `three-seq-spaces-unconflated` deferred as instrumentation. `paint-ready-before-first-sync` deferred as non-guarantee. `room-and-sync-canonicalizers-agree-integer-keys` deferred as unit-test territory. Same table, same rhetorical weight. A later pass cannot see which deferrals were “wrong frame,” “blocked,” or “not a bug.”

### S5. Why-It-Matters is often “confirmed pin” not “user sees”

Examples: wipe/clobber cluster, in-tree pin, Acme fixture, `PBT_AUDIT.md`. That is honest provenance. It also steers the first campaign toward re-finding bugs the sim already named, which is the dual-religion trap (F1).

### S6. `alice`/`bob` names hide pairing (see A7)

Relationships talk about “two devices of one actor” and “friend-pair” as if they were the same two containers. They are not simultaneously.

---

## Passes (this lens)

- The catalog is explicit that claims are claims, that no Antithesis SDK exists, and that sim pins are not coverage of this topology. That honesty is load-bearing.
- Dual write planes (LWW vs room log) are separated in the catalog structure; `sync-membership-and-room-seat-agree` is the one cross-plane property and is the right *kind* of thing, even if puzzle-solve is missing.
- MQTT-vs-HTTP as independent fault domains is the correct Antithesis-shaped center of gravity for social state; topology justifies separate `postgres` / `emqx` / `api` / two clients for that center.
- Several evidence files already contain the splits this lens would demand (`memory-journal` Node vs web; `upgrade-required` synthetic header; `oauth` lost-ack orphan; `three-seq` isolate remake). The problem is what the **catalog table** did with those splits (High / None / deferred), not that discovery never looked.
- `existing-assertions.md` correctly treats in-house DST invariants as non-portable. No phantom “already instrumented” claim.

---

## Uncertainties

- Whether setup will wrap `handleWorkerFetch` (isolate latch real) or boot Hono once (latch mostly vacuous). Topology leaves the entry open.
- Whether a later room volume / sqlite adapter is planned before the first campaign. If yes, F2/X1 shrink.
- Whether `appendPuzzleInteraction` is about to be wired (working tree has uncommitted sync/auth work). Today it has no UI caller; “puzzle solved then not” is room-only.
- Whether Antithesis clock faults can jump far enough forward that remade checkpoints stay below client `last_checkpoint` for a timeline-relevant window (checkpoints embed `epochMs`; a +1h jump is plenty; a +few-seconds jump may not).
- Catalog vs analysis SHA: this lens did not bisect product code between the briefly drifted catalog frontmatter and `ddde94db`. Findings assume analysis/topology at that HEAD and the catalog text as read.
