# Gamezilla

A local-first, offline-first multiplayer game platform.

---

## Pricing

One subscription. Everything is included.

The subscription pays for connection time to our coordination servers. Single-player and offline play are free, forever. There are no tiers, no per-game purchases, no cosmetics, no ads, no telemetry-driven monetization. If you want to play with other people over the internet, you subscribe. That is the entire business model.

The server is the only thing that costs money to run, so the server is the only thing we charge for.

---

## Engineering Philosophy

### Tiger Style

We follow the [Tiger Style](https://github.com/tigerbeetle/tigerbeetle/blob/main/docs/TIGER_STYLE.md) discipline adapted for TypeScript. Safety and correctness are not at odds with velocity — they enable it.

- **Assert invariants, don't check them.** Assertions are load-bearing, not debug aids. If an invariant is violated, crash. Silent corruption is always worse than a crash.
- **Handle every error.** No swallowed promises, no bare catches, no `catch {}`. Every failure path is either explicitly handled or explicitly propagated.
- **Fail loudly.** Unhandled rejections are fatal. If something impossible happens, the process dies and tells you why.
- **Explicit over implicit.** No hidden control flow, no magic. Every dependency is injected. Every configuration is visible. Every side effect is named.

### Local-First

The client is the source of truth. The server is coordination infrastructure, not authority.

- The app works fully offline indefinitely. Sync happens opportunistically when connectivity is available.
- The local database is always available, always writable, always fast. It never waits on the network.
- The server relays changes between clients. It has no durable state of its own — if it loses everything, clients re-push and the system self-heals.
- Users own their data. Backup and restore is a client concern.

### Append-Only

Data is never deleted or mutated. Only new patches are appended.

- No destructive migrations, ever. Schema changes are additive.
- Soft deletes via attributes. Undo is replaying history, not recovering deleted rows.
- The full history of every entity is always reconstructable.

### Conflict-Tolerant

Multiple clients can write concurrently to the same entity without coordination. Conflicts are resolved automatically by per-attribute merge — latest value per attribute key wins, `null` removes a key. No manual conflict resolution, no last-writer-wins at the entity level, no CRDTs.

### Deterministic Simulation

Every non-deterministic boundary — time, network, scheduling, randomness — is injectable. The entire multi-client sync system can be simulated in-process with simulated clocks, simulated network links with configurable latency and packet loss, and simulated transports.

This means we can write tests like "two clients go offline, make conflicting edits for 30 seconds, come back online, and converge" — and run them deterministically in milliseconds with no real I/O.

### Infrastructure as Code

Every piece of infrastructure is defined in code, versioned, and deployed automatically. No manual provisioning, no clicking through consoles, no snowflake servers. A single push to `main` triggers the full pipeline end-to-end.

### Single Source of Truth

- **Code is the source of truth for infrastructure.** The repo defines the production environment, completely and reproducibly.
- **The client database is the source of truth for application data.** The server is a cache that can be rebuilt from clients.
- **The patch log is the source of truth for entity state.** Snapshots are derived views, recomputable from patches at any time.
- **`main` is the source of truth for what's deployed.** There is no separate deploy step. If it's on `main`, it's in production.

---

## Architecture

### Sync

Clients write locally first (optimistic, instant), then sync in the background. The transport layer is interface-driven and swappable, so the same sync logic runs over real network or in-process for tests.

The server performs merge-then-read: it incorporates client-known patches before responding. Clients detect server data loss and re-push automatically.

### Rooms

`@pkgs/room` implements **server-authoritative** sessions per topic (e.g. `space:<id>`). The server is the sole writer to the ordered event log (`seq` monotonic per topic). Clients keep an **optimistic** view plus a **durable command queue**: dispatch runs `RoomModule.handle` locally for UX, queues `{ commandId, command }`, sends over WebSocket when connected, sends `sync(fromSeq)` on reconnect, and drops optimistic overlays when the server returns `committed` or `rejected`. Server dedupes by `commandId` so retries are safe.

Game rules live in a shared **`RoomModule`** (used on client for optimism and on server for validation). Wire traffic is a small fixed set of JSON message kinds; auth runs at WebSocket upgrade (`RoomAuth`). See `pkgs/room/src/README.md` for ports, adapters, and Tiger Style expectations.

### Dependency Injection

A lightweight DI container with typed tokens and scoping. Every service — storage, transport, sync, config — is resolved through DI, which is what makes deterministic simulation possible.
