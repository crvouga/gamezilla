# Sokoban specification audit

Date: 2026-10-24. Scope: `specs/sokoban/` (new context), the shared edition
rules in `specs/puzzles/edition-rules.feature` and `edition-rules.qnt`, the
journey `specs/journeys/sokoban-packs.feature`, and the glossary, manifest
and rulebook rows they need.

Verdict: INCOMPLETE. The touched specs have no blocking findings. The
whole-repository gate still fails outside this scope: Quoridor's
"continues" (a Puzzles `resume` form) at `quoridor-objectives.feature:15/28/35`,
and thirteen near-duplicate step wordings in other packages under
`--strict-duplicates`. Both were already failing before this change. The rest
of the gate output is the implementer's handoff: undefined steps, unbound
models, and the Sokoban harness package's missing `verify:models` script and
step and model entry points.

## Example map

| Feature | Rules (+ allowed / − refused or boundary) |
| --- | --- |
| move-and-push | step onto floor + / wall, outside, edge −; push onto floor + / wall beyond, two crates −, stepping away never pulls; counts: steps and pushes counted separately + / refused push counts nothing − |
| complete-puzzles | last crate on a goal + / one crate away from a goal; crates starting on goals complete at once + / one starting away; completed only once (redo, undo); restart to the starting position + keeps completion / restart before any move changes nothing − |
| undo-and-redo-moves | undo restores crate and counts + / nothing to undo −; redo restores + / new move removes redo − |
| build-boards | 20 by 20 + / 21 columns, 21 rows −; smaller board removes and names crate and goal + / keeps what is inside; painting goal, wall, outside, floor; erasing |
| place-pieces | worker placed again moves it, may stand on a goal; crates placed, removed + / nothing to remove −; floor or goals only, one piece to a square + / wall, outside, occupied − |
| check-boards | corrections: nothing to correct + / missing worker, no crates, counts differ −; kept and reopened with no undo or redo; playtest only with nothing to correct + / − ; board edit undo and redo + / not offered, replaced −; preview |
| publish-sokoban-puzzles | proof needed + / never playtested, stopped playtest −; playtest proves without ordinary completion; board edit takes proof away − / details keep it +, published edition unchanged; rules change takes proof away − / new playtest +; offline: playtest +, publication waits −, goes ahead on return + |
| starter-pack | guest and offline play; next unfinished offered + / complete pack offers none −; offline completion reaches the tablet |
| puzzles/edition-rules | edition after a rules change starts + / edition before it is refused with its reason; saved attempt resumes + / kept but not resumed −; rules change during play |

## Coverage

All five aggregates (`sokoban-play`, `board-building`, `publication-proof`,
`starter-pack`, `puzzles/edition-rules`) have every command, invariant and
status transition illustrated. The rows that no person observes on their own
are model-only: `_loseConnection` in each app-profile model, and
`invPlayingAStarterPuzzle` (bookkeeping). `sokoban-play` and `board-building`
are `@model-profile: local`. Every glossary `model` name is declared, and
every observable variable is named by an invariant (checked by script; the
shape check itself runs once bindings exist). Each model was type-checked
and simulated with the bundled Quint, and the states that matter (published,
waiting, proven, complete, removed beyond the edge, redo offered) were shown
reachable.

## Decisions taken without the product owner (confirm)

- New squares added by a bigger board are floor.
- A smaller board names the worker, crates and goals it removed. Walls and
  outside squares beyond the edge simply go.
- Outside squares and the board's edge block the worker with the same reason
  as a wall ("the worker's way is blocked").
- Placing the worker or a crate on a wall or an outside square, or where a
  piece stands, is refused. So is removing a crate from an empty square.
- Proof belongs to the board's content and the current rules, as the
  product goal asks: bringing back a board already completed in a playtest
  (by undo, say) brings its proof back. A playtest plays the board as it
  was when it began and, once completed, proves that board.
- Choosing publication again while one is waiting keeps the first choice.
  A rules change before the connection returns leaves it unpublished.
- Moves after completion are not specified.

## Shared policy

The starter pack offers and continues to the same puzzle as every pack
(`puzzles/pack-progression.qnt`): the last active unfinished puzzle, then the
first unfinished one in the pack's order, then none.

## Code tests, not scenarios (B17)

- Replaying the recorded moves of a claimed playtest under Sokoban's rules,
  and refusing a claim the moves do not reach.
- Move and push property tables, encodings, the 20 by 20 limit's resource
  checks, and solver or deadlock analysis, if any.
