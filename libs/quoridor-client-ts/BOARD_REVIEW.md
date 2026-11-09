# Quoridor board review

This review covers both registered variants, Quoridor and Quoridor Hill. The
product contract remains in [the specifications](../../specs/quoridor/).
The [Storybook agent workflow](../../pkgs/ui-root-harness-ts/README.md#agent-workflow)
owns automated evidence; preview inspection is never a correctness check.

## Review contract

Each round uses two fresh independent Codex reviewers, reviewer-a and reviewer-b,
separate from the implementation owner. Both receive the same commit, immutable
evidence manifest and rubric, without the other reviewer's results. Each rates:

- Functional design clarity: board and pawn identity, goals, wall boundaries,
  remaining resources, contrast, focus, readable responsive layouts.
- UX and playability: movement versus wall placement, orientation, preview,
  confirmation, cancellation, precise touch, mouse and keyboard input, refusal
  recovery, waiting, spectators and finished games.
- Performance and responsiveness: measured input/render latency and long tasks,
  repeatable mobile CPU conditions, stable focus and immediate feedback.

The fixed scale is 10 best-in-class shipped quality, 9 polished with nitpicks,
8 solid with minor issues, 6 functional with rough edges, 4 flawed, 2 broken.
Missing evidence makes the round incomplete. Only unanimous 10 in every
dimension on the same revision, passing task completion and all required
automated checks ends the run. Scores are never averaged or adjusted.

## Evidence and ownership

Preserve per-SHA screenshots, automated interaction videos, traces, accessibility
results, measured performance, viewport/theme/fixture metadata and content hashes.
Each PR round records before/after revisions, durable assets, both reviews,
deductions, checks and next fixes. Baseline and failed rounds remain visible.

Existing production stories are `screens-games-quoridor-classic` and
`screens-games-quoridor-hill`. Reuse `CellGridBoard`, the existing board tools,
coordinate picker and game-table composition. Keep the sand/timber board and
the established design-system tokens. Changes to the generic grid require
coordination with the Battleship owner through the orchestration thread.

Relevant tasks include movement, reaching the opposite edge or hill, wall
placement and refusal recovery, cancellation without spending a wall, forced
pass in Hill, following others and reviewing a finished game. Cover phone,
tablet and desktop in both themes; use production rules for action outcomes.
