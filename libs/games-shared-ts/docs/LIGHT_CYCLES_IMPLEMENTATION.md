# Light Cycles implementation

The implementation ledger for
[the Light Cycles brief](../../../docs/LIGHT_CYCLES_GOAL.md). The product
contract belongs in `specs/light-cycles/`; the shared real-time foundation it
extends is described in [REALTIME_IMPLEMENTATION.md](REALTIME_IMPLEMENTATION.md).

## Audit findings

- **Pong had been dropped from `main`.** Merge `086a18805` resolved every
  conflict to `main`'s side, so the Pong branch (`d149d2144`) — the fixed-step
  engine, authority, replica, room signals, `@libs/pong-*` packages and
  `specs/pong` — never landed, leaving orphan files importing the missing
  modules. Commit `771dd5fc1` re-applies it three-way from the true merge base
  `296d4d6ef` and unions it with `main`'s N-seat work: one `defineGame`
  (turns, simulation, or puzzle-only), `PLAYABLE_GAME_DEFINITIONS`, clockless
  N-seat matchmaking, and seat-typed simulation execution.
- **Ownership.** `@pkgs/room-*` owns membership, transport, signals,
  reconnect and cleanup. `@pkgs/turn-game-shared-ts` owns the pure simulation
  contracts. `@libs/game-session-shared-ts` owns execution (engine, driver,
  authority, session runtime, replica, bots). Games own mechanics only.
- **Two-player assumptions in the real-time path.** Custom and matched
  simulation controllers, the client seat filters, the execution schema and
  the absence mapping named only `white`/`black`; seat validation accepted
  only two or four seats.
- **Input semantics.** The authority accepted a client-chosen tick inside a
  lead window, and the replica coalesced held controls (latest wins, refreshed
  at 30 Hz). That suits Pong's paddles; discrete turns need every command in
  order, at most one effect per movement step, authority-assigned ticks and
  stale-command rejection.
- **Disconnection.** Any absent controller paused the whole simulation. A
  four-rider arena must not freeze for everyone.

## Design

### Shared framework changes

| Capability | Owner | Contract |
| --- | --- | --- |
| Seat rosters of two to four | `turn-game-shared-ts`, sessions, matchmaking | `assertGameSides` accepts 2–4 ordered seats; simulation controllers, missing seats, client seat filters and match/rematch handoff iterate declared seats. |
| Input policy | `RegisteredSimulation.input` | `held` (default, Pong: coalesced, refreshed, client-requested tick inside the lead window) or `commands` (each command sent once, authority assigns the next uncommitted tick, bounded per-player queue, commands older than `maxAgeTicks` refused as stale). |
| Round fence | `RegisteredSimulation.round` | A game-reported round identity. Commands carry the round they were issued in; the authority refuses another round's command and the replica clears outstanding commands when the round changes. |
| Disconnection policy | `RegisteredSimulation.disconnection` | `pause` (default, Pong) or `continue` with `graceMs` and a pure `retire(state, side)`: the arena keeps running, the absent seat's inputs are fenced, and after the grace period the authority retires the seat at each tick boundary until it returns. |
| Seat-aware initialization | `SimulationMechanics.initialize` | Receives the declared seats, so one mechanics module serves several modes. |

### Light Cycles

- Family `light-cycles`; modes `light-cycles` (Duel, 2 riders),
  `light-cycles-3` (Trio, 3 riders) and `light-cycles-4` (Quad, 4 riders),
  each a registration with fixed seats, like Classic and Four-Player
  Quoridor. The rider count is fixed for a running match.
- Integer arena of 40 × 28 cells. 30 ticks per second; riders enter one cell
  every 3 ticks (10 cells per second); 15 snapshots per second; renderer
  refresh is independent.
- Riders: Comet (`white`), Ember (`black`), Nova (`red`), Volt (`blue`) — each
  with a letter mark and its own trail pattern, never colour alone.
- Fixed spawn layouts per mode; the seat-to-spawn assignment rotates by round
  number (no randomness).
- Simultaneous resolution from the pre-step occupancy set; a sorted,
  order-independent implementation.
- Direction commands carry their round; up to two queued turns per rider,
  reversals of the planned heading discarded, at most one turn applied per
  movement step.
- Rounds: 3 s countdown, play, 2 s result, then a fresh arena. Target 3 round
  wins (1–9 configurable); after 15 rounds the leader wins, equal leaders draw.
- Bots: bounded flood-fill lookahead (easy 4, medium 24, hard 96 cells) on
  the same commands as people.

## Checklist

- [x] Audit and restore the dropped real-time foundation (`771dd5fc1`).
- [ ] Specifications (`spec(light-cycles)` commit): features and a Quint model.
- [ ] Shared: 2–4 seats in the simulation path, input policy, round fence,
      disconnection policy, seat-aware initialization; migrate Pong.
- [ ] Light Cycles shared/client/harness packages and registration.
- [ ] Design-system arena component with example and harness test.
- [ ] Properties: bounds, monotone trails, iteration-order permutation,
      contested cells, eliminated riders, scoring once, rejected commands,
      replay determinism, snapshot round trips.
- [ ] DST network system over real rooms: four clients plus spectators,
      faults, reconnects, late spectator convergence.
- [ ] Resource lifecycle: repeated create/play/rematch/dispose with no
      outstanding timers or subscriptions.
- [ ] Profiling: four riders plus spectators; tick duration and bandwidth.
- [ ] Pong and existing consumers' regressions; `bun verify`.

## Baseline

Measured after the restoration commit, before Light Cycles changes:

- Whole-repository type check (`tsc -p tsconfig.json`): clean except two
  pre-existing failures unrelated to games (`libs/harness-ts/tests/test-failure-spans.test.ts`
  duplicate properties; `pkgs/ui-quality-check-server-ts` unknown-typed
  values), both identical on `main`.
- `@pkgs/turn-game-shared-ts` 14, `@libs/game-session-shared-ts` 141,
  `@libs/pong-shared-ts` 21, `@libs/game-matchmaking-shared-ts` 91,
  `@libs/games-shared-ts` 7, `@libs/pong-harness-ts` 6,
  `@libs/games-harness-ts` 211, `@apps/synthetic-population-worker-ts` 29
  tests pass.
