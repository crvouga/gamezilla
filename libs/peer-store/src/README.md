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
