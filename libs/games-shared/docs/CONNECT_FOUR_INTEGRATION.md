# Turn-game integration

Product behavior is specified in [Connect Four](../../../specs/connect-four/)
and the [complete-game journey](../../../specs/journeys/connect-four-game.feature).
This checkout contains Chess; it has no Quoridor implementation.

## Composition and dependency direction

`GAME_DEFINITIONS` and `GAME_CLIENT_DEFINITIONS` register selectable siblings.
Each game provides its own deterministic rules and presentation adapter. The
composition root derives `TURN_GAMES` from the registered game definitions;
shared services receive that catalog
through an explicit port. No shared session, matchmaking, automated-opponent or turn-game module
imports Chess, Connect Four, chess.js, a concrete board, or a concrete catalog.
The rules contract and its modules have no UI-framework dependency.
The import boundary `import-game-implementation.grit` enforces that dependency
direction, including dynamic imports and re-exports.

`createGameSessionSub` owns shared synced reads, mutations, match tables,
topics and privacy contributions. Chess's manifest owns puzzle functionality.
The runtime composes `createGameSessionServer` separately from Chess's puzzle
server. No new database, room service, matchmaking service or deployment is
introduced. Both games use the existing permission decisions and mutation
replay, including local transactions and authoritative authenticated replay.

Games declare `GAME_ROOM_CAPABILITY`. Space composition installs that shared
capability once, independent of game order or whether Chess is registered.
The capability owns session configuration, bots, clocks, schedules, presence
reactions and history. Game selection remains limited to registered games.
An unrelated counting-race contract exercises this integration without Chess.
Host-local input uses the same eligibility as command confirmation, so solo
boards remain operable without a remote connection. Custom-game creation
receives the browsed game explicitly rather than depending on room selection,
which may not have been promoted while offline.

The UI receives board renderers, side labels, result descriptions and optional
orientation controls through the presentation contract. Shared gameplay and
replay screens treat positions and actions as opaque. Each adapter owns its
record codec; the shared export path does not format Chess notation. Notice
links share a single parameterized route that admits registered games.
Stored positions are checked against reconstructed accepted actions before
play and replay, rejecting inconsistent records without changing history.

Automated opponents receive `GameAutomation<Ui>` ports derived from the same
registry. The UI type is generic; the contract imports no driver or framework.
Each game owns its navigation controls, move policy and board gestures. Shared
activity, recovery, pause, queue and acknowledgement handling never interprets a
position or a side label. The controller resumes an existing game's menu before
choosing among offered games, and validates suggestions through the supplied
rules before touching controls. A counting-game surface verifies the lifecycle
without either production game. Chess's existing move policy lives with Chess's
rules, with unchanged seeded-choice and random-consumption regression checks.

## Existing records and protocol identities

Existing SQL table names and room, mutation, query and telemetry wire names
retain their established identities. Existing seat tokens `white` / `black`
and record fields `fen` / `uci` / `san` are opaque serialized slots in the
shared session contract; they do not imply chess rules, coordinates, notation
or visual identity. Renaming stored keys would change durable histories and
pending offline mutations. No deprecated API, alias or second implementation
is retained. Public module and permission identifiers are game-independent.

New Connect Four positions carry their classic ruleset version and ordered
columns. Decoding reconstructs every transition and rejects impossible or
post-completion histories. Time-control namespaces partition queues and
ratings; existing Chess controls retain their stored identities.

## Verification and operations

Shared test support lives in `game-session-harness` and
`game-matchmaking-harness`. Neither imports a concrete game or catalog; the
fixtures receive rules from the harness composition. Chess keeps its navigation
and board-specific gestures in its own adapters.

The new business examples use the existing Gherkin harness. The Quint model
binds to rendered room state, including connection loss and restoration.
Independent rule properties exercise legal games to completion, reconstruction,
reflection, invalid histories and bot legality. Edge fixtures include a winning
forty-second placement, intersecting lines, and longer alignments. A seeded
playing-strength check distinguishes planning from legal random selection.

Shared multiplayer contract tests cover concurrent, repeated, stale and
unauthorized turns, terminal finality, rematches and reconnection. The full-app
journey uses ordinary UI controls for search, automatic pairing and completion.
The same gestures drive the deployed health check, without test-only commands.
Reliable lifecycle telemetry retains the existing pipeline and includes the
namespaced time control for game attribution.

The health runner previously could not open two independently signed-in people.
Its shared monitoring port now admits exactly two fixed monitoring identities,
never arbitrary people. The second browser uses an owned isolated process so
Chrome's shared profile cannot mix identities. Process lifecycle and gesture
contracts cover cleanup and failed work. Production resources and deployment
configuration are unchanged.
