# Room

`Room` is the multiplayer coordination layer for a single game/topic.

Its job is simple: let peers issue commands, converge on the same event history, and derive the same game state without depending on a central authority as the source of truth.

## Why this exists

Gamezilla is local-first and append-only. Players should be able to keep moving even with unstable connectivity, then converge safely when connected.

`Room` exists to provide:

- a shared event history peers can agree on
- deterministic state convergence from that history
- optimistic local UX while network coordination happens
- automatic peer membership and authority handoff for liveness

## What it guarantees

- **Deterministic convergence**: same committed events produce the same state.
- **Append-only history**: state is derived from events, not mutable shared memory.
- **Optimistic-first interaction**: local peers can render immediately, then finalize.
- **Coordination, not ownership**: authority helps sequence decisions, but is not the data owner.
- **Resilience**: peers can reconnect, sync, and recover to a consistent view.

## Mental model

Think of `Room` as a referee for agreement, not a game engine.

- Your game module defines business rules.
- `Room` handles peer coordination and convergence.
- The committed event history is the contract between peers.

## When to use it

Use `Room` when you need multiplayer state that is:

- event-driven
- deterministic
- tolerant of temporary disconnects
- safe under changing peer availability

If your feature is single-player/local-only with no peer coordination, this layer is likely unnecessary.

## Design principles

- **Local-first**: user actions should not block on round trips.
- **Fail loud**: broken invariants should surface immediately.
- **Explicit over implicit**: predictable flow beats hidden magic.
- **Peer, never authority**: coordinators help agreement; they do not become truth.

## Public API (v2)

### Package entrypoints

| Import                        | Purpose                                                                |
| ----------------------------- | ---------------------------------------------------------------------- |
| `@gamezilla/room`             | `Room`, persistence, transport, replay helpers, curated room errors    |
| `@gamezilla/room/types`       | UI-only: `Event`, `Message`, `RoomError`, `State`                      |
| `@gamezilla/room/utils`       | `isSystemEvent`, ids                                                   |
| `@gamezilla/room/simulator`   | `DeterministicSimulator`                                               |
| `@gamezilla/room/trust`       | Standalone `TrustElection` / `computeTrustMap` (not wired into `Room`) |
| `@gamezilla/room/room-errors` | Same symbols as root error re-exports                                  |

### Config: `RoomConfig` (single object)

- **`module`** — the `RoomModule` (reducer + command handler).
- **`peerId` is derived** from `secretSeed` (self-certifying identity). You do not pass `peerId` separately.
- **`role.type: 'host'`** — supply `initialMembership` and `initialMemberPublicKeys` for everyone in the genesis room (≥ 2 peers). The host’s seed must correspond to one of those member ids.
- **`role.type: 'join'`** — supply `roomSnapshot` with genesis membership + keys **before** this peer appears in the log.
- **`persistence`** — required `RoomPersistence` port; the room appends a write-ahead log partitioned by **`topic`**. Use `InMemoryRoomPersistence` in tests; use SQLite/Postgres implementations in production.
- **Lifecycle callbacks** — optional fields on the same object (`onCommit`, `onReject`, `onTimeout`, …).
- **`onUnresolvedPersistenceCommand`** — optional; used only by **`Room.create`** when replaying the journal (command rows with no outcome).
- **`Room.open(config)`** — sync construction without loading the journal (typical for tests / in-memory simulators).
- **`Room.create(config)`** — async: `open` + `recoverRoomFromPersistence`.
- **Trust weights** change only via replicated log commands (`PeerTrustUpdate` / authority-driven updates), not via a background election inside `Room`.

`RoomConfigCore` is the room/transport/persistence slice (no `module` or callbacks).

Use `normalizeRoomInit()` on a **`RoomConfigCore`** if you validate room fields before attaching `module` / callbacks.

### Migration from pre-v2

- **Removed** legacy init config (explicit `peerId` + `bootstrap` + `security`). Use `RoomConfig`: `roomSecret`, `secretSeed`, `role: { type: 'host' | 'join', ... }`.
- **Removed** automatic in-process trust elections (`autoTrustElection`, `trustElectionTimeoutMs`, `authorityStrategy`). For custom alignment, import `@gamezilla/room/trust` and drive `PeerTrustUpdate` through the log yourself, or extend in app code.
- **Room errors**: shape vs field failures for join/leave/trust are merged into `RoomJoinInvalid`, `RoomLeaveInvalid`, `RoomTrustInvalid` (check `detail`).

## Wire security (production posture)

`Room` wire traffic is **signed** (Ed25519) and bound to a **match-scoped room secret** plus the room topic. Each peer’s `peerId` is **self-certifying** (derived from its public key). Join commands must carry the joining peer’s public key and must match the claimed `peerId`.

### What this defends against

- **Spoofed sender / forged `peerId`**: unsigned or wrongly signed messages are dropped before any state transition.
- **Replay**: a per-signer monotonic counter is enforced for inbound wire messages; counters are persisted with durable state.
- **Non-authority commits**: `accepted`, `rejected`, and `sync-response` must verify as the **current authority** signer and (for sync) match a **pending sync session** opened by this replica.

### Bootstrap & trust (pure P2P)

- **Room secret**: all peers in a match must agree on the same secret out-of-band (QR, voice, lobby server, etc.). Without it, signatures will not verify.
- **Optional fingerprints**: callers may require peer key fingerprints at session start. Pass `peerFingerprints` on the room config.
- **Join**: `role: { type: 'join', roomSnapshot: { initialMembership, initialMemberPublicKeys } }` pins the room’s genesis trust + keys so wire traffic verifies before the first `sync-response`. New members send `PeerJoin` **after** initial sync (the simulator’s `joinPeer` waits for this). `sync-request` / `heartbeat` accept any self-certifying signer (room secret + replay limits still apply) so a joiner can sync before appearing in the log.

### Standalone trust election

`TrustElection` (see `@gamezilla/room/trust`) is **not** started by `Room`. Use it only if you build your own coordination on top of the same transport.

### Transport contract

`Transport.subscribe` may pass an optional **`TransportMessageContext`** (e.g. `senderMeta` from a non-broadcast link). The in-memory bus passes `undefined`; **verification still happens in `Room`** so broadcast transports remain safe when envelopes are used.

### Residual risks (money matches / high stakes)

- **Endpoint compromise**: malware on a device can sign arbitrary valid messages as that peer.
- **Room secret leak**: anyone with the secret can produce valid wire traffic for that match.
- **Colluding quorum**: authority + majority trust can still behave badly at the application layer—crypto does not prove honesty.
- **MITM on a shared broadcast bus**: if an attacker can mutate bytes _after_ a peer publishes but _before_ others receive, followers may reject tampered commits while the publisher already applied locally—treat optimistic local application as UX, not cross-peer safety unless you add stricter commit gating.

See tests under `src/testkit/cheating.test.ts` and `src/trust/election.test.ts` for adversarial coverage.
