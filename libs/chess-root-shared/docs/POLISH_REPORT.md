# Chess polish report

Unattended run on branch `chore/chess-polish`, 2026-10-11. Nothing was pushed
or merged. The work is seven commits on top of `7d3a6b25b`:

| Commit | What |
| --- | --- |
| `e7b2e12f9` | `spec:` daily games, turn notices, result notices |
| `1e792b52d` | `fix(chess):` one checkmating-material rule, two board status bugs |
| `ac569f2dd` | `feat(chess):` daily games with turn notices and result notices |
| `4fdf1d7a0` | `fix(tools):` register the multiplayer link route with the product map |
| `b4d50536e` | `spec:` low on time, turn reminders, reviewing moves, game records, flipping the board |
| `048e589d6` | `feat(chess):` the five capabilities above |
| this commit | `docs:` this report |

"The chess game" was read as every `pkgs/chess-*` and `libs/chess-*` package:
puzzles, Custom Games and multiplayer chess. Most of the run went to
multiplayer chess, because the mid-run request (long-running games with
turn notifications, defined in `specs/`) lives there.

## 1. What changed

### Long-running games and turn notifications (the mid-run request)

- **Daily games.** Multiplayer chess offers 1, 3 and 7 days per move as a
  fifth speed, daily, with its own rating. The clock runs from the start, a
  move hands the full days to the other person, a missed first move aborts,
  and running out of time loses (or draws when the opponent cannot
  checkmate). A daily game follows the account, so leaving a space, closing
  the app or changing device never ends or pauses it.
- **Turn notices.** The person to move finds one notice per daily game in
  their inbox. It comes back unread on each new turn and leaves when they
  move or the game ends. Live time controls never produce one.
- **Turn reminders.** When the person to move is low on time (6 hours left at
  1 day per move, 1 day left at 3 or 7), the same notice comes back unread
  with the time left.
- **Result notices.** Both people get one when a daily game is over or
  aborted, and each keeps theirs until they dismiss it.
- **Opening a notice** goes to multiplayer chess in the person's own space,
  creating a space when they host none.
- **Specs.** Every game's now: `specs/games/matched-game-daily`,
  `matched-game-daily-clock`, `matched-game-turn-notices`,
  `matched-game-result-notices` and `matched-game-turn-reminders`, the
  model `matched-game-daily.qnt`, and the Games terms `daily game`, `turn
  notice`, `turn reminder` and `result notice`. Friends publishes `inbox`
  so a game may put items there.

### Priority 1: rules correctness

- One `canCheckmate` rule (FIDE 6.9) in `@pkgs/chess-rules-shared`, replacing
  two diverging copies. See bugs 1 and 2.
- New wrapper tests: castling rights and attacked squares on both wings and
  both colours, en passant and the king (rank pin, discovered check, only way
  out of check), promotion outcomes, threefold repetition (including
  different castling rights and en-passant state), the fifty-move rule (99
  no, 100 yes, counter reset), insufficient material.
- Perft to depth 5 matches the published counts for all six standard
  positions. This was a one-off run, not a committed test: the committed
  perft suite deliberately stops below 10k leaf nodes, because deeper counts
  re-verify chess.js rather than our wrapper.

  | Position | Depth 5 nodes | Seconds |
  | --- | --- | --- |
  | Start | 4,865,609 | 3 |
  | Kiwipete | 193,690,690 | 125 |
  | Position 3 | 674,624 | 1 |
  | Position 4 | 15,833,292 | 19 |
  | Position 5 | 89,941,194 | 62 |
  | Position 6 | 164,075,551 | 113 |

### Priority 2: core play feel

- Low on time warning sound, once per game, for the clock's owner only.
- Flip board on multiplayer boards.
- Already in place and left alone: drag and click-to-move on mouse and touch,
  legal-move dots and capture rings, last-move and check highlights,
  interruptible 150 ms move animation, promotion picker with all four
  pieces, coordinates, and move, capture, check, castle, promote, illegal and
  game-end sounds behind the app's mute setting.

### Priority 3: game flow

- Daily time controls, as above. Live clocks were already
  server-authoritative and computed from timestamps, so they cannot drift in
  a background tab.
- A running clock is shown as low on time: 10, 20, 30 and 60 seconds for
  bullet, blitz, rapid and classical; 6 hours or 1 day in a daily game.
- A game that ends mid-turn now stops its clock at the time actually left.
  See bug 5.

### Priority 4: move list and analysis

- The multiplayer move list is now a list of moves anyone seeing the game can
  choose, with step back, step forward, start and return controls and the
  left and right arrow keys. An earlier position is for reviewing only.
- Once a game is over with a result, its game record (standard PGN, names as
  the viewer sees them now) and its final position (FEN) can be copied.

### Priority 5 and 6: polish and accessibility

- A low clock uses a fill plus a mark, so colour is never the only sign, and
  its label says "low on time".
- A daily clock reads `2d 5h` on screen and "2 days 5 hours" to a listener.
- Promotion announcements name the pawn. See bug 3.
- A listener is told which earlier position they are reviewing.

## 2. Bugs found and fixed

| # | Bug | Verified by |
| --- | --- | --- |
| 1 | Multiplayer scored a loss on time against a lone knight when the flagged side had only queens (`4k3/8/8/8/8/2n5/8/Q3K3 w`). It is a draw. | Failing-first example test `libs/game-matchmaking-shared/tests/multiplayer-clock.test.ts`, pinned `chess-timeout-lone-knight-vs-queens`. An enumeration of every placement found no mate for N v Q or N v QQ. |
| 2 | Same for a lone bishop against only rooks or queens (`4k3/8/8/8/8/1b6/8/R3K3 w`). | Same file, pinned `chess-timeout-lone-bishop-vs-major-piece`. |
| 3 | A promotion was announced to screen readers as "Queen to a8, promotes to Queen". | Failing-first DOM test `pkgs/chess-board-root-client/tests/chess-board-announcement.test.tsx`, pinned `chess-board-promotion-announced-as-promoted-piece`. |
| 4 | A mating hundredth half-move left the board status both checkmated and drawn. No visible effect was found: every reader checks checkmate first. | `pkgs/chess-board-core-shared/tests/game-status.test.ts`, pinned `chess-board-mate-on-hundredth-half-move-also-drawn`. |
| 5 | A multiplayer game that ended mid-turn showed the clock jumping back to its start-of-turn value (resigning 10 seconds into a 5+0 turn showed 5:00). Affects every multiplayer game, not only daily. | `daily-game.qnt` fails 8 traces without the fix; pinned `chess-finished-game-clock-resets`. |
| 6 | Tapping an inbox card with no connection threw an unhandled rejection. | Scenario "Opening a turn notice while offline shows the last known multiplayer board and leaves it unread". No separate regression pin. |
| 7 | Reading, archiving or dismissing an inbox item never reached the person's own devices until something else synced. | Scenario "Opening a turn notice does not make the move" (the notice is no longer unread). No separate regression pin. |

Bugs 6 and 7 are in the inbox, outside the chess packages. They have
scenario coverage but no `known-bugs` file; add one if you keep the fixes.

## 3. Decisions made without asking

1. **No new branch.** The brief asked for `polish/chess-overnight`. The repo
   forbids agents creating branches, so the work stayed on this worktree's
   branch. It was renamed to `chore/chess-polish` during the run, not by
   the agent.
2. **No Playwright play-throughs or screenshots.** The repo's rule is that
   nothing is verified by hand, so every behavior is a scenario or a model
   run on virtual time. No visual check of the new UI was made; see section 5.
3. **Daily games are a speed of multiplayer chess**, not a new product. A
   daily game still counts as the account's one unfinished multiplayer game.
4. **Notices are inbox items only.** Nothing is delivered outside the app.
5. **Daily time controls are 1, 3 and 7 days per move**, with no banked time
   and no increment.
6. **Both people get a result notice**, including the one whose own move
   ended the game. It is simpler to state and acts as a receipt.
7. **Low on time limits** are fixed per speed rather than a fraction of the
   time control.
8. **No game record while a game is unfinished**, so nobody is handed an easy
   way to consult a chess program mid-game.
9. **A flip does not carry into a new game.**
10. **Perft depth 5 is evidence, not a test**, to keep the suite fast.
11. **Notice text is English written on the server**, as friend-request
    notices already are.
12. **Repo-wide `bun fmt` was not run.** It rewrites about 48 unrelated
    files. Touched files were formatted with Biome directly.
13. **A shared step changed meaning.** `Given {actor} is hosting a space` is
    now idempotent, because a notice scenario states it for someone the
    background already gave a space.

## 4. Gap report against chess.com and lichess

Ranked by player impact. Estimates assume the repo's spec-first workflow.

| # | Gap | Why it matters | Effort |
| --- | --- | --- | --- |
| 1 | **Turn alerts outside the app** (phone or browser push, or e-mail). | A daily game depends on people learning it is their move while the app is closed. Today they learn when they next open it. | 1 to 2 weeks. Needs push credentials and a subscription store declared in `libs/infra-shared/tofu`, a service-worker handler, a native path, and a per-person off switch. Human decisions on providers come first. |
| 2 | **Several unfinished games at once.** | Daily players run many games. Today one daily game blocks all other multiplayer play for days. | 1 to 2 weeks. `chess_multiplayer_players` holds one game per person; the limit DMN, `multiplayer-games.als`, `multiplayer.qnt` and the client's "current game" all assume one. |
| 3 | **Engine analysis**: evaluation bar, best-move arrows, accuracy, blunder markers. | The main reason people review games on both sites. | 2 to 3 weeks. Needs Stockfish as WebAssembly (a new dependency and a worker), a review screen, and specs. |
| 4 | **Bots with difficulty levels.** | Custom Game bots play a random legal move. | 1 week on top of gap 3's engine. |
| 5 | **Premoves in multiplayer.** | Expected in bullet and blitz. | 2 to 4 days. The board already supports them; multiplayer passes `premoves={false}`. Needs scenarios for a premove against a server-decided board. Known board gaps: no same-piece chains, no single-premove cancel. |
| 6 | **Takeback requests.** | Standard in casual play. | 3 to 5 days, both multiplayer and Custom Games. |
| 7 | **Game history.** | People expect a list of past games. Only the most recent multiplayer game is reachable. | 1 week. Rows are already kept. |
| 8 | **Drawing arrows and marking squares on app boards.** | Thinking aid on both sites. | 1 to 2 days. The board supports it (`enableUserArrows`); the chess context must first borrow the board's vocabulary. Mouse only: there is no touch gesture. |
| 9 | **Board and piece themes.** | Personalisation. | 3 to 5 days. One theme and one piece set (Cburnett) exist; no picker. Conflicts with the neutral-palette rule, so it needs a design decision. |
| 10 | **Opening a game record or position from elsewhere** (PGN and FEN import). | Needs an analysis board, which does not exist. | With gap 3. |
| 11 | **Clock delay** (Bronstein or simple). | Rare online; increment covers most needs. | 2 days. |
| 12 | **Custom Game parity with multiplayer**: draw reasons ("Game drawn." for every draw), low on time, flip, game record, keyboard arrows in its move list, a jump control that is not a raw number field. | Consistency. | 3 to 5 days. |
| 13 | **Daily game extras**: vacation or pause, conditional moves, a draw-offer notice, a choice of which notices to receive. | Common on both sites. | 1 week. |
| 14 | **Settings.** Chess Settings lists only developer tools: no sound, coordinates or board options. | Expected. | 2 to 3 days. |
| 15 | **Localised notice text.** | Notices are English only. | 1 to 2 days: send a message key and render on the client. |
| 16 | **Puzzle modes**: Streak, Storm, Rush. | Already listed as planned in `specs/README.md`. | Not estimated here. |
| 17 | **Board accessibility leftovers**: typed move entry, the origin square in announcements, announcements are hard-coded English, two tab stops on the board. | Screen-reader and keyboard users. | 3 to 4 days. |
| 18 | **Loading states.** Multiplayer and Custom Game screens show no loading state while the first sync arrives. | Brief blank on slow connections. | 1 day. |

## 5. Review these first

1. **Nobody has looked at the new UI.** The low clock, the Moves section
   (step controls, flip, game record field), the reviewing notice and the
   notice link screen are verified by scenarios only. The game record field
   shows the whole PGN as its value, which gets long.
2. **`@pkgs/ui` changed.** `GameClock` gained a `low` state that uses the
   destructive fill; check it against the neutral-palette rule. `Button`
   passes `aria-pressed` and `aria-current`. `CopyToClipboardField` takes a
   data set for its trigger. The Game Arena example does not show the low
   state.
3. **The inbox changed outside chess.** Publishing can now bring a
   notification back unread (`resurface`), and the read, archive and dismiss
   routes push to the person's own devices. `@libs/notifications-server` has
   no tests of its own.
4. **`stopMultiplayerClock` changes every multiplayer game's final clocks**,
   not only daily ones.
5. **Outbox events with far-off due times.** A 7-day game schedules its
   deadline and its reminder up to 7 days ahead. This relies on the scheduled
   sweep delivering old events reliably in production; it has only run on
   virtual time.
6. **A daily game locks the account out of live play** until it ends (gap 2).
   Decide whether to ship daily games before that is lifted.
7. **`game-matchmaking-shared` now imports `@libs/notifications-shared`**
   for notice ids and the dismiss helper. Lint accepts it; confirm it fits
   the rule that sibling subs do not import each other.
8. **One weak example.** "A piece cannot be moved on an earlier position"
   tries a White move on a Black-to-move position, which the board would
   refuse anyway. The step asserts non-interactivity through the board's own
   state, but a White-to-move example would stand on its own.
9. **Glossary wording** for `daily game`, `turn notice`, `turn reminder`,
   `result notice`, `low on time`, `game record`, `earlier position` and
   `flip the board` was confirmed by the agent on the owner's behalf.

## 6. Verification

- New scenarios: 134 passing runs across nine feature files (outline rows
  counted separately), each file re-run by the orchestrating session after
  the implementing agent reported green.
- Models: `daily-game.qnt` (20 pass) and `multiplayer-own-board.qnt`
  (52 pass); `multiplayer.qnt` and `multiplayer-spaces.qnt` still pass.
- `tc`, `lint` and `test` pass for every touched package.
- `bun run spec:verify` and `bun run spec:ownership` pass.
- **Full chess spec suite** (all 64 parts of `@libs/chess-root-harness`, run
  after the last commit, 22 m 41 s): every feature passes and 50 parts are
  green. The 14 red parts contain 18 failing model traces and nothing else.
  All 18 fail identically on the base commit `7d3a6b25b`, re-run there to
  confirm, so none is a regression:

  | Model | Failing traces | Same on base |
  | --- | --- | --- |
  | `custom-game-play.qnt` | 6, 11, 25, 29, 31 | yes |
  | `custom-game-control.qnt` | 2 | yes |
  | `puzzle-attempt.qnt` | 10 | yes |
  | `custom-game.qnt` | 211 | yes |

  They share one divergence: the model expects a guest who is offline to
  drop out of the space after time passes, and the product keeps showing
  them the game. That is a spaces behavior outside this work.

Two earlier attempts at the full suite were discarded: the first ran all 64
parts at once, and the second overlapped another project's test run on the
same machine. Both produced timeouts in unrelated tests.

Also red before this work, and left alone:

- `bun run ci:statecharts` fails on `personal-chess-stats-client`, a route
  module missing from its list.
- `libs/tools/scripts/verify-goals.ts` fails on
  `space-lobby-card-not-pressable`.
- `bun run lint:naming` fails on `.agents/skills/ui-ux-pro-max/**`.

`bun verify`, the full local gate across the whole repo, was not run. With
the reds above it cannot be green on this branch or on `main`.
