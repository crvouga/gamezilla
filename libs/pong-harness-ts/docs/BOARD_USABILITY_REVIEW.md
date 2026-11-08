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

## Readiness evidence

| Player need | Current coverage | Remaining evidence |
| --- | --- | --- |
| Resume control after interruption | `pkgs/ui-root-harness-ts/tests/pong-input-interruption.test.tsx` pins held W across disconnect and held ArrowUp across browser blur, with a property over prior key combinations | Hosted pointer, touch, visibility and live-network recovery |
| Discover keyboard and mouse input | `libs/pong-client-ts/tests/pong-board-layout.test.tsx` checks the focus step, keys and dragging guidance | Fresh narrow/short viewport geometry and keyboard video |
| See the opponent's paddle | `pkgs/ui-root-harness-ts/tests/storybook/pong-contrast/integration.checks.ts` measures rendered spectator paddle boundaries in both themes | Hosted contrast result and fresh screenshots |
| Keep paddle rendering stable | `pkgs/ui-root-harness-ts/tests/pong-paddle-render.test.tsx` verifies the same two SVG elements retain identity through 120 new position objects while their geometry updates | Browser node-churn samples and frame/input measurements |
| Assess responsiveness | `pkgs/ui-root-harness-ts/tests/storybook/pong-overhaul/integration.checks.ts` records video, frame intervals, long tasks and input-to-two-animation-frames samples at normal and 4× CPU throttle | Hosted results; physical device, display and network latency are not established by this proxy |

The central readiness matrix is coordinated by the board-overhaul owner to avoid concurrent edits. This game-owned evidence supplements that row; it does not replace the complete verification gate or certify the unmeasured cases above.

## Hosted candidate record

The expanded unchanged-game baseline is `420195e91e203174e92f66ea1a8095f700e73e7a`, captured by [run 42434637615](https://github.com/crvouga/gamezilla/actions/runs/42434637615). The spectator paddle contrast example failed at approximately 2.17:1, as expected. The game candidate is `56b724d2356d2ca6b9731f7390a086b5a3fba658`, captured by [run 42434639538](https://github.com/crvouga/gamezilla/actions/runs/42434639538); its focused browser author and compare runs passed, including native simultaneous touch and the contrast example. This is diagnostic evidence, not the complete release gate.

The 60 candidate reference PNGs were extracted from the hosted binary patch, visually inspected, and committed without image changes. Both captures retain a separate SHA-256 screenshot index: baseline `c7fda5667d7307e72f0c610f7abb4b3c373fce1a6bcc8a3ea81a7d82e87b03d7`; candidate `c65cfda3b545f6b061e2bc47463826f786cf6b24fc364c9d952068224b0d37fd`. Actual videos, timing samples and accessibility attachments await the coordinated evidence-only relay. There are no fresh numerical reviewer scores, physical-device performance claims, or complete-gate claims.
