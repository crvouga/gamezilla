# Determinism

Determinism is not only for tests — it is how multiplayer and offline social
sync stay correct. Game clients reconcile by replaying identical inputs through
identical logic. Hidden nondeterminism is a production correctness bug.

## Core rule

**Same seed → same path.** Given the same `Io` seed (and the same command /
mutation inputs), reducers, merges, and derived game/social state must match
bit-for-bit across clients and runs.

## What `@pkgs/io` covers

Inject one `Io` bag from a composition root (`IoProvider` / `runWithIo` /
`createSimIo` / `wallIo` at process entry):

| Port | Use |
| --- | --- |
| `io.clock` / `io.timers` | Time and scheduling |
| `io.createId` | UUIDs / ids |
| `io.random` | RNG |
| `io.http` | Network |

Domain and game-logic code take required `io` (or `now` / `createId` slices).
Never default to wall implementations inside libraries.

## Banned APIs (product runtime)

Do not call bare:

- `Date.now`, zero-arg `new Date()`, `performance.now`
- `setTimeout` / `setInterval`
- `fetch` / `globalThis.fetch`
- `crypto.randomUUID`, `Math.random`, `crypto.getRandomValues`

Wall construction (`wallIo()`, `wallClock`, …) only in **tests** or
**entry-shaped** files marked `// @io-wall-ok` (see
`tools/scripts/io-scan-pragma.ts`).

CI: `bun run ci:no-bare-io`, `ci:no-resolve-wall-defaults`, `ci:no-sql-wall-io`,
`ci:mutation-determinism`, `ci:hard-determinism`, `ci:sim-determinism`.

## Hard-determinism gotchas

Beyond bare I/O:

1. **Float math on synced state** — Prefer integers / fixed-point for room
   state. IEEE float can diverge across CPUs/JITs. Chess puzzle Glicko uses
   float then `Math.round` for persisted ratings — document and test vectors;
   do not put floats into room event payloads.
2. **Object key ordering** — Integer-like string keys on plain objects sort
   numerically ahead of other keys. Do not iterate `Object.keys` for hashing,
   serialization, or turn order without an explicit sort (or use `Map`).
3. **Canonical hashing** — State hash / serialize must use deterministically
   sorted keys (`hashRoomState` / `canonicalJson`), never raw insertion-order
   `JSON.stringify` across construction paths.
4. **Locale-dependent APIs** — No `localeCompare`, `Intl.*`, or
   `toLocaleString` in shared game/domain/sync logic. Use code-unit `<` / `>`
   compares (ISO-8601 timestamps sort correctly that way).
5. **Scheduling** — Do not let `Promise.race` / microtask order choose durable
   game or social winners; drive timeouts via `io.timers`.
6. **GC** — Never branch on `WeakRef` / `FinalizationRegistry` / GC timing.
7. **Room modules** — Every `RoomModule` must implement `hash(state)`.
8. **Social sync** — Offline sync is **server-authoritative LWW** (upload
   arrival), not a CRDT. Per-client `seq` + pinned `createdAt` on replay are
   deterministic; cross-client conflict winners follow server order. Document
   any new merge rule with an explicit tie-break.
9. **Optional `io?`** — Forbidden in shared game/domain paths. Composition
   roots may take an override; libraries must require injection.

## Pre-merge checklist

- [ ] No bare I/O / wall defaults outside `@io-wall-ok` entries or tests
- [ ] New room / game logic uses integer or string state; no float physics in
      event payloads
- [ ] Any key iteration for hash/order uses sorted keys or `Map`
- [ ] `RoomModule.hash` covers full synced state
- [ ] No `localeCompare` / `Intl` in `**/shared/**` game or sync paths
- [ ] Mutations take time/ids from `env` / args, not wall APIs
- [ ] Added or updated `*.sim.test.ts` when changing reduce/merge behavior
- [ ] `bun run ci:hard-determinism` and `bun run ci:sim-determinism` pass

## Scaffolding

```bash
bun run scaffold:game -- <kebab-name>
```

Creates a game package with required `hash(state)`, sim/unit test skeletons,
and no wall globals. Register the game in spaces afterward (script prints
steps).

## Optional local pre-commit

```bash
git config core.hooksPath tools/githooks
```

Runs hard-determinism + sim tests when staged paths touch room / shared game /
sync-engine. CI remains authoritative.
