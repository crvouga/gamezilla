# Quoridor readiness evidence

The shared readiness definition and current matrix live in
[SELF_SERVICE_READINESS.md](../../docs/SELF_SERVICE_READINESS.md).
This game-owned entry supplies the current round to the matrix coordinator.

Both Quoridor variants retain their existing wall refusal reasons and next
actions, precise coordinate picker, confirmation/cancellation, remaining-wall
seat statistics, waiting/spectator states, finished state and Hill forced pass.

## Round 1 (PR 285, candidate `8ab31f6f4`)

Escape cancels a proposal while focus stays on the board; obsolete hover and
selected proposals clear after an incoming position or host reset; changing
wall orientation keeps keyboard focus on the tool buttons; the board's
accessible description references its status. Two independent reviewers
scored design / UX / performance 7/7/6 and 6/7/6 (no 10s).

## Round 2 (PR 285, in progress)

Fixes from the round-1 deductions:

- watchers, waiting players and finished games no longer see legal-move hints,
  and the read-only status names the side to move;
- a finished classic game keeps marking the winner's goal row;
- classic with no walls left no longer suggests a pass classic does not have;
- each new turn starts with the pawn tool; Cancel and Place wall return focus
  to the active tool instead of the page;
- the wall anchor picker filters by coordinate and has a specific title;
- pawns sit on opaque sand squares with stable inks (at least 4.6:1 in both
  app themes; dark-theme gold and black had fallen to about 1:1);
- on tablet and desktop the board grows and centres in its column while its
  tools stay in the first view;
- journey stories keep turn, moves and ending live, and the hosted matrix now
  includes classic no-walls, won and lost, and Hill won.

Literal regressions are in
[quoridor-preview-lifecycle.test.tsx](tests/quoridor-preview-lifecycle.test.tsx),
[quoridor-board-truthful-state.test.tsx](tests/quoridor-board-truthful-state.test.tsx)
and [the browser regression checks](../../pkgs/ui-root-harness-ts/tests/storybook/quoridor-regressions/integration.checks.ts).

Browser video, accessibility and performance evidence is collected by
[the dedicated automated suite](../../pkgs/ui-root-harness-ts/tests/storybook/quoridor-overhaul/integration.checks.ts).
It runs with Storybook's highlight addon disabled and reads timing before the
accessibility audit. Axe leaves color contrast unresolved on board text
(incomplete, not passing), so contrast coverage comes from the stories' own
assertions. Board fixtures do not prove live transport, persistence, native
behavior or the full release gate; those claims remain open until the
corresponding automated evidence is retained on PR 285.
