# Battleship board usability review

This review follows the [Storybook agent workflow](../../pkgs/ui-root-harness-ts/README.md#agent-workflow)
and [overhaul workflow](../../.agents/skills/ui-ux-overhaul/SKILL.md).
The product contract remains in [Battleship specs](../../specs/battleship/).

## Scope and reusable surfaces

Fleet placement, rotation, repositioning, targeting, confirmation, both waters,
shot outcomes, turn changes, spectators and completed games are in scope.
Production compositions are `battleship-setup-board.tsx` and
`battleship-board.tsx`; their `screens-games-battleship-setup` and
`screens-games-battleship-board` stories supply deterministic fixtures.
Reuse the existing Battleship placement, targeting and region-overview slices.
Coordinate any generic `cell-grid-board` change with its Quoridor owner first.

## Fixed review contract

Two independent Codex reviewers, `reviewer-a` and `reviewer-b`, inspect the same
immutable candidate and evidence without seeing each other's findings.
Each scores functional design clarity, UX/playability and measured
performance/responsiveness separately. Use the linked overhaul rubric for
design and UX. For performance, assess input-to-render latency, long tasks,
repeatability and responsiveness under mobile CPU constraints; images alone
cannot establish performance. A missing measurement is incomplete.

The run completes only when both reviewers independently score all three
dimensions 10/10 on the same candidate, required checks pass, and every
underlying task remains available. Missing captures, videos, live task evidence,
reviews or checks make the round incomplete. Scores are never averaged.

## Evidence matrix

Use fixed fleets and shots from the existing stories in both themes at phone,
tablet and desktop sizes. Include keyboard, mouse and touch placement and
targeting; invalid placement; change/cancel/confirm aim; repeated-shot refusal;
hit, miss and sinking; waiting, watching, finished and recovery states.
Capture the same interactions before and after as screenshots and videos.
Retain action traces, accessibility results, task completion and repeatable
input/render/long-task measurements alongside content hashes per commit.

Publish each round as a new PR comment with accessible uploaded assets,
revision identifiers, both independent reviews, failures, limitations and next
fixes. Local evidence directories are ignored and never masquerade as uploads.
Automated checks are the only correctness evidence; inspecting their captures
is visual review. Current results and remaining limitations live in PR comments.
