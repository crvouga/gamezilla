# room-command-id-applies-once

Focus: Idempotency and Replay.

## Property (catalog draft)

A room `commandId` produces at most one apply: at most one committed log fold (or one stored rejection). Replays after reconnect, take-over, or flood re-ack the stored outcome and must not append more events.

## What led here

Second write plane (`@pkgs/room` + `RoomServerDurableObject`). SUT analysis: “commandId once across reconnect/take-over/flood.” Wire `v=1`. Client queue correlation and server dedup share the same id (`pkgs/room/src/protocol/ids.ts`).

Room is deterministic replay + hash, not LWW. Double-apply of `Increment` (or a chess move) is a visible state fork.

## Code paths

- `pkgs/room/src/server/core/room-server.ts`
  - `handleParsedCommand`: `getDedupOutcome(topic, commandId)`; if present, `sendDedupReplay` (re-send `committed` with stored entries, or `rejected`) and return.
  - On miss: authorize / `module.handle` / `commitCommandSuccess`.
  - `commitCommandSuccess`: `appendCommittedEntries` **then** `putDedupOutcome({ kind: 'committed', entries })` **then** in-memory reduce + broadcast.
  - `injectCommandSerial` also short-circuits on prior, but does not re-send (scheduler path).
  - Rejects persist a `{ kind: 'rejected', error }` dedup row so the same id cannot later succeed.
- `pkgs/room/src/server/adapters/durable-object/storage.ts`
  - Events and dedup are **separate KV keys** (`room.do.v3.*` event prefix vs `.d.` dedup prefix).
  - `appendCommittedEntries` batches event keys + `lastSeq` meta in one `putEntriesBatched`.
  - `putDedupOutcome` is a later `kv.put`. Not the same batch.
- `pkgs/room/src/server/core/room-server.ts` `enqueueStorage`
  - `storageChain.catch(() => undefined)` swallows prior errors; `webSocketMessage` is not wrapped in `blockConcurrencyWhile` (restore/create is).
- Client: `room-client-wire.ts` drops/removes queued `commandId` on committed/rejected.

## Existing pins (sim, not Antithesis)

- `command-id-replay-dedup.sim.test.ts` — same id across reconnect + take-over; counter stays 1; `lastSeq === 1`.
- `replay-flood-dedup.sim.test.ts` — 50× same frame; one apply.
- `session-lifecycle.pbt.test.ts` — `commandId replay across takeOver applies once`.
- DST invariant `command-id-dedup-stable` (`pkgs/room/src/sim/invariants.ts`): every stored committed outcome’s seqs exist in the log.

## Failure if violated

Live hash ≠ log fold; spectators diverge; take-over / reconnect storm double-counts moves. A crash between append and `putDedupOutcome` is the concrete window: retry sees no dedup, `handle` runs again, `append` writes the next seq.

## Antithesis angle

- Process kill / DO eviction after event keys persist and before the dedup key.
- Reconnect + take-over (same `(identity, clientId)` closes prior socket 4000) while flooding the same `commandId`.
- Replay a previously rejected `commandId` with a payload that would now succeed — must stay rejected.

## Instrumentation

No Antithesis SDK (`existing-assertions.md`). Missing:

- `Always`: `dedup[commandId].kind === 'committed'` implies those seqs appear once in the log; log length for that command’s events does not grow on replay.
- `Always`: `getLastSeq` / live `hash(state)` equal fold of the log.
- `Reachable`: `sendDedupReplay` of a `committed` prior (retry actually hit storage).
- `Unreachable`: two committed outcomes for one `commandId`, or a committed outcome whose seqs are missing (`command-id-dedup-stable` port).

Port the existing sim invariant rather than inventing a second oracle.

## Open questions

- None

### Investigation Log

#### Are append and dedup one atomic DO write?

- Examined: `room-server.ts` `commitCommandSuccess`; `durable-object/storage.ts` `appendCommittedEntries` vs `putDedupOutcome`; `storage-keys.ts` prefixes.
- Found: two storage calls. Events+meta batched; dedup is a subsequent `kv.put`. Kill between them leaves log events without a dedup record.
- Not found: a single `storage.put` / `blockConcurrencyWhile` covering both.
- Conclusion: crash window is real; keep it as the Antithesis angle.

#### Does hibernation restore both event and dedup keys?

- Examined: `DurableObjectRoomStorage.getDedupOutcome` / `loadEventsAfter` / `ensureV3`; `hibernation.test.ts`; SUT analysis “Restore/create is [wrapped in blockConcurrencyWhile]”.
- Found: both key families live in the same KV namespace; get paths call `ensureV3`.
- Not found: whether `RoomServer` constructor always refolds `committedState` from `loadEventsAfter(0)` after eviction, vs caching a stale in-memory fold that could disagree with a missing dedup key.
- Conclusion: tagged partial — persistence of keys looks intact; fold-vs-dedup after hibernation needs a restore-path read when implementing the workload.

- Re-investigation 2026-09-01. Examined: `RoomServer.hydrateFromStorage`; `createServerLocked`; `hibernation-restore.ts` `restoreHibernatedSockets` / `attachRestoredSocket`; `handleParsedCommand` `getDedupOutcome`.
- Found: after eviction, `createServerLocked` does `new RoomServer` then `await server.hydrateFromStorage()`, which folds `loadEventsAfter(topic, 0)` from `initialState()`. Restore walks sockets and calls that same `createServerLocked`. `committedState` is always a full-log fold — not a cached isolate map. Dedup is still a later `kv.put`. On miss, `handleParsedCommand` runs `module.handle` on the already-folded state and `appendCommittedEntries` writes the next seq.
- Not found: a restore-time rebuild of dedup from the log, or a single atomic write of events+dedup.
- Conclusion: resolved — hibernation does **not** close the crash window. A missing dedup key after restore still double-applies. Property unchanged. Antithesis angle (kill between append and `putDedupOutcome`) still holds post-hibernate.

SDK (`existing-assertions.md`): **missing**. Port sim `command-id-dedup-stable` / `live-vs-log`; do not treat in-house DST as Antithesis instrumentation.
