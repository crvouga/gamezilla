# Connect Four board review

This run covers the production Connect Four presentation and
`pkgs/ui-root-client-ts/src/disc-drop-board`. Product behavior remains defined in
[`specs/connect-four`](../../specs/connect-four/); automated UI evidence follows
[the Storybook workflow](../../pkgs/ui-root-harness-ts/README.md#agent-workflow).

## Fixed review contract

Two independent Codex reviewers, reviewer-a and reviewer-b, inspect the same
immutable revision and evidence without seeing each other's verdict. Each scores
functional design clarity, UX/playability, and performance/responsiveness from
0–10. Ten means best-in-class shipped quality; nine means only minor deductions;
eight means solid with minor issues; six means functional with substantial rough
edges; four means noticeably flawed; two means broken. Every deduction cites its
state or interaction and an actionable correction. Missing evidence is incomplete.
Completion requires both reviewers to give all three dimensions ten on the same
candidate, with every required automated check passing. Scores are never averaged.

## Evidence matrix

- Pointer and touch: choose each column, see the landing cell, drop once, retain
  alternating discs, reject a full column, and choose another.
- Keyboard: enter and leave the board, move left/right, Home/End, activate with
  Enter/Space, retain visible focus, and inspect occupied and full columns.
- State: opening, each turn, waiting, spectator, win, loss, draw, and recovery.
- Layout: narrow phone, phone, tablet, desktop, light/dark, reduced motion.
- Accessibility: names, descriptions, focus order, target geometry, contrast and
  automated axe results. Screen-reader speech is not inferred from static markup.
- Performance: repeated input-to-render observations and long-task measurements,
  including CPU-throttled mobile conditions. Emulator measurements do not prove
  physical-device behavior.

Each round retains screenshots, videos of the same automated interactions,
interaction results, performance measurements, checks, a SHA-bound file/hash index,
and both independent reviews. PR comments link uploaded assets and report failures
and missing evidence explicitly. Shared baselines never substitute for a capture
of the candidate. No manual interaction is correctness evidence.

## Readiness

Pending baseline capture and review. No release readiness or performance result is
claimed by this document. Final readiness updates must cite the actual automated
checks and disclose remaining limits under
[`SELF_SERVICE_READINESS.md`](../../docs/SELF_SERVICE_READINESS.md).
