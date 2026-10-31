# Design system handoff

Resume from `feat/ui-overhaul-design-system`. The branch includes the design-system
work through `eb6119723` and merges `origin/main` at `921232587`.

## Preserved work

Storybook is the canonical UI development and discovery surface. Component
implementations, stories, fixtures, documentation and visual baselines remain in
vertical slices. The old bespoke UI explorer is removed. Production components
and typed contracts drive the stories and generated coverage inventory.

The browser annotations are implemented: full-color Google branding with its
self-hosted typeface, the colored logo mark, and wide subscreen breadcrumb pills
in the app bar. Duplicate profile headers are removed. JSX breadcrumb labels keep
their screen providers, mount once, and retain heading and focus behavior.

## Main integration

The logo keeps its sliced implementation and now requires the host-provided
`name` from main's product-identity contract. Framework examples and Storybook
branding are neutral. The app still reads its real name from product identity.

Cache analysis retains asset and stylesheet dependency discovery, plus main's
bounded `fileReachWithin` traversal. Obsolete generated workers under the old
app path are deleted. The measured CI-load section is regenerated from the
merged task graph. Visual baselines follow main's chess-file-label inset fix
and the neutral framework wordmark examples.

## Verification and remaining work

The merge conflict index is clear. Targeted cache tests, navigation and focus
tests, startup tests and snapshot-fingerprint tests pass. All 473 Storybook comparisons and integration checks pass without baseline
updates. All 15 selected validation tasks pass, including component tests,
types, lint, branding and design-system checks. Results are recorded in `.cache/handoff-verified.log` in the original worktree.

**The whole release gate has not completed.** Earlier local `bun verify` attempts
waited behind another worktree's verification. Do not infer a green full gate
from the Storybook results. Run `bun verify` on the exact resumed commit, through
the normal admission queue; preserve other worktrees' processes.

The canonical agent workflow and commands are in
[`pkgs/ui-root-harness-ts/README.md`](../../pkgs/ui-root-harness-ts/README.md).
Use `bun storybook:coverage` for the generated inventory and `bun storybook:test`
for browser, accessibility, interaction and visual checks. Baseline updates
require explicit intent; ordinary comparisons must not update snapshots.
