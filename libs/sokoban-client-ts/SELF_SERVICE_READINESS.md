# Sokoban board readiness evidence

This is the Sokoban-owned evidence supplement for the coordinator's
[readiness matrix](../../docs/SELF_SERVICE_READINESS.md). Product behavior
remains in [the Sokoban specs](../../specs/sokoban/).

| Surface | Change | Automated evidence | Remaining limitation |
| --- | --- | --- | --- |
| Maximum board | An optional close view follows the worker with full-board tap coordinates; the overview preserves progress | `sokoban-input.contract.test.tsx` (`sokoban-maximum-board-pieces-too-small`); hosted maximum-board suite, including 320px capture and target-size assertions | CPU emulation does not establish physical-device performance |
| Board replacement | Replacing a large board in close view with a smaller board restores every square and the overview label | Same contract file (`sokoban-close-view-sticks-on-smaller-board`): 20×20 to 7×6, 42 visible squares | Scoped DOM regression passed; hosted diagnostic run 42460142693 at `e77f990e5` succeeded |
| Move and push counter | Each count stays on one line with its label; at narrow widths the pair wraps only between counts | Same contract file (`sokoban-counts-split-on-narrow-phone`) | DOM check asserts the unbreakable groups; a fresh 320px capture is still needed to show the rendered result |
| Movement while saving | A fifth queued direction explicitly says it was not added; existing four-direction queue order is preserved | `libs/sokoban-harness-ts/tests/sokoban-input.contract.test.tsx` (`sokoban-save-queue-silently-drops-fifth-direction`); hosted queue video | Fixture covers disabled input, not live save acknowledgement or network recovery |
| Wide touch input | Named 44px direction controls remain available at wide widths | Same contract file (`sokoban-wide-touch-screen-hides-steering`) | Physical device responsiveness is not established by DOM checks |
| Board movement | Tile nodes retain identity while accessible descriptions update | `pkgs/ui-root-harness-ts/tests/sokoban-tile-stability.test.tsx` (`sokoban-moving-worker-replaces-every-tile`); hosted small/maximum-board frame and long-task measurements | Keydown to next frame after DOM update excludes display presentation and persistence |
| Swipe boundary | The board captures the active pointer until release and ignores unrelated releases | Same contract file (`sokoban-board-loses-outside-pointer-release`); hosted outside-release and touch-cancellation recordings | Chromium automation does not cover physical devices |
| Static preview | Preview stays outside the tab order and permits native directional scrolling | Same contract file (`sokoban-static-preview-captures-navigation`); hosted `sokoban-input/integration.checks.ts` tab-order and touch-action assertions | Native scrolling assertion covers CSS policy, not physical touch scrolling |

Existing solved, unreadable, history and editor recovery contracts remain
covered by the Sokoban harness. Serial Sokoban tests passed; no manual
correctness testing was used. This document does not claim passing full
verification or live persistence evidence. Current revision, actual hosted
results, independent ratings and captured artifacts belong to
PR #287 in this repository. The hosted evidence above is from run
42438640169 at `d4c374eeffa63ed13f3fec3ac895c6131186ae3e` (102 authoring
and 102 comparison checks passed). It does not cover the later board-replacement
fix. The matched media round (PR #287, comment 6718764784) contains uploaded
screenshots, videos and measurement limits; independent review reports remain
pending. Zero axe violations does not mean all checks completed: retained
reports include incomplete contrast checks that require additional evidence.
