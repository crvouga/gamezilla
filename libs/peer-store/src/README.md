# Peer Store

`PeerStore` is the multiplayer coordination layer for a single game/topic.

Its job is simple: let peers issue commands, converge on the same event history, and derive the same game state without depending on a central authority as the source of truth.

## Why this exists

Gamezilla is local-first and append-only. Players should be able to keep moving even with unstable connectivity, then converge safely when connected.

`PeerStore` exists to provide:

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

Think of `PeerStore` as a referee for agreement, not a game engine.

- Your game module defines business rules.
- `PeerStore` handles peer coordination and convergence.
- The committed event history is the contract between peers.

## When to use it

Use `PeerStore` when you need multiplayer state that is:

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

| Import | Purpose |
|--------|---------|
| `@gamezilla/peer-store` | `PeerStore`, persistence, transport, replay helpers, curated store errors |
| `@gamezilla/peer-store/types` | UI-only: `Event`, `Message`, `StoreError`, `State` |
| `@gamezilla/peer-store/utils` | `isSystemEvent`, ids |
| `@gamezilla/peer-store/simulator` | `DeterministicSimulator` |
| `@gamezilla/peer-store/trust` | Standalone `TrustElection` / `computeTrustMap` (not wired into `PeerStore`) |
| `@gamezilla/peer-store/store-errors` | Same symbols as root error re-exports |

### Constructor: `PeerStoreRoomConfig` only

- **`peerId` is derived** from `secretSeed` (self-certifying identity). You do not pass `peerId` separately.
- **`role.type: 'host'`** — supply `initialMembership` and `initialMemberPublicKeys` for everyone in the genesis room (≥ 2 peers). The host’s seed must correspond to one of those member ids.
- **`role.type: 'join'`** — supply `roomSnapshot` with genesis membership + keys **before** this peer appears in the log.
- **Trust weights** change only via replicated log commands (`PeerTrustUpdate` / authority-driven updates), not via a background election inside `PeerStore`.

`PeerStoreInitConfig` is a **deprecated alias** for `PeerStoreRoomConfig` (same type).

Use `normalizePeerStoreInit()` if you build configs dynamically and want the same normalization `PeerStore` performs internally.

### Migration from pre-v2

- **Removed** `PeerStoreLegacyInitConfig` (explicit `peerId` + `bootstrap` + `security`). Use `PeerStoreRoomConfig`: `roomSecret`, `secretSeed`, `role: { type: 'host' | 'join', ... }`.
- **Removed** automatic in-process trust elections (`autoTrustElection`, `trustElectionTimeoutMs`, `authorityStrategy`). For custom alignment, import `@gamezilla/peer-store/trust` and drive `PeerTrustUpdate` through the log yourself, or extend in app code.
- **Store errors**: shape vs field failures for join/leave/trust are merged into `PeerStoreJoinInvalid`, `PeerStoreLeaveInvalid`, `PeerStoreTrustInvalid` (check `detail`).

## Wire security (production posture)

`PeerStore` wire traffic is **signed** (Ed25519) and bound to a **match-scoped room secret** plus the store topic. Each peer’s `peerId` is **self-certifying** (derived from its public key). Join commands must carry the joining peer’s public key and must match the claimed `peerId`.

### What this defends against

- **Spoofed sender / forged `peerId`**: unsigned or wrongly signed messages are dropped before any state transition.
- **Replay**: a per-signer monotonic counter is enforced for inbound wire messages; counters are persisted with durable state.
- **Non-authority commits**: `accepted`, `rejected`, and `sync-response` must verify as the **current authority** signer and (for sync) match a **pending sync session** opened by this replica.

### Bootstrap & trust (pure P2P)

- **Room secret**: all peers in a match must agree on the same secret out-of-band (QR, voice, lobby server, etc.). Without it, signatures will not verify.
- **Optional fingerprints**: callers may require peer key fingerprints at session start. Pass `peerFingerprints` on the room config.
- **Join**: `role: { type: 'join', roomSnapshot: { initialMembership, initialMemberPublicKeys } }` pins the room’s genesis trust + keys so wire traffic verifies before the first `sync-response`. New members send `PeerJoin` **after** initial sync (the simulator’s `joinPeer` waits for this). `sync-request` / `heartbeat` accept any self-certifying signer (room secret + replay limits still apply) so a joiner can sync before appearing in the log.

### Standalone trust election

`TrustElection` (see `@gamezilla/peer-store/trust`) is **not** started by `PeerStore`. Use it only if you build your own coordination on top of the same transport.

### Transport contract

`Transport.subscribe` may pass an optional **`TransportMessageContext`** (e.g. `senderMeta` from a non-broadcast link). The in-memory bus passes `undefined`; **verification still happens in `PeerStore`** so broadcast transports remain safe when envelopes are used.

### Residual risks (money matches / high stakes)

- **Endpoint compromise**: malware on a device can sign arbitrary valid messages as that peer.
- **Room secret leak**: anyone with the secret can produce valid wire traffic for that match.
- **Colluding quorum**: authority + majority trust can still behave badly at the application layer—crypto does not prove honesty.
- **MITM on a shared broadcast bus**: if an attacker can mutate bytes *after* a peer publishes but *before* others receive, followers may reject tampered commits while the publisher already applied locally—treat optimistic local application as UX, not cross-peer safety unless you add stricter commit gating.

See tests under `src/testkit/cheating.test.ts` and `src/trust/election.test.ts` for adversarial coverage.
