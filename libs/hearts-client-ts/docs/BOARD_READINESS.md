# Hearts board readiness

This change follows [self-service readiness](../../../docs/SELF_SERVICE_READINESS.md)
and the [automated UI evidence workflow](../../../pkgs/ui-root-harness-ts/README.md#agent-workflow).
The coordinator owns the central matrix during the concurrent board overhaul.

The Hearts matrix update to integrate with this PR:

- A full three-card pass selection explains how to revise the choice before sending.
- A refused card explicitly associates its rule explanation with the focused control.
- At narrow widths the hand wraps into rows of at most five full-size cards.
- Literal regression ownership: `hearts-fourth-pass-card-silent`,
  `hearts-refusal-not-described-on-focus`, `hearts-320-thirteen-card-targets`.
- DOM regressions first failed on the original implementation and passed after the
  first two fixes. Narrow geometry and trusted touch/mouse exchange/trick tests
  are authored for the hosted browser harness; their verdict is still pending.

Limitations remain explicit: Storybook fixtures do not establish server transport,
persistence, real-device screen-reader operation or native builds. The accepted
exchange fixture rotates through all four seats; it is not a live multiplayer
session. Current browser evidence, failed-pass error recovery in the running app,
full verification and both independent reviewer verdicts remain required.

Immutable rounds, uploaded screenshots/videos, measurements and check outcomes
belong to [PR 288](https://github.com/crvouga/gamezilla/pull/288), not this note.
