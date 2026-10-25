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

- **One private-state path.** `GameRules.setup` remains the per-side private
  state held only by its side and the authority. A setup is either *arranged*
  by its side before play (`accept`, `random`: Battleship) or *dealt* by the
  authority as the game starts (`deal`: Hearts). `resolve` returns the public
  action and any side's changed setup (`PrivateResolution`), so a dealt hand
  can change during play through the same withheld room event. `legal(position,
  side, setup)` lists a side's proposals knowing only its own setup, and the
  same function serves the room's validation, the board's affordances and bots.
- **Private commitments.** `setup.commit` declares a simultaneous phase: the
  sides that must each commit privately before play goes on. Each commitment is
  a withheld room event; the custom game shows only which sides committed. The
  room resolves all of them at once into one public action and the new setups.
  No commitment is a public turn, and no cryptographic protocol is involved.
- **Turns decided by the rules.** `GameRules.turnOrder: 'rules'` lets a game's
  rules name the next side (`PlayedPosition.turn`) instead of rotating seats;
  the alternation law and the alternation specifications apply only to
  rotating games.
- **Joint winners.** `PlayedPosition.winner` may name several sides; the
  custom-game outcome, status, history statistics and records read the winners
  of an outcome rather than one side.
- **Seat views for bots.** `GameBots.choose` receives the bot's seat (its side
  and its own setup), never another side's.
- **Stand-ins.** In a custom game of more than two sides, a person away for the
  away grace period is replaced by a disclosed stand-in bot playing their seat
  with their own private state; they take their seat back with a choice of
  their own. Only one controller acts for a seat at a time: a stand-in's wake
  is stale once its person takes the seat back, and the person's moves are
  refused while the stand-in plays.
- Hearts owns its deck, deal, passing, legal cards, tricks, hearts-breaking,
  scoring, match end, bots and table. Shared code never names it.

## Checklist

- [ ] Shared contracts: private state changes and commitments, turns by rules,
  joint winners, bot seat views; Battleship and secret pick migrated.
- [ ] Custom games: dealt setups at start, commitments, stand-ins and taking a
  seat back, joint-winner outcomes, board props for commitments.
- [ ] Hearts rules, bots, table, registration, harness adapter.
- [ ] Specifications: `specs/hearts/` rules and table behaviour; shared
  commitment and stand-in behaviour in `specs/games/`; a reduced Quint model.
- [ ] Privacy suites at the room boundary for hands and passes, spectators and
  late joins; noninterference over hidden cards.
- [ ] Properties: card conservation, passing, trick winners, scoring, rejected
  actions, determinism.
- [ ] Full verification and the final report.
