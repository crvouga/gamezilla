# Sokoban board readiness evidence

This is the Sokoban-owned evidence supplement for the coordinator's
[readiness matrix](../../docs/SELF_SERVICE_READINESS.md). Product behavior
remains in [the Sokoban specs](../../specs/sokoban/).

| Surface | Change | Automated evidence | Remaining limitation |
| --- | --- | --- | --- |
| Maximum board | An optional close view follows the worker with full-board tap coordinates; the overview preserves progress | `sokoban-input.contract.test.tsx` (`sokoban-maximum-board-pieces-too-small`); hosted maximum-board suite | 320px screenshot, video and target-size check pending |
| Movement while saving | A fifth queued direction explicitly says it was not added; existing four-direction queue order is preserved | `libs/sokoban-harness-ts/tests/sokoban-input.contract.test.tsx` (`sokoban-save-queue-silently-drops-fifth-direction`) | Hosted video and accessibility results pending |
| Wide touch input | Named 44px direction controls remain available at wide widths | Same contract file (`sokoban-wide-touch-screen-hides-steering`) | Physical device responsiveness is not established by DOM checks |
| Board movement | Tile nodes retain identity while accessible descriptions update | `pkgs/ui-root-harness-ts/tests/sokoban-tile-stability.test.tsx` (`sokoban-moving-worker-replaces-every-tile`) | Hosted small/maximum-board frame and long-task measurements pending |
| Swipe boundary | The board captures the active pointer until release and ignores unrelated releases | Same contract file (`sokoban-board-loses-outside-pointer-release`) | Real browser pointer-boundary recording pending |
| Static preview | Preview stays outside the tab order and permits native directional scrolling | Same contract file (`sokoban-static-preview-captures-navigation`); `pkgs/ui-root-harness-ts/tests/storybook/sokoban-input/integration.checks.ts` | Browser touch-action assertion pending |

Existing solved, unreadable, history and editor recovery contracts remain
covered by the Sokoban harness. Serial Sokoban tests passed; no manual
correctness testing was used. This document does not claim passing full
verification or live persistence evidence. Current revision, actual hosted
results, independent ratings and captured artifacts belong to
[PR 287](https://github.com/crvouga/gamezilla/pull/287).
