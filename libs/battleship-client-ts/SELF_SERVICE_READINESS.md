# Battleship board readiness

The [shared readiness definition](../../docs/SELF_SERVICE_READINESS.md) applies.
Game behavior remains in [Battleship specs](../../specs/battleship/).

| Task | Friction before this change | Current presentation | Automated evidence | Limits |
| --- | --- | --- | --- | --- |
| Confirm a shot and understand its progress | Fire became disabled with its idle label while waiting | The action says which coordinate is firing, exposes its busy state and prevents another selection or submission until the existing controller answers | `tests/shot-feedback.test.tsx`; [recorded interactions](../../pkgs/ui-root-harness-ts/tests/storybook/battleship/input/checks.ts) | DOM covers the position/resync boundary, not live network delivery or rejection |
| Inspect another fleet as a spectator or after play | Read-only waters still instructed the viewer to aim | Regions invite inspection and the detail grid is named Shot details | `tests/shot-feedback.test.tsx`; [recorded interactions](../../pkgs/ui-root-harness-ts/tests/storybook/battleship/input/checks.ts) | Browser capture and accessibility tree checks pending |

| Read shot outcomes across the whole field | The inert visual overview named regions without describing their outcomes | Each region exposes its public hit, miss, sunk and pending outcomes as an accessible description; detailed coordinates remain in its working grid | `tests/region-outcomes.test.tsx` | Browser accessibility-tree and assistive-device evidence pending |

The two baseline reviewers withheld ratings because committed image references
are stale. Fresh hosted screenshots, videos, accessibility, task-completion and
performance evidence remain required. The first hosted baseline could not build
Storybook because Node exhausted its heap; this is not a browser pass.
Full verification remains required; local full builds and verification are
currently reserved by the multi-game coordinator to protect the shared host.
