# Goal: Build Hearts to Harden the Shared Multiplayer Game Framework

## Primary outcome

Implement a polished, fully integrated **four-player Hearts** game in the product. Use it to extend and harden the existing game framework and `room` package for **more than two participants, private player state, simultaneous decisions, seeded randomness, multi-round matches, and controlled human/bot handoffs**.

The current game set includes chess, Connect Four, Battleship, Quoridor, and Numberlink; Pong is the real-time reference game being added. Inspect what is actually implemented. Hearts must reuse the same platform rather than become a separate card-game application.

Success means a future multiplayer game can reuse seating, observations, lifecycle, reconnects, bots, results, and UI shells while supplying its own rules and presentation. It does **not** mean creating a universal card-game or trick-taking language.

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
| Existing `room` package | Membership, authenticated roles, connection lifecycle, transport, role-scoped delivery primitives, resynchronization, and cleanup. No Hearts rules. |
| Shared game framework | Stable seats, participant/controller identity, authoritative action dispatch, per-viewer observations, optional simultaneous phases, match/round lifecycle, bot scheduling, results, spectators, and reconnect orchestration. |
| Hearts | Deck and deal rules, passing, legal cards, trick resolution, hearts-breaking, scoring, match termination, bot strategy, and card/table presentation. |
| Existing app infrastructure | Discovery, custom games, matchmaking, identity, durable results, entitlements, navigation, and telemetry. |

Refactor hardcoded two-player assumptions where they actually exist: participant arrays, seat assignment, turn indicators, results/rankings, invitations, layouts, ready state, and reconnect logic. Do not fix them by adding `if (gameId === "hearts")` branches to shared code.

Keep seats, user identities, network connections, and controllers distinct. A reconnect changes a connection, not the player's seat. A bot takeover changes control, not card ownership. Use the repository's existing equivalents rather than introducing duplicate identifiers.

## 2. Deliberately bounded product rules

Implement one explicit baseline ruleset. Do not build variant configuration screens or a generic rules DSL.

- Four seats in a fixed circular order; a standard 52-card deck; thirteen cards per player. Shuffle and deal only at the authority.
- Passing repeats **left, right, across, hold** by deal. On passing deals, each player privately submits exactly three distinct cards from their hand. A submission is final for that phase. Transfer all selections atomically only after all four are committed. On hold deals, skip passing.
- The player holding the two of clubs leads it to the first trick. Players must follow the led suit when possible. Otherwise they may discard a legal card. On the first trick, prohibit hearts and the queen of spades unless the player has no non-point card available after applying follow-suit requirements.
- A player cannot lead hearts until a heart has been played, unless their entire remaining hand is hearts. The queen of spades alone does not break hearts. The highest card of the led suit wins the trick; its winner leads next.
- Each heart scores one penalty point; the queen of spades scores thirteen. Resolve scoring after thirteen complete tricks. Capturing all twenty-six points is shooting the moon: the shooter receives zero and each other player receives twenty-six.
- Start another deal unless at least one cumulative score has reached 100. At that boundary, the lowest cumulative score wins. For this baseline, tied lowest scores are joint winners; represent that correctly rather than assuming a single winner ID.
- Reset per-deal state correctly while retaining cumulative scores and passing-cycle position. A completed match cannot accept further gameplay mutations.

Specify these choices in executable behavior specs, including first-trick exceptions, all-hearts hands, and scoring boundaries. Use the same legal-action implementation for server validation, player affordances, and bot legality.

### Modes and interface

Support offline practice with one human and three clearly labeled bots. Support online custom tables with four occupied seats supplied by humans and explicitly configured bots. Integrate with existing matchmaking and spectator workflows; do not invent a new queue service or disguise bots as humans.

Provide a responsive four-seat table, readable cards, visible turn/phase information, private three-card selection, passing progress without revealing selections, trick feedback, cumulative scores, match results, and rematch. Support mouse, touch, and keyboard card selection. Avoid color-only distinctions and render the viewer's own seat consistently.

## 3. Hidden information is an architectural acceptance gate

Use an authoritative full game state and explicit per-viewer projections. Filter **before serialization and delivery**, not merely inside the UI.

- Players may receive their own hand and entitled private events. They must not receive opponents' hands, private pass selections, future shuffled order, authority RNG state, or a seed that makes hidden cards reconstructable.
- Spectators receive only the public observation. A spectator joining late must not receive an unfiltered authority snapshot.
- Public observations may include hand counts, scores, revealed cards, phase, turn, and committed/not-committed passing status. They must not expose selection contents prematurely.
- Protect snapshots, incremental updates, reconnect payloads, replay/history endpoints, logs, traces, and error reports consistently. Sensitive deterministic replay artifacts belong in an appropriately restricted debugging path, not a player payload.
- An authority-generated seed may make the game reproducible internally; that does not make it safe to disclose. Production seed material must come from the existing trusted randomness mechanism and remain private while it can reveal hidden information.
- Bots receive the information a player in their seat is allowed to know. Do not make a bot strong by handing it the authority's complete hidden state.

Add serialization-level and transport-boundary tests that inspect what each recipient actually receives. Test that changing only information inaccessible to a viewer does not change that viewer's observable payload, except for explicitly public derived information.

Reuse or improve Battleship's hidden-information mechanisms where applicable. Migrate that consumer when changing the shared projection contract, and verify it still protects its own secrets. Do not build parallel privacy systems for cards and boards.

## 4. Actions, lifecycle, reconnects, and bots

Represent the actual phases clearly: waiting/ready, dealing, passing, trick play, deal scoring, match completion, and abandonment. Use existing lifecycle primitives rather than adding a global state-machine library without necessity.

Associate actions with sufficient existing session/match/deal/phase identity and sequence information to reject stale or duplicate commands. Reject out-of-turn plays, duplicate cards, forged seats, illegal passes, and commands from obsolete controllers. A retried action or result write must not apply twice.

Simultaneous passing must not become four sequential public turns. Commit each player's private submission independently and resolve the transfer once. Do not add cryptographic commit/reveal when trusted authoritative private submissions solve the requirement.

Define and test a disconnect policy using the existing product policy where available. Otherwise use a configurable grace period followed by a disclosed bot takeover so a disconnected seat cannot block passing or trick play indefinitely. Permit a returning owner to reclaim control at a documented safe boundary. Ensure only one controller can act for a seat at a time and invalidate stale controller commands. Bots must never receive a second copy of a hand or reset the match.

Bots should use deterministic seeded strategy, legal actions, and injected scheduling for reaction delay. Bot scheduling must not block the room, embed wall-clock sleeps in game rules, or outlive room teardown. Implement a competent simple baseline, not an LLM integration or an optimal Hearts solver.

Use the existing durable result/history mechanisms with idempotent finalization. Do not write each animation frame or private hand to the general app sync stream. Rejoining restores the correct phase, current private hand, pending submission status, scores, and permissions. Use the existing authority-failure policy; do not invent distributed host migration for this game.

## 5. Executable verification

### Behavior and integration

Cover full local and online matches, all four passing modes, follow-suit enforcement, first-trick restrictions, hearts breaking, trick winners, normal scoring, shooting the moon, ties, rematches, full-table handling, spectators, and late joins.

Run real four-client integration scenarios through the actual framework and room implementation. Exercise disconnect/reconnect during passing and trick play, bot takeover/reclaim, stale actions from a prior deal, duplicate finalization, and room cleanup. Verify an unauthenticated or wrong-seat client cannot obtain a private view or submit a move.

### Properties and deterministic simulation

Assert at least:

- Card conservation: the 52 distinct cards are partitioned across hands, the current trick, and captured piles at every relevant phase.
- Passing preserves the deck and hand sizes; no card is lost, duplicated, or transferred twice.
- Exactly thirteen tricks consume the deal, and a trick has exactly one legal winner.
- Legal play removes exactly one card from the correct hand; rejected actions leave state unchanged.
- The cards in a deal contain twenty-six penalty points before moon redistribution; do not incorrectly assert that redistributed deal scores always sum to twenty-six.
- Completion and durable result publication occur once; terminal state is stable.
- Duplicate commands, reconnects, and controller changes cannot grant multiple effective turns.
- Identical authoritative initial state, seed, accepted actions, and scheduling decisions yield equivalent state and observations.

Use existing DST/PBT to explore latency, disconnects, replayed requests, controller transitions, and timer races. State eventual-progress assumptions explicitly: the authority runs, communication eventually recovers, and a legal bot or human eventually acts.

Model seating/control, private commit barriers, phase progression, and result idempotency in Quint using a tractable reduced model. Keep full-deck game-rule tests in implementation-level PBT instead of claiming an exhaustive search of all complete Hearts games.

## 6. Phases and exit gates

1. **Audit and contracts.** Identify two-player assumptions, privacy paths, and lifecycle gaps. Write behavior specs and the ownership map. Exit: a concrete shared change list, baseline checks, and no duplicate architecture proposed.
2. **Shared multiplayer hardening.** Implement only the necessary seat, observation, phase, controller, and result changes; migrate affected consumers. Exit: existing two-player games still pass and four-seat/private-view contract tests pass.
3. **Hearts vertical slice.** Implement rules, bots, table UI, and a complete offline match using the real shared lifecycle. Exit: all deal/passing/scoring paths execute deterministically through the application.
4. **Online integration.** Add real custom tables, existing matchmaking, scoped delivery, spectators, reconnects, and controller handoffs. Exit: four-client end-to-end play works without private-data leakage or stalled abandoned seats.
5. **Hardening and cleanup.** Run BDD, PBT, DST, bounded models, integration harness, and regressions. Remove superseded code and document the next-game extension points. Exit: the evidence below is present.

## 7. Definition of done

- Hearts is discoverable and playable through the real app, locally with bots and online at a four-seat table.
- Multi-deal play, passing, scoring, joint winners, reconnects, spectators, and rematches work end to end.
- Private information is protected at server serialization/delivery boundaries, including reconnect and replay surfaces.
- Shared code has no Hearts-specific rules and no residual assumption that every match has exactly two participants or one winner.
- Relevant existing consumers use improved shared contracts; their behavior and privacy tests still pass.
- Shared changes have implementation-level tests, not only isolated model/spec coverage.
- A future four-player hidden-information game can provide its own rules, observations, bot strategy, and rendering without reimplementing seats, rooms, private delivery, reconnects, or result persistence.

Do not add poker, deck-building, trading, tournaments, cryptographic fairness protocols, or a generic card-game DSL as part of this task.
