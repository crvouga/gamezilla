# Hearts implementation

Scope: the request in [HEARTS_GOAL.md](HEARTS_GOAL.md): a four-player Hearts
game used to harden the shared game framework. Product contracts live in
[Hearts](../specs/hearts/) and [Games](../specs/games/). This ledger tracks
the architecture decisions and unfinished work; it is not a second product
definition.

## Audit (baseline)

- Seats: `GameRules.sides` already declares two or four ordered seats; custom
  games, rosters, readiness, bots, clocks and four-seat matchmaking consume it
  (Quoridor's King of the Hill is the existing four-seat consumer).
- Privacy: Battleship's private setups are the one hidden-information path.
  A setup is a custom-game room event read only by its person
  (`RoomModule.audience`); the room withholds it before serialization on
  commit, welcome, catch-up and replay. The room resolves each proposal with
  every setup into the public action it records; positions stay public.
- Gaps Hearts needs, each documented as a limitation in
  `libs/games-shared-ts/docs/GAME_FRAMEWORK.md` ("Fit for future games"):
  private state that changes during play (a dealt hand, a pass), simultaneous
  decisions, turns the rules decide (a trick's winner leads), results with
  joint winners, and a disconnected seat in a game of more than two that blocks
  play indefinitely.
- Two-seat assumptions in shared code: `otherCustomGameSide`, two-seat result
  strings and history statistics (`'<side> wins by …'`), `requireTwoPlayerSide`
  in private setups, and the rules laws' strict alternation.

## Architecture

- **Dealt hands carry the private state.** Hearts uses `GameRules.hands`
  (shared with dealt-tile games): the hidden state is a 128-bit xoshiro128**
  shuffler plus each seat's held cards, dealt by the authority as the game
  starts and resolved by it on every proposal. `hand(hidden, side)` is all a
  seat, its board or its bot ever sees. Positions, labels and records stay
  public. Battleship keeps `GameRules.setup` (arranged before play).
- **Secret choices.** `hands.commit` declares a simultaneous private phase
  (the three-card pass): `sides`, `accept` (one side's choice from its own
  hand, or a reason), `resolve` (every choice into one public action and the
  new hidden state). Each choice is a withheld room event; everyone sees only
  who has chosen. No cryptographic protocol is involved.
- **Turns decided by the rules.** `GameRules.turnOrder: 'rules'`; the
  alternation law and the `rotating turns` specifications bind only rotating
  games.
- **Joint winners.** `GameWinner` may list several sides; custom-game
  outcomes (`white and red win by …`), status, records and history credit
  each. Matched games keep one winner or a draw.
- **Refusal reasons.** A dealt-hands or commitment refusal keeps the game's
  reason, told only to the proposer and worded by
  `GamePresentation.refusalDescription`.
- **Stand-ins.** In a custom game of more than two sides, a person away for
  the away grace period is replaced by a disclosed stand-in bot playing their
  seat with their own hand; they take the seat back (`reclaim`). Only one
  controller acts for a seat at a time.
- **Long games.** A match of 500+ actions stays linear: appended moves are
  `progressed` events, verified positions and parsed state are cached, the
  move list shows the latest 40 moves.
- **Custom games only.** `defineGame` refuses matchmaking for a game with
  `hands.commit` or `turnOrder: 'rules'`: ratings compare one winner, and
  the matched abort window and clocks assume rotation.
- Hearts owns its deck, deal, passing, legal cards, tricks, hearts-breaking,
  scoring, match end, bots and table. Shared code never names it.

## Hardening (2026-10-25)

An audit of rules, privacy and authority, the shared framework and the
client found no leak of a hand, a pass or the hidden state. Fixed, each with
a `// regression:` test and a `known-bugs` entry:

- Authority: the creator could choose the move a stand-in made for an away
  person's side (`stand-in-move-chosen-by-creator`); only the room decides
  for a stand-in now.
- Stand-ins followed the spec's conditions only in part: none while the host
  is away (and a pause no longer counts as time away), none without another
  person here (`stand-in-while-host-away`, `stand-in-without-another-person`).
- Rosters are two or four seats again, as the glossary says (the change to
  two to four had no consumer here).
- Matched deals drew from four numbers repeated (`matched-deal-four-draws`);
  rooms now seed deals from the platform's cryptographic source, not
  `Math.random`.
- The Hearts position reader refuses positions play never reaches
  (`hearts-unreachable-position`).
- Laws: every turn and result names the game's seats, a matched game never
  has joint winners, a result naming every seat counts as a draw, and the
  bot law's commitment allowance holds only while sides commit. King of the
  Hill's bot replies are checked against its legal moves again.
- Board: a refused pass keeps its cards, a pass made by a stand-in shows
  only its cards, a refused card says why, focus stays in the hand, the
  pass shows its progress, suits are localized, play cards are not toggles,
  the end names scores and winners, the table says what the last deal
  added, and a reviewed move shows no live hand
  (`card-table-*`, `hearts-refused-pass-loses-cards`,
  `hearts-pass-merges-selection`, `hearts-final-scores-unnamed`).

Remaining risks:

- The later deals come from xoshiro128**, which is not a cryptographic
  generator. The cards a match reveals are evidence about its state, so a
  determined solver might predict later deals. Replacing it (a keyed hash in
  counter mode from `@noble/hashes`) changes every pinned later deal in
  `libs/hearts-harness-ts`, so it is a task of its own.
- The 13th trick of a deal is not shown: the position keeps only what the
  deal added to each score. Showing the trick needs the public position to
  carry it.
- While a deal awaits passes the framework still names South as the side to
  move (`PlayedPosition.turn` must name a side); nothing shows or times it.
- [Stand-ins and a participant without a connection](statecharts/SPEC_CONFLICTS.md)
  is unresolved between two specs.

## Checklist

- [x] Shared contracts: dealt-hands commitments, turns by rules, joint
  winners, refusal reasons, bot seat views; existing games and the test
  consumers migrated.
- [x] Custom games: deal at start, commitments, stand-ins and taking a seat
  back, joint-winner outcomes, board props for commitments, solo practice
  (also offline).
- [x] Hearts rules, bots, table (`CardTable` in the design system),
  registration, harness adapter.
- [x] Specifications: `specs/hearts/`; `specs/games/secret-choices.feature`,
  `multi-seat-stand-ins.feature`, `shared-victories.feature`; the reduced
  model `specs/games/secret-choices.qnt`.
- [x] Privacy at the room boundary for hands and passes, spectators and late
  joins (the dealt-hands privacy suites and the secret-choice scenarios).
- [x] Properties: card conservation, passing, trick winners, scoring,
  rejected actions, determinism (`libs/hearts-shared-ts/tests/properties.test.ts`).
- [x] Probes and framework docs updated (`turn-order`, `results`;
  `GAME_FRAMEWORK.md`, `ADDING_A_GAME.md`).
- [ ] Full `bun verify` and live release verification.
