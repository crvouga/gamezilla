# Determinism

Determinism is not only for tests — it is how multiplayer and offline social
sync stay correct. Game clients reconcile by replaying identical inputs through
identical logic. Hidden nondeterminism is a production correctness bug.

## Core rule

**Same seed → same path.** Given the same `Session` / `start(system, { seed })`
seed (and the same system draws + action choices), reducers, merges, and derived
game/social state must match bit-for-bit across clients and runs.

## What injected ports cover

Inject clock, timers, ids, RNG, and HTTP from a composition root
(`createClient(env)` / `createServer(env)` / `createSim` via harness-only
`virtualHost()` / `Session` from `@pkgs/dst` / wall adapters at process entry):

| Port | Use |
| --- | --- |
| `clock` / `timers` (`@pkgs/clock` types; sim uses `@pkgs/dst/kernel` virtual clock + scheduler) | Time and scheduling |
| `createId` (`@pkgs/uuid`) | UUIDs / ids |
| `random` (`@pkgs/uuid`) | RNG |
| HTTP (`@pkgs/http-client`) | Network |

**`Session` / Host are harness-only.** Product `ClientEnv` / `ServerEnv` receive unpacked
ports — never the Session bag. Shared simulation mechanics live in
`@pkgs/dst`. **Systems are framework-owned:** packages declare
`defineSystem` / `defineObservation` / `defineAction` / `defineProperty` (topology via
`session.fork` + `draw`, converge as actions/properties); tests call `start` /
`walk` / `check` / `replay` from `@pkgs/dst` / `@pkgs/dst/pbt` — not package-local
World openers. See [`pkgs/dst/CONTEXT.md`](pkgs/dst/CONTEXT.md).

Domain and game-logic code take required `clock` / `createId` (or `now` slices).
Never default to wall implementations inside libraries. Never construct an `Io` bag.

## What `@pkgs/object-store` covers (filesystem / blobs)

All file **content** I/O goes through an injected {@link ObjectStore}:

| Layout | Use |
| --- | --- |
| `sidecar` | Product blob cache (TTS, etc.) with `.meta.json` content-types |
| `tree` | Git trees / CI scans / NDJSON logs (keys = relative paths) |

Wall `node:fs` / `expo-file-system` live only in `@io-wall-ok` adapters
(`wall-node-fs.ts`, `wall-expo-fs.ts`). Composition roots pass
`createNodeFsObjectStore({ rootDir, fs: wallNodeFs(), layout })`.

**Not** ObjectStore (process / OS I/O — keep on existing ports):

- `child_process` / `Bun.spawn`
- `chmod` / executable bits (`@pkgs/os` `OsFs`)
- Pure path math (`node:path`)
- Path roots (`cwd` / `homedir` / `tmpdir`) as constructor `rootDir` only

CI: Biome plugins `no-bare-fs.grit` / `no-bare-io.grit` (via `bun run lint`).

## Banned APIs (product runtime)

Do not call bare:

- `Date.now`, zero-arg `new Date()`, `performance.now`
- `setTimeout` / `setInterval`
- `fetch` / `globalThis.fetch`
- `crypto.randomUUID`, `Math.random`, `crypto.getRandomValues`

Wall construction (`wallClock`, `wallTimers`, `crypto.randomUUID`) only in **tests** or
**entry-shaped** files marked `// @io-wall-ok` (see
`tools/scripts/io-scan-pragma.ts`).

CI: Biome Grit plugins (via `bun run lint`) for bare I/O, wall defaults, and hard-determinism.

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
- [ ] `bun run lint` (hard-determinism plugins) passes

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
