# Goal: Build Light Cycles to Harden Multi-Participant Real-Time Games

## Primary outcome

Implement **Light Cycles**, an original light-trail arena game, as a fully integrated game in the product. Its main purpose is to extend and harden the existing game framework and `room` package beyond Pong's two-player case: **two to four simultaneous participants, deterministic collision resolution, elimination, spectators, rounds, bots, reconnects, and bounded real-time resource use**.

Reuse Pong's real-time execution and networking capabilities where present. Build one coherent real-time subsystem, not a second engine hidden inside this game. Use original naming, visuals, sounds, and assets rather than copying a film or another game's branding.

Success means another real-time game can provide state, inputs, rules, observations, bots, and rendering without reimplementing tick execution, room membership, authoritative input delivery, synchronization, spectating, or reconnection.

## Working contract

Work in goal mode: inspect, implement, integrate, test, and iterate until the acceptance criteria are demonstrated. Do not stop at a proposal, scaffold, isolated demo, or passing game-only unit tests.

The shared framework is the primary deliverable; the game is the concrete consumer that proves the improvements work. Do not use that priority as permission to build speculative abstractions. Extract mechanisms that this game actually needs, keep its rules local, and migrate existing consumers wherever an improved shared contract applies.

Before changing code:

- Read repository instructions and inspect the actual game registration, session lifecycle, `room`, rendering/input, persistence/sync, bots, specifications, and test infrastructure. Existing code is the source of truth; package names and implementation details may differ from these descriptions.
- Map ownership and dependency direction. Respect existing `apps/`, `libs/`, `pkgs/`, and `specs/` conventions where present. Keep reusable packages product-agnostic; keep the `room` package independent of the application sync engine.
- Identify what already exists, what needs extending, and which existing consumers will change. Record a short implementation checklist and relevant baseline test results using the repository's existing conventions.
- Inspect overlapping changes before editing shared contracts. Coordinate through the existing workflow, keep contract changes and consumer migrations together, and do not overwrite another agent's unrelated work or assume unmerged APIs exist.

### Architectural constraints

- Extend the existing game framework and `room` package. Do not create a second room system, transport, game registry, persistence stack, or test harness.
- Use small, composable capabilities, strict types, and explicit validation at trust boundaries. Do not impose multiplayer, hidden information, puzzles, or simulation ticks on games that do not need them.
- Prefer the existing functional and Elm-style architecture. Do not introduce service-locator containers, giant dependency bags, or a universal engine merely to host this game.
- Internal breaking refactors are allowed and preferred over shims, deprecated aliases, or parallel APIs. Migrate all affected consumers and remove superseded paths. This does not authorize silently discarding persisted data, changing published content, or breaking saved sessions.
- Reuse existing clocks, randomness, scheduling, and deterministic test mechanisms. Keep `@pkgs/dst` and its `SimDeps` harness-only; production mechanics must not import the simulation test harness. Use existing narrow production dependencies and adapt them in tests.
- Keep ephemeral live-match state separate from durable application data. Do not route every gameplay update through the relational/local-first sync engine. Honor existing local-first guarantees where applicable; disconnected clients cannot authoritatively continue a competitive online match.
- Reuse the current design system, renderer, accessibility patterns, observability, error reporting, identity, authorization, and entitlement policies. Do not introduce React, a renderer, billing rules, or another major dependency merely for this task. Ship the web experience; preserve platform-neutral domain contracts without adding native applications.
- Existing features are prerequisites to inspect, not assumptions to pretend are implemented. Build the minimal missing shared capability required by this game; do not silently expand the task into implementing other full games or unrelated platform systems.
- Do not deploy, change production data, rotate secrets, publish packages, or perform destructive repository operations without separate authorization.

### Verification and reporting

Follow the existing Gherkin/BDD, Quint, property-based testing, deterministic simulation, integration, and harness conventions. Keep specifications in the repository's established domain-oriented `specs/` layout. Use the real implementation beneath test drivers; do not replace the framework or sync engine with a simplified test-only implementation.

Use Quint for finite abstractions of the relevant lifecycle and protocol. State exploration bounds and fairness/network assumptions. Connect meaningful model actions and observations to implementation tests where supported. Model checking a specification is not proof that the TypeScript implementation is correct; do not describe it that way.

Use existing deterministic failure capture and replay: record seeds, initial state/configuration, inputs/actions, faults, and relevant version metadata. Avoid arbitrary sleeps and nondeterministic test oracles. Test only fault modes supported by the transport or explicitly introduced at application boundaries; do not invent packet-level guarantees.

Run the relevant checks after each phase and the established full validation command at completion, including `bun check` if that is the actual repository entry point. Do not claim a check passed unless you ran it. Report environmental blockers and pre-existing failures separately; do not weaken tests to obtain a green result.

Finish with a concise report: implemented workflows, shared contracts changed, existing consumers migrated, commands and results, deterministic reproduction artifacts, remaining limitations, and a short explanation of what a developer would implement to add the next comparable game.

## 1. Implementation boundaries

| Owner | Responsibilities |
| --- | --- |
| Existing `room` package | Authenticated membership and roles, transport, connection lifecycle, typed delivery, room identity/epochs, reconnect bootstrap, and cleanup. No arena or collision rules. |
| Shared real-time game framework | Authoritative execution, injected tick scheduling, input sequencing/admission, state delivery, optional interpolation/prediction contracts, round/match lifecycle, bots, result finalization, and player-to-spectator presentation. |
| Light Cycles | Grid arena, headings, movement cadence, trails, collision resolution, elimination, spawn layout, scoring, bot decisions, and rendering/input mapping. |
| Existing app infrastructure | Discovery, custom games, matchmaking, identity, results/history, entitlements, observability, and presentation shells. |

Remove actual assumptions that there are exactly two players, two paddles, one moving object, or a single winner. Do not replace them with another fixed entity schema or a universal physics engine.

Pong and Light Cycles should reuse the same host/client execution path where their needs coincide while retaining different physics and input semantics. If Pong is not implemented yet, establish the minimal real-time foundation required here and use a small contract fixture to verify alternate game-shaped state; disclose that actual Pong regression coverage was unavailable. Do not build Pong as an unrelated second product.

## 2. Deliberately bounded game rules

Implement the following initial variant and specify it exactly:

- Two to four occupied seats, with humans or clearly labeled bots, on a bounded rectangular integer-cell arena. The player count is fixed for the running match; late arrivals spectate.
- Each alive rider has one cell position and one orthogonal heading. On each configured movement step, every alive rider proposes exactly one cell of forward movement. There is no stopping, acceleration, diagonal movement, or wrapping.
- The initial head cells are occupied. Every successfully entered cell remains a permanent trail cell for the rest of the round. Trails remain after a rider is eliminated.
- A rider may turn left or right through normalized direction input but cannot reverse directly. Accept at most one effective turn per movement step. Define bounded queued-input behavior explicitly so a burst of commands cannot produce an impossible instantaneous reversal.
- Use fixed, documented spawn layouts for each supported player count, with distinct traversable positions and legal initial headings. Any randomized seat-to-spawn assignment must use injected seeded randomness. Do not claim competitive balance from geometry alone.
- Resolve all riders' proposed movements **simultaneously from the same pre-step state**. A rider dies when its target is outside the arena or already occupied. All riders targeting the same previously empty cell die. Head swaps also kill both because each target was occupied in the pre-step state.
- Only surviving legal moves append their target cells to the trail map. Do not append out-of-bounds or contested crash destinations. No rider gains a different result because its object happened to be iterated first.
- At the end of a movement step, one remaining rider wins the round; zero remaining riders is a draw. Award one point to a round winner and zero for a draw. End resolution immediately; a terminal round cannot award another win on a later tick.
- Use a shared configurable match score target, initially three round wins unless an existing product standard applies. Reset trails and rider state between rounds while retaining match scores. The match winner is the player who reaches the target; expose draws/abandonment distinctly from a winner.

Do not add weapons, power-ups, destructible terrain, teams, public arena editing, arbitrary player counts, complex physics, or rollback netcode in this initial scope.

### Product experience

Support offline practice against bots and online custom matches with two to four participants. Integrate existing matchmaking and spectator flows. Add local multi-human controls only when the existing input framework makes them a small integration; they are not a blocker for the primary four-client online validation.

Provide readable trails and rider identities, countdown, live scores, elimination feedback, round results, match results, and rematch. Support keyboard and mobile-friendly directional input. Do not make colors the only identity cue. Preserve arena geometry across screen sizes; resizing a viewport must not change authoritative gameplay.

## 3. Shared real-time execution and input semantics

Run an authoritative headless simulation with explicit logical ticks, fixed timestep, injected clock/scheduler and randomness, and no rendering/network calls inside game rules. Use integer cells for authoritative Light Cycles state. Document determinism assumptions for the shared runtime rather than claiming cross-language bitwise determinism.

Separate simulation tick frequency, movement cadence, snapshot frequency, and rendering refresh rate. A shared host may tick more frequently than riders enter cells. Pick and measure a playable initial configuration; do not make a specific renderer refresh rate or transport delivery schedule part of the rules.

Use the existing bounded catch-up policy where sound. Define behavior under host scheduling stalls: no unbounded busy loop, silent skipping of collision-bearing steps, or client-dependent physics. Report overload and follow a documented shared recovery/degradation policy. Browser visibility may suspend rendering; it must not pause the authoritative online room.

Clients send validated direction commands, never authoritative position, trail, score, elimination, or win messages. The authority checks ownership, controller/session identity, round identity, sequence, payload bounds, rate limits, and the target input window. A client-supplied tick is not trusted authority.

Crucially, directional turn commands are not interchangeable with Pong's held paddle movement. Share transport and admission mechanisms, but allow a game-specific or capability-provided input policy. Do not drop all intermediate turns under a generic latest-input-wins rule or replay a burst of stale turns after a long disconnection.

Assign accepted commands to explicit future/uncommitted movement steps under a deterministic policy. Reject stale/expired commands and commands for previous rounds or authority epochs. For the baseline, do not rewind committed outcomes to honor a late input. Bound input buffers and define acknowledgements/rejection behavior so clients can recover without repeated impossible corrections.

Test fairness of simultaneous rules, not a promise of identical network latency for every player. Input-arrival policy and latency tradeoffs should be documented explicitly.

## 4. Synchronization, presentation, and recovery

Reuse the actual `room` transport and Pong/shared state-sync mechanisms. Do not add a new socket manager, network service, or reliability layer on top of an already reliable ordered stream.

A joining or reconnecting client needs a coherent authoritative snapshot including match/round identity, current tick, arena/configuration, trails, riders, alive/eliminated status, scores, phase, and its role. Do not bootstrap only from recent trail segments and leave a newcomer with missing collision geometry.

Start with the simplest bounded snapshot strategy that meets measured bandwidth and responsiveness needs. If deltas are necessary, identify their base revision/tick and resynchronize when the base is missing. Snapshot/delta retention, input history, and client correction state must remain bounded; trails themselves are bounded by arena capacity.

Provide smooth presentation without changing authoritative occupancy. Interpolation or optional local prediction may be used through shared capabilities when justified. Keep speculative trails, movement, and effects separate from committed state. A correction must not leave permanent ghost trails, revive an eliminated player, or interpolate a rider through a crash as if it survived. Do not require generalized rollback merely to claim the framework supports real time.

Handle late snapshots, connection replacement, stale messages from previous rounds, and reconnects after elimination. A reconnect cannot respawn a rider, clear trails, erase scores, or create two active controllers for one seat.

Use a clear disconnect policy. Preserve current heading while a brief connection interruption is tolerated; after the configured grace period, use the existing abandonment/bot-handoff policy or eliminate the rider at an authoritative boundary. Do not freeze the arena for everyone. Any bot handoff must be visible and must not change the rider's position or grant it a second life. Reclaim can occur only according to the documented controller policy.

An eliminated participant keeps their seat and views the rest of the round as a spectator; they return for the next round. Do not confuse this with relinquishing membership. Spectators cannot send movement commands, and late joiners cannot become active mid-round unless an existing explicit admission policy supports it.

Authority/process failure should follow the platform's existing recovery or abandonment policy. Do not add cluster consensus, live host migration, or per-tick durable database writes for this game.

## 5. Bots, resources, and observability

Bots use the same legal normalized inputs and scheduling pipeline as humans. Implement deterministic baseline steering with configurable reaction time/lookahead; all arena information is public in this variant. Bound planning work per decision. Do not use LLM agents, impossible movement, extra turns, or direct mutation of authoritative state.

Start/stop bots with the shared round/room lifecycle. Room disposal must cancel all tick jobs, bot tasks, subscriptions, timers, and pending sends. Rematches must not accumulate listeners or multiply tick loops.

Persist final results and meaningful round/match metadata idempotently through existing infrastructure. Do not persist every rendering frame or put the live arena in the ordinary local-first CRUD stream.

Use existing telemetry to measure tick duration/scheduling delay, input rejection/age, snapshot size and age, bytes/messages per connection, reconnects, room count, and cleanup behavior. Avoid per-cell or per-tick spans and unbounded player/match-ID metric labels. Capture sensitive identifiers only under the existing logging policy.

Profile four active players plus multiple spectators and repeated room creation/rematch/disposal. Define workload and environment before reporting results. Address measured bottlenecks; do not preemptively introduce a spatial index, entity-component system, new transport, or multi-region deployment.

## 6. Executable verification

### Behavior and integration

Specify and test local bot practice, two/three/four-seat starts, countdown, legal turning, reversal rejection, trails, every collision category, simultaneous elimination/draw, round scoring, match completion, rematch, elimination-to-spectating, late spectator bootstrap, reconnect, and stale commands across round boundaries.

Run at least one real four-client online scenario through the shared framework and `room`, plus spectators. Verify a late spectator sees the same authoritative arena and round state, and that unauthenticated/wrong-seat/spectator inputs cannot control a rider.

### Properties

Assert at least:

- Authoritative positions and headings stay within their defined representations; alive riders occupy valid distinct cells after commit.
- Committed trail occupancy never decreases within a round; round reset is the explicit exception.
- A rider travels at most the configured number of cells per movement step and cannot reverse through multiple queued turns.
- Collision outcomes are independent of participant container/iteration order. Use permutation tests, not just hand-selected examples.
- Every rider targeting a contested cell is eliminated; head swaps, old heads, boundaries, and already-eliminated riders' trails behave consistently.
- Eliminated riders cannot move, create new trails, or re-enter that round.
- A round is scored once; a terminal match cannot change score; draws do not invent a winner.
- Rejected or duplicate commands do not mutate authoritative state or apply a second turn.
- Identical initial state, seed, tick schedule, accepted inputs, and documented policies reproduce the same state and outcomes.
- Snapshot round trips preserve enough state for accurate spectator/reconnect bootstrap; stale deltas cannot corrupt a newer state.

### DST, models, and failure cases

Use existing DST/PBT against actual host/client/room integration for latency, jitter, interrupted connections, application-message retries, stale snapshots, scheduling stalls, disconnect/reconnect, bot handoff, and teardown races. Respect the transport's actual ordering guarantees; do not claim arbitrary packet reordering is observable on a single ordered connection.

Assert convergence to the authoritative state after connectivity recovers and a complete current snapshot is processed, under a running authority and bounded delivery assumptions. Continuous play does not require all clients to display the exact same tick at the same wall-clock instant.

Model a small bounded arena and reduced lifecycle in Quint: simultaneous proposals, collision/termination, authorized input, round epochs, and idempotent scoring. Keep exact implementation collision properties in PBT; an abstract model alone does not verify rendering, transport, or all arena sizes.

Add resource-lifecycle tests that repeatedly create, play, rematch, and dispose rooms and verify no outstanding scheduled work/subscriptions remain. Run Pong and other affected consumers' regressions after shared real-time contract changes.

## 7. Phases and exit gates

1. **Audit and specs.** Inspect Pong, `room`, timing, input, state sync, bots, and lifecycle. Specify simultaneous collisions and input admission. Exit: clear ownership, baseline checks, and a minimal shared refactor plan.
2. **Shared real-time refinement.** Support variable participants, game-appropriate input semantics, round epochs, spectator state, and lifecycle cleanup where missing. Migrate Pong where applicable. Exit: shared contracts and existing consumers pass without Light Cycles special cases.
3. **Deterministic local slice.** Implement integer-cell rules, bots, rendering, controls, and complete local rounds/matches. Exit: simultaneous-collision and iteration-order properties pass through the real execution host.
4. **Four-player online slice.** Integrate custom rooms, matchmaking, state delivery, spectators, reconnects, and visible handoffs. Exit: a four-client match and late spectator work end to end under normal network conditions.
5. **Fault and load hardening.** Run DST/model/PBT/BDD/integration harness, instrument scheduling/bandwidth, verify cleanup and rematches, and remove redundant infrastructure. Exit: failures replay deterministically and bounded resource behavior is measured.

## 8. Definition of done

- Light Cycles is a complete discoverable game, not a framework-only demo.
- Two to four simultaneous participants, bots, rounds, draws, wins, spectators, reconnects, and rematches work through the real app.
- Collision resolution is simultaneous and independent of collection iteration order.
- The existing `room` package and shared real-time execution own reusable networking/lifecycle responsibilities; game code owns arena mechanics.
- Pong and Light Cycles exercise the same relevant host/client machinery without forcing their input or physics semantics to be identical.
- No unbounded input/snapshot history, orphaned scheduler work, per-tick durable writes, or client-authoritative outcomes remain.
- Existing turn-based and puzzle games do not acquire unnecessary real-time dependencies.
- The final report demonstrates exactly which shared responsibilities the next real-time game will reuse and which game-specific code it must supply.
