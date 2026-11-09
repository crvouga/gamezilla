# Hearts board readiness

This change follows [self-service readiness](../../../docs/SELF_SERVICE_READINESS.md)
and the [automated UI evidence workflow](../../../pkgs/ui-root-harness-ts/README.md#agent-workflow).
The coordinator owns the central matrix during the concurrent board overhaul.

The Hearts matrix update to integrate with this PR:

- A full three-card pass selection explains how to revise the choice before sending.
- A refused card explicitly associates its rule explanation with the focused control.
- At narrow widths the hand wraps into rows of at most five square cards,
  preserving the hit area while reducing the height of a thirteen-card deal.
- Each seat labels the current deal's points separately from the cumulative score.
- An acknowledged pass visibly explains that the locked hand is waiting for
  every other player, using the same explanation as the spoken status.
- On a short, narrow phone while passing, the existing disclosure keeps players
  and scores available without placing the full table above the hand. Opening
  and closing it preserves selection; trick play restores the full table.
- Literal regression ownership: `hearts-fourth-pass-card-silent`,
  `hearts-refusal-not-described-on-focus`, `hearts-320-thirteen-card-targets`,
  `hearts-taken-score-unit-ambiguous`,
  `hearts-320-short-viewport-three-row-overflow`,
  `hearts-short-passing-context-crowds-hand`,
  `hearts-passed-waiting-copy-visually-hidden`.
- DOM regressions first failed on the original implementation and passed after the
  first two fixes. Hosted narrow geometry exposed undersized targets in the
  original hand, then vertical overflow after it wrapped into three portrait
  rows. Recorded square-card geometry still overflows at 320x568: the table
  consumes 254px above the hand. The disclosure correction passes the literal
  DOM preservation/reactivity test and awaits hosted geometry replay.
  The preceding hosted candidate passed 32 of 36 browser cases, including
  accepted exchange, refusal, complete trick, recovery and retention; only
  the four short-viewport cases failed. Its 31 recorded axe reports had no
  recorded violations but all left color contrast incomplete; they do not
  establish contrast compliance. These results do not certify the newer
  disclosure and visible waiting-guidance changes.

Limitations remain explicit: Storybook fixtures do not establish server transport,
persistence, real-device screen-reader operation or native builds. The accepted
exchange fixture rotates through all four seats; it is not a live multiplayer
session. Current browser evidence, failed-pass error recovery in the running app,
full verification and both independent reviewer verdicts remain required.

Immutable rounds, uploaded screenshots/videos, measurements and check outcomes
belong to pull request #288, not this note.
