# Word Tiles

An original crossword tile game for two to four people. Product behavior is
specified in [`specs/word-tiles/`](../../../specs/word-tiles/) and, for what
every game shares, [`specs/games/`](../../../specs/games/); this file records
the decisions behind the game and where each piece lives. It is not a second
product definition.

## Modes

Three registered modes share one implementation
([`word-tiles-game.ts`](../src/word-tiles-game.ts)):

| Mode | Seats | Capabilities |
| --- | --- | --- |
| `word-tiles` | 2 | Custom games with people and bots, finding an opponent (`word-tiles/` clocks), history, one-move challenges |
| `word-tiles-3` | 3 | Custom games with people and bots, history |
| `word-tiles-4` | 4 | Custom games with people and bots, history |

Seats are the platform's, in order `white`, `black`, `red`, `blue`; the first
seat always moves first.

## The ruleset

Every number lives in [`word-tiles-ruleset.ts`](../src/word-tiles-ruleset.ts)
as ruleset `r1`, which every position and puzzle pins:

- 15 × 15 board; racks of 7; 100 tiles including 2 blanks
  ([`word-tiles-tiles.ts`](../src/word-tiles-tiles.ts), counts and points as
  data; a tile's identity is its index in that table).
- A placement is one complete move: its tiles lie in one line with no gap
  (counting tiles already on the board), the first covers the centre square,
  later ones join the board, and every word formed is in the pinned word list.
- Bonus squares count only on the turn a tile covers them; all seven tiles in
  one placement add 50.
- Passing, or exchanging when the bag holds at least seven tiles, scores
  nothing. Six scoreless turns in a row end the game.
- Going out (an empty rack with an empty bag) ends the game: every other seat
  loses the value of its rack, and the seat that went out gains their total.
  After six scoreless turns every seat loses its own rack value.
- The highest score wins. Equal leaders share the win; the platform records a
  shared win as a draw, and the scores show who shared it.
- Resigning or a clock running out: with two seats the other seat wins; with
  three or four the game ends as a draw for everyone
  (`participant withdrew`), since the platform names one winner or a draw.

These are this game's product decisions, not a claim of tournament
compliance.

## The board

[`word-tiles-board.ts`](../src/word-tiles-board.ts) gives an original layout
once for one eighth of the board and reflects it across the middle row, middle
column and diagonals, so it is symmetric by construction: 8 triple-word,
13 double-word (the centre among them), 12 triple-letter and 28 double-letter
squares. Every square's printed name and state are in its accessible label.

## The word list

The production lexicon is ENABLE (`enable1.txt`, ENABLE2K revision, by Alan
Beale and M. Cooper), which its authors dedicated to the public domain, so it
may be shipped, stored offline and indexed commercially without further
permission ([`word-tiles-lexicon-source.ts`](../src/word-tiles-lexicon-source.ts)).

- **Pinned.** The source file's SHA-256 is pinned; `scripts/build-lexicon.ts`
  refuses a changed upstream file. Words of 2 to 15 letters A–Z remain:
  168,551 of 172,823 lines.
- **Versioned.** A position and a puzzle pin the lexicon `key`
  (`enable1.90ef7a729517`, from the canonical list's SHA-256). Changing the
  default never changes what an existing match or puzzle accepts; a retired
  list stays in the catalogue while content names it.
- **Offline.** The list ships front-coded with the app
  ([`word-tiles-lexicon-enable-data.ts`](../src/word-tiles-lexicon-enable-data.ts),
  generated, about 220 KB compressed): the client imports its code eagerly
  and its offline shell precaches everything the client can load, so a
  separate chunk would save nothing. It is checked against its artifact
  SHA-256 and decoded into a typed-array trie only when a game first needs
  it. The authority and the API server load it through `GameRules.prepare`.
- **Notice.** The game's instructions show the list's name and notice.

## Hidden information

The bag order and every rack are dealt hidden state
([`word-tiles-hidden.ts`](../src/word-tiles-hidden.ts),
[`word-tiles-authority.ts`](../src/word-tiles-authority.ts)): a 128-bit seed
from four authority draws drives a xoshiro128** generator kept in the hidden
state, so no seat can search for the bag from what it sees. Proposals name
tiles of the proposer's own rack (`play:h8=12.i8=98E`); the authority checks
and scores them and records a public action with letters only
(`play:h8C.i8e`). The framework side is
[Dealt hands](../../games-shared-ts/docs/GAME_FRAMEWORK.md#dealt-hands-gameruleshands).

## Bots

Bots see their own rack, the public position and the word list, and propose
like a person. [`word-tiles-moves.ts`](../src/word-tiles-moves.ts) generates
placements from anchors and cross-checks over the trie within a step budget;
its tests compare it with an exhaustive reference on small boards.
[`word-tiles-bot.ts`](../src/word-tiles-bot.ts) sets the strengths: easy
(5,000 steps, a lower-scoring move at random), medium (40,000, one of the
three best) and hard (300,000, the best score, then the better tiles kept).

## One-move challenges

Through the shared puzzle content system
([`word-tiles-puzzle.ts`](../src/word-tiles-puzzle.ts)): a frozen board, a
rack and a target; one placement scoring at least the target solves it.
Publication requires a witness placement the rules accept. The game ships an
original introductory pack of five
([`word-tiles-starter.ts`](../src/word-tiles-starter.ts)), proven and
published once when migrations run.

## Where it is verified

- Rules, scoring, authority, move generation and puzzles:
  `libs/word-tiles-shared-ts/tests`.
- The game's own specifications, on a rules-level table:
  `libs/word-tiles-harness-ts` (`bun run test:spec`).
- Every shared specification, law and suite the game's capabilities bind,
  including the dealt-hands privacy suites: `libs/games-harness-ts`.
- The board, rack and candidate move: `libs/word-tiles-client-ts/tests` and
  `pkgs/ui-root-harness-ts/tests/word-tile-board.test.tsx`.

## Known limits

- No Quint model of Word Tiles' own rules; the shared custom-game and
  matched-game models hold for it.
- Three and four seats are covered by the shared custom-game and history
  suites; finding an opponent is offered for two.
- Practice against bots runs on the creator's device, also offline, which
  therefore holds that game's bag and the bots' racks; with another person
  at the table nothing hidden reaches any device.
- The specific reason a placement is refused is shown by the board's own
  preview; the authority reports a refusal as an illegal move.
