# Pong board usability review

The board review follows the [Storybook agent workflow](../../../pkgs/ui-root-harness-ts/README.md#agent-workflow) and [self-service readiness](../../../docs/SELF_SERVICE_READINESS.md). Product rules remain in [Pong specs](../../../specs/pong/).

## Scope and ownership

Pong owns `libs/pong-*`, the `paddle-court` design-system slice, and uniquely named Pong regression tests. Shared arena or realtime input changes require coordination with the Light Cycles owner before editing.

## Evidence matrix

| Task | States and inputs | Evidence required |
| --- | --- | --- |
| Identify and control a paddle | Left, right, both local seats; keyboard, mouse, touch, simultaneous controls | Automated input traces and video showing paddle response and release |
| Follow play | Countdown, rally, point, match point, completed | Readable screenshots in both themes; score and serve assertions |
| Recover safely | Pause, disconnect, reconnect, unreadable position, leaving while holding input | Disabled controls, retained score, recovery and input-release assertions |
| Watch a game | Spectator, finished match | Readable state with no active paddle controls |
| Resize during play | Phone portrait/landscape, tablet, desktop; narrow and short viewport | Automated geometry, keyboard focus, accessibility and resizing checks |
| Respond promptly | Repeated input during rally; normal and throttled mobile CPU | Measured input-to-paint, frame intervals and long tasks, with environment and limitations |

Existing screen stories use `screens-games-pong-court--*`; their deterministic mechanics and production table composition are reused. Storybook evidence cannot establish live transport or persistence: the running-app journey and owning network harness remain separate requirements.

## Independent review contract

Every round uses two fresh independent Codex reviewers, `reviewer-a` and `reviewer-b`, with identical immutable revision, evidence and rubric. Reviewers inspect actual captures, interaction traces, automated results and relevant code without seeing each other's scores. Each scores functional visual clarity, UX/playability and measured responsiveness separately. Missing evidence makes a round incomplete. Completion requires both reviewers to award 10/10 in all three dimensions on the same revision, with all checks passing including `bun verify`.

Per-revision evidence, hashes, fixed rubric and raw reviews are retained in the ignored `.ui-ux-overhaul/` workspace and published as immutable PR comments with accessible screenshot and video attachments. Every improvement comment identifies before/after commits, comparable interactions, deductions, task and accessibility results, measured performance limits, and next fixes. Failed or incomplete rounds are retained.
