# Adding a puzzle game

Use `puzzleContent` for author-created puzzles, shared builders, published
editions, packs and saved attempts. Product behavior belongs to
[`specs/puzzles/`](../../../specs/puzzles/); a game's own rules belong to its
context. This guide describes the implementation boundary.

Numberlink and Sokoban are the production examples: one draws paths, the
other moves a piece square by square, and both use the same lifecycle. The existing
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

Declare `rulesVersion`, a positive integer. Editions and attempts keep the
version they were published or started under; raise it only when a change
would make an already published edition play differently. The platform then
refuses to start or continue the older editions, says the puzzle needs a
version of the app with its rules, and keeps every saved attempt.

Offer only the optional computations the game implements: snapshot history,
a solver, publication validation, completion statistics and bundled packs. A
bounded solver can return `inconclusive`; that does not mean `unsolvable`.
Keep expensive or game-specific search inside that game.

Publication evidence is never a claimed result. A completed playtest is
replayed by the authority from `rules.initial` through `rules.apply` against
exactly the definition being published, under the current rules version,
before `validatePublication(definition, evidence)` sees it. A game that needs
proof (Sokoban) refuses when `evidence` is absent; a game whose finished state
proves itself can accept it, and one that can search (Numberlink) may fall
back to its solver. Details-only edits keep the evidence; any change to the
definition needs a new playtest.

Bundled packs (`bundledPacks`) ship with the game: ordered puzzles with a
witness of accepted actions, checked at registration. They appear in every
device's library offline, guests included, and use the ordinary attempts and
pack progress. Changing one gives it a new edition identity.

Snapshot histories keep a state only at keyframes and the cursor, so many
small moves stay cheap to save and sync; undo and redo replay at most one
keyframe interval.

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
  emits a complete definition through `onChange`, including unfinished ones it
  can reopen; the shared authoring shell owns metadata, autosave, undo and
  redo of every draft edit, validation, proof status, playtesting and
  publication. The editor owns its tools and rules-specific diagnostics.
- Optional `Preview` renders the definition without writes.

Read Solid props reactively and honor `disabled`. Compose the design system;
game-specific rendering belongs in a component package when it needs custom
markup. The working registration is
[`numberlink-game-client.tsx`](../../numberlink-client-ts/src/numberlink-game-client.tsx).

Add the shared and client registrations to `GAME_DEFINITIONS` and
`GAME_CLIENT_DEFINITIONS`, with their workspace dependencies. Registration
checks require the matching player and validate any advertised authoring and
preview components. `PLAYABLE_GAME_DEFINITIONS` and `TURN_GAMES` derive only actual
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

Add the game's rule specifications and properties for its codecs and rule
invariants. Compose its harness world from the shared one rather than a world
of its own: `createContentWorld` with a `ContentHarnessGame` (its rules under a
run's rules version, its client parts and `createContentApp`) gives four
devices over the real sub, sync engine and shared screens, with the builder
session, offline, reopening and rules-change actions. Read what devices hold
through `content-game-reads` (`@libs/game-puzzle-harness-ts`), never the
platform's storage modules. Whole-app journeys reuse the shared journey
helpers with a `ContentJourneyBoard` (edit, preview, solve) for the game. The
Sokoban harness (`libs/sokoban-harness-ts`) binds every Sokoban feature and
model this way. Follow the repository's spec workflow and run `bun verify`
before declaring the change complete, plus the applicable deeper profile.
Nothing is verified by hand.

The shared framework is also held to a non-grid counting app:
[`example-app-rules.ts`](../../game-puzzle-harness-ts/src/example-app-rules.ts)
and [`content-example-client.tsx`](../../game-puzzle-harness-ts/src/content-example-client.tsx).
Its lifecycle models replay through the real sync and mutation paths.

### Adding the next game

For a game such as Unblock Me, implement only: a `PuzzleContent` (definition
and state codecs, `apply`, `complete`, `rulesVersion`, optionally
`validatePublication`, `statistics`, `bundledPacks`), a `defineGame`
registration, a client with `Player`, `Preview` and an `Editor` composed from
the design system (adding a component there only if none fits), its rule
specifications, properties and harness game. Drafts, undo and redo,
playtests, proof, publication, packs, discovery, attempts, progression,
offline storage and sync come from the platform unchanged.
