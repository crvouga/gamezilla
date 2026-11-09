# Light Cycles board review

This run covers every registered variant: Duel, Trio and Quad. Product rules
remain in [the Light Cycles specs](../../../specs/light-cycles/). Follow the
[automated Storybook workflow](../../../pkgs/ui-root-harness-ts/README.md#agent-workflow)
and [design system](../../../pkgs/ui-root-client-ts/README.md).

## Scope and ownership

The implementation owner changes `libs/light-cycles-*` and the dedicated
`trail-arena` UI slices. Shared arena, frame and input changes require
coordination with the Pong owner through the orchestration thread. No shared
registry, theme or central test index changes belong to this run.

Review steering by keyboard, mouse, touch and shared-device controls; rider,
direction, trail and collision recognition; round and game endings; watching,
disconnection, device transfer and unreadable positions; viewport fit in both
themes; and measured input/render responsiveness. Preserve every underlying
task, including countdown steering and returning after an interruption.

## Fixed independent review contract

Two fresh Codex reviewers, `reviewer-a` and `reviewer-b`, independently inspect
the same immutable commit and evidence manifest. Neither sees the other's
findings before submitting. Each scores these dimensions separately:

- Functional design clarity: hierarchy, typography, alignment, rider and
  direction distinction beyond color, contrast, focus and viewport fit.
- UX and playability: discoverability, reliable input, task completion,
  collision/end feedback, accessible controls and independent recovery.
- Performance and responsiveness: repeatable input-to-render and frame
  measurements, long tasks, representative busy arenas and mobile CPU limits.

Use the overhaul rubric: 10 means best-in-class shipped quality, 9 polished
with nitpicks, 8 solid with minor issues, 6 functional with clear rough edges,
4 noticeably flawed, and 2 broken. Every deduction names its state or action
and evidence. Missing evidence is incomplete, never a perfect rating.

Stop successfully only when both reviewers award 10 in every dimension on
the same candidate and all required automated checks, including `bun verify`,
pass. Never average ratings, change the rubric mid-run or merge the PR.

## Evidence contract

Keep immutable per-SHA evidence and round records in the ignored
`.ui-ux-overhaul/` directory. Each manifest identifies fixtures, viewport,
theme, story, files and hashes. Use automated harness interactions only.
Every round's PR comment retains before/after SHAs, readable screenshots,
videos of matching interactions, uploaded durable asset links, both reviews,
task completion and accessibility outcomes, performance measurements and
their limits, and next fixes. Failed or incomplete rounds remain visible.

Baseline discovery found existing arena state and interaction stories, a
dedicated SVG trail renderer and DOM contracts. Existing variant stories
explicitly cover Duel and Quad; Trio also needs an explicit variant audit.
Historical images are references, not fresh execution evidence.
