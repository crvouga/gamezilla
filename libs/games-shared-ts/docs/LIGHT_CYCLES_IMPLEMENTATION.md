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

- [x] Audit and restore the dropped real-time foundation (`771dd5fc1`;
      `main` later restored it independently in #230, merged here).
- [x] Specifications: `db902db07`, `75c55336c`, `f8ef35b19` — seven
      features and `light-cycles-round.qnt`.
- [x] Shared: 2–4 seats in the simulation path, input policy, round fence,
      disconnection policy; Pong unchanged on `held` + `pause` (`586585c1f`).
- [x] Light Cycles shared/client/harness packages and registration
      (`25e659b49`, `bbc00da36`).
- [x] Design-system `TrailArena` and `DirectionPad` with examples and tests
      (`1a6618033`).
- [x] Properties, network DST, lifecycle and profile (`9d199da8d`); the
      model bound to the real room (`8bd802a2f`).
- [x] Defects found on the way fixed and pinned (`0b6f85193`, `8bd802a2f`).

## Shared contracts changed

| Contract | Change | Consumers migrated |
| --- | --- | --- |
| `defineGame` | One registration for turn games (`turnAutomation`), simulations, or puzzle-only content; `defineTurnGame` removed. | chess, Connect Four, Battleship, Quoridor, Numberlink, fixtures and tests |
| `GamePositionRules` | Carries `family` and `sides`; `assertGameSides` accepts two to four ordered seats. | custom games, matchmaking handoff and rematch rotation |
| `PLAYABLE_GAME_DEFINITIONS` | Replaces `TURN_GAME_DEFINITIONS`: every game with position rules. | catalogs, automations, enrollment and conformance |
| `RegisteredSimulation.input` | `held` (default) or `commands`: sent once, scheduled by the authority on the next uncommitted tick, bounded per player, stale/future refused. | replica, authority, presentation sessions |
| `RegisteredSimulation.rounds` | Round fence: another round's command is refused; the replica drops outstanding commands on a round change. | authority, replica |
| `RegisteredSimulation.disconnection` | `pause` (default) or `continue` with a grace period and a pure `retire`; the persisted absence deadline runs only when every controller is away; more than two seats never forfeit to one absence. | session runtime, custom and matched expiry |
| `GameSimulationControls` | Optional `elsewhere` and `claim`: one device steers a person's seats; another device takes over only by claiming. | custom simulation session, boards |
| Room server | A live game's readers stay present, and their game signals are accepted while the space host is away. Ordinary commands keep the host rule. | `@pkgs/room-root-server-ts` |

## Defects found and pinned

Each defect has a `// regression:` test and a record in `libs/tools-harness-ts/goal/known-bugs/`.

- `simulation-host-absence-retires-everyone`
- `simulation-retirement-away-seat-rides-at-round-start`
- `simulation-epoch-clock-drops-snapshots`
- `simulation-command-presentation-lags-a-step`
- `local-simulation-runs-on-two-devices`
- `light-cycles-finished-game-says-watching`
- `light-cycles-crashed-rider-takes-its-turn`
- `simulation-enrolled-in-multi-seat-turn-specifications`
- `simulation-finished-custom-game-needs-turns` (also failed for Pong)
- `light-cycles-board-without-its-own-test-id`

## Evidence

- **Specifications:** all 108 feature scenarios and the bound
  `light-cycles-round.qnt` traces pass. `light-cycles-harness-ts`
  `test:spec` reports 115 pass, and `verify:models` proves every invariant
  within 4 steps.
  - **Model bounds:** a 4 × 3 arena, Duel and Trio, 3 rounds, and target
    score 1 or 3.
  - **Binding:** the model is bound through the real room, authority and
    replicas, using test-only 4 × 3 modes of the same mechanics.
  - **Late turns:** a late turn is a forged wire command, and the binding
    requires it to be refused.
- **Mechanics properties** (`light-cycles-shared-ts`, 36 tests):
  - riders stay in their representation and in bounds;
  - trails never shrink within a round;
  - a rider moves at most one cell and one turn per step, and never reverses;
  - the movement outcome is the same for every permutation of the proposals;
  - every rider entering a contested cell crashes, and so does every
    head-swap or wall crash;
  - crashed riders stay inert;
  - each round is scored once, and a finished game is absorbing;
  - rejected and duplicate commands change nothing;
  - play replays deterministically;
  - the codec round-trips, and decode refuses malformed input.
- **Network DST** (`light-cycles-network.property.test.ts`):
  - four riders and two spectators on real room clients, one spectator
    joining late;
  - faults: ordered-link latency and jitter, interruptions, retries,
    connection replacement, stale snapshots and authority stalls;
  - checks: convergence after recovery, command authority (spectator,
    other seat, intruder, earlier round, stale or future basis), arena
    invariants on every snapshot, no pause for others, retirement only
    after the grace period, no revival or second controller;
  - every failure throws its replayable recording. Two sweeps of 400 random
    seeds found nothing beyond the two pinned bugs.
- **Lifecycle** (`light-cycles-lifecycle.test.ts`):
  - a Duel practice and a Quad, each played to completion three times with
    rematches, then disposed;
  - timers, tick subscriptions and room subscriptions stay constant per
    running game;
  - nothing remains after disposal.
- **Shared conformance:**
  - Light Cycles Duel runs the same 11 custom-game and 11 matchmaking
    shared suites as Pong.
  - The shared Gherkin features that enroll Light Cycles pass for every
    mode: 117 cases across custom games, invitations, open places,
    blocking, following the host, game choices, finding an opponent (with
    and without a clock, across devices) and matched games without turns.
  - Trio and Quad run the suites eligible for more than two seats.
  - Turn games keep their suites.

## Measurements

- **Environment:** bun 1.4.3 on darwin arm64, in process, on virtual time
  (`bun run bench` in `libs/light-cycles-harness-ts`; seed 7331).
- **Workload:** four riders and two spectators on 40 ± 10 ms ordered links
  for 10 s.
  - Each rider turns every 500 ms.
  - One rider is away for 1 s.
  - The authority stalls once for 200 ms.
  - Five forged commands are sent.

| Measure | Value |
| --- | --- |
| Ticks committed / due | 300 / 300 (30 Hz) |
| Snapshots published | 150 (15 Hz) |
| Authority wake delay | mean 0.57 ms; max 167 ms (the injected stall, caught up within the 6-tick bound) |
| Snapshot size | mean 469 B, max 565 B |
| Snapshot age at the client | mean 39.5 ms, p95 49 ms |
| Rider traffic | ≈ 0.46 kB/s up (1.6 messages/s), ≈ 7.8 kB/s down (16 messages/s) |
| Spectator traffic | ≈ 7.7 kB/s down |
| Engine Quad tick, four hard bots | median 28 µs, p99 2.6 ms; encode and decode median 31 µs |
| Wall time for 10 s of play, 20 spectators | 1.04 s |

Trails are bounded by the arena: at most 1,120 cells, and about 1.2 kB for
the worst-case run-length encoding. Input queues, the replica outbox,
interpolation history and retention are all bounded.

## Policies

- **Determinism:**
  - Authoritative state is integers.
  - The tick-local random stream is derived from the session seed.
  - Inputs apply in ASCII player order.
  - Retirement is fixed by ticks, not by when a timer wakes.
- **Input arrival:**
  - The authority stamps every command on the next uncommitted tick, in
    arrival order.
  - A device's tick is only its basis: refused when older than 30 ticks
    or newer than the committed tick.
  - Committed steps are never rewound.
  - Each rider keeps at most two queued turns, takes one per step, and
    discards reversals.
  - A turn from another round is refused, and the game also ignores one
    admitted just before a round change.
- **Scheduler stalls:** the engine catches up at most 6 ticks per wake and
  drops the remaining time. That loss shows as a drop in the measured rate,
  never as a skipped collision.
- **Disconnection:**
  - The arena never pauses; the rider keeps its heading.
  - After 3 s the rider crashes, and it sits out each round that begins
    while its person is away.
  - Coming back rides again from the next round.
  - When every person is away for 30 s, the game is called off.

## Limitations

- **`ci:spec-ownership`** flags `771dd5fc1`, whose re-application of the
  Pong branch included Pong's spec files beside code. Clearing it needs
  that commit split, which is a history rewrite under the later merge
  of `main`.
- **Waiting turns in the model:** the model hides the queue of waiting
  turns, and the board shows only the next step, so a defect that adds a
  third queued turn is caught by the mechanics properties rather than the
  model traces.
- **Bot hand-off:** none. An away rider retires instead, which the brief
  allows.
- **Local multi-human steering:** offered for Duel only (arrows, and W, A,
  S and D).

## Adding the next real-time game

**What the framework already provides:** fixed-step execution, tick
scheduling and catch-up, the authority with ownership, epochs, rounds and
input admission, room signals and snapshots for players and late
spectators, replica presentation, reconnect fences, one steering device,
custom games, practice, matchmaking, rematches, results, history, bots
through the same inputs, and lifecycle cleanup.

**What a game supplies:**
- typed state, a pure `step`, a strict `codec`, `parseInput`, `result`,
  `phase` and `checkpointKey`;
- optionally `bots`, an `input` policy, a `rounds` fence, a
  `disconnection` policy with `retire`, and presentation (interpolation or
  prediction);
- `defineGame` with its capabilities;
- a board composed from `@pkgs/ui`;
- a `SimulationHarnessGame` with literal fixtures and a record reader;
- its own specs and bindings.

**Light Cycles' share:** about 1,400 lines of mechanics and 600 of
client, as the concrete measure of that split.
