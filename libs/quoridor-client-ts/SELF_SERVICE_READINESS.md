# Quoridor readiness evidence

The shared readiness definition and current matrix live in
[SELF_SERVICE_READINESS.md](../../docs/SELF_SERVICE_READINESS.md).
This game-owned entry supplies the current round to the matrix coordinator.

Both Quoridor variants retain their existing wall refusal reasons and next
actions, precise coordinate picker, confirmation/cancellation, remaining-wall
seat statistics, waiting/spectator states, finished state and Hill forced pass.

The current controller changes let a player cancel a proposal with Escape while
focus is on the board, clear obsolete hover and selected proposals after an
incoming position, and honor a host reset after a refused action. The board's
accessible description now references its current status and recovery guidance.

Literal regressions are in
[quoridor-preview-lifecycle.test.tsx](tests/quoridor-preview-lifecycle.test.tsx).
Keyboard stories are `screens-games-quoridor-classic--keyboard-wall-cancellation`
and `screens-games-quoridor-hill--keyboard-wall-cancellation`.

Browser video, accessibility and performance evidence is collected by
[the dedicated automated suite](../../pkgs/ui-root-harness-ts/tests/storybook/quoridor-overhaul/integration.checks.ts).
Current DOM contracts do not prove pixel geometry, touch accuracy, live transport,
persistence, native behavior or the full release gate. Those claims remain open
until the corresponding automated evidence is retained on PR 285.
