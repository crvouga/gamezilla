# Adding a puzzle game

Use `puzzleContent` for author-created puzzles, shared builders, published
editions, packs and saved attempts. Product behavior belongs to
[`specs/puzzles/`](../../../specs/puzzles/); a game's own rules belong to its
context. This guide describes the implementation boundary.

Numberlink is the production example. The existing
[`ADDING_A_GAME.md`](ADDING_A_GAME.md) describes turn games and their optional
rated, line-based puzzle feed (`capabilities.puzzles`). A game can supply
either puzzle capability, both, or puzzle content alongside turn play.

## Supply the rules

Implement [`PuzzleContent`](../../../pkgs/turn-game-shared-ts/src/puzzle-content.ts)
in the game's shared package. Definitions, actions and saved states are opaque
strings owned by the game. Decode and validate them at the boundary, including
untrusted or previously saved input. Keep their durable encodings readable as
the implementation evolves.

The required `rules` validate definitions and states, create an initial state,
apply one action, and decide completion. They receive no board dimensions,
seats, turn order or known solution from the framework. Use the same rules in
the editor, player, publication checks and any solver. Numberlink's
[`numberlink-puzzle-content.ts`](../../numberlink-shared-ts/src/numberlink-puzzle-content.ts)
shows the complete adapter.

Offer only the optional computations the game implements: snapshot history,
a solver, publication validation and completion statistics. A bounded solver
can return `inconclusive`; that does not mean `unsolvable`. The publication
validator can accept a completed playtest as proof. Keep expensive or
game-specific search inside that game.

## Register the shared and client parts

A standalone puzzle uses `defineGame` from
`@libs/game-session-shared-ts/game-definition`, with `id` and `puzzleContent`.
See [`numberlink-game.ts`](../../numberlink-shared-ts/src/numberlink-game.ts).
For a game that also offers turns, pass the same `puzzleContent` property to
`defineTurnGame`; the two capabilities are independent.

Use `defineGameClient` with the shared registration and a
[`PuzzleContentClient`](../../game-puzzle-client-ts/src/puzzle-content-client.ts):

- `Player` receives a definition, saved state, disabled state and `onAction`.
  Emit the game's encoded action; the shared player owns persistence and
  attempt history. Provisional gestures can remain local until accepted.
- Optional `authoring` supplies `initialDefinition` and `Editor`. The editor
  emits a complete definition through `onChange`; the shared authoring shell
  owns metadata, autosave, validation, playtesting and publication.
- Optional `Preview` renders the definition without writes.

Read Solid props reactively and honor `disabled`. Compose the design system;
game-specific rendering belongs in a component package when it needs custom
markup. The working registration is
[`numberlink-game-client.tsx`](../../numberlink-client-ts/src/numberlink-game-client.tsx).

Add the shared and client registrations to `GAME_DEFINITIONS` and
`GAME_CLIENT_DEFINITIONS`, with their workspace dependencies. Registration
checks require the matching player and validate any advertised authoring and
preview components. `TURN_GAME_DEFINITIONS` and `TURN_GAMES` derive only actual
turn games; a standalone puzzle needs no multiplayer fixtures, opponent,
clock, automation or `HARNESS_GAMES` entry. Package setup and dependency rules
remain those in [`ADDING_A_GAME.md`](ADDING_A_GAME.md).

## Ship starter content

A game can ship original puzzles of its own in `puzzleContent.starter`
([`StarterContent`](../../../pkgs/turn-game-shared-ts/src/puzzle-content.ts)):
a pack and its puzzles, each with a stable `id` and a `witness`, a completed
state the game's publication check accepts. Registration checks the shape;
`seedStarterContent` re-proves every witness and publishes each puzzle and
the pack once, as immutable first editions owned by `starter-content`, when
migrations run (and in the harness's game system). Seeding again changes
nothing; it writes nothing at all if any witness fails. Word Tiles' one-move
challenges are the example
([`word-tiles-starter.ts`](../../word-tiles-shared-ts/src/word-tiles-starter.ts)).

## Reuse the shared lifecycle

The runtime already passes the registrations into spaces and
`gamePuzzleSubs(GAME_DEFINITIONS)`. The latter installs the shared tables,
queries, topics, privacy contribution and mutation factories with the actual
game rules. The normal game menu supplies the shared content screens.

Keep storage and workflows in `@libs/game-puzzle-shared-ts` and
`@libs/game-puzzle-client-ts`. Do not add game-specific tables, REST writes,
pack editors or progression stores. Shared mutation replay calls the game's
rules on both the local and server paths. Access remains a central permission
decision.

The storage separates working documents and private draft copies from public
publication records and immutable editions. Pack editions hold ordered edition
references; attempts pin an edition and retain their history. Expected-head
checks preserve competing drafts, pack orders and attempt continuations instead
of silently replacing them. The same shared screens surface those kept copies.
Consult the [Puzzles specifications](../../../specs/puzzles/) for the exact
publication, conflict and availability rules.

Screens acquire bounded subscriptions for the selected content and page their
catalogue and personal history. Reuse those entry hooks rather than holding
the entire public catalogue or all saved histories open for a session.

## Verify the extension

Add the game's rule specifications and deterministic harness, properties for
its codecs and rule invariants, and input contracts for its renderer. Follow
the repository's spec workflow; scenario steps use exported harness actions
and observations. Add a whole app journey when a new interaction is not
already reached by the shared coverage. Run `bun verify` before declaring the
change complete, plus the applicable deeper profile. Nothing is verified by
hand.

The shared framework is held to a non-grid counting app:
[`example-app-rules.ts`](../../game-puzzle-harness-ts/src/example-app-rules.ts)
and [`content-example-client.tsx`](../../game-puzzle-harness-ts/src/content-example-client.tsx).
Its seven lifecycle models replay through the real sync and mutation paths.
A separate
[`box-pushing rules consumer`](../../../pkgs/turn-game-shared-ts/tests/warehouse-puzzle.ts)
checks that the core contract also accepts a different action/state structure;
it is a test consumer, not a shipped Sokoban game. A new game should reuse the
shared lifecycle evidence and supply its own rules, rendering, editor and
game-specific interaction evidence.
