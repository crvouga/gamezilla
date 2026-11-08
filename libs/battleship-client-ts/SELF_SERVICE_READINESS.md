# Battleship board readiness

The [shared readiness definition](../../docs/SELF_SERVICE_READINESS.md) applies.
Game behavior remains in [Battleship specs](../../specs/battleship/).

| Task | Friction before this change | Current presentation | Automated evidence | Limits |
| --- | --- | --- | --- | --- |
| Confirm a shot and understand its progress | Fire became disabled with its idle label while waiting | The action says which coordinate is firing, exposes its busy state and prevents another selection or submission until the existing controller answers | `tests/shot-feedback.test.tsx`; [recorded interactions](../../pkgs/ui-root-harness-ts/tests/storybook/battleship/input/checks.ts) | DOM covers the position/resync boundary, not live network delivery or rejection |
| Inspect another fleet as a spectator or after play | Read-only waters still instructed the viewer to aim | Regions invite inspection and the detail grid is named Shot details | `tests/shot-feedback.test.tsx`; [recorded interactions](../../pkgs/ui-root-harness-ts/tests/storybook/battleship/input/checks.ts) | Recorded native inspection passes; full assistive-device audit remains incomplete |
| Read shot outcomes across the whole field | The inert visual overview named regions without describing their outcomes | Each region exposes its public hit, miss, sunk and pending outcomes as an accessible description; detailed coordinates remain in its working grid | `tests/region-outcomes.test.tsx` | Linked accessible descriptions tested; axe has unresolved contrast checks and is not full assistive-device evidence |
| Inspect a locked fleet | Locking also disabled region and full-board navigation, while the overview was inert | Read-only region and full-board views remain available; editing controls are omitted and ships cannot change | `tests/setup-precision.test.tsx`; recorded locked-inspection checks | Hosted capture 42521659810 passes; the unchanged baseline fails these checks |
| Switch target regions promptly | Cell attributes repeatedly filtered the full board during one region update | Region cells, rows and columns are memoized | `tests/region-workload.test.tsx`; repeated attributed browser timing probes | The operation-count test is not a latency measurement. Timings before `b39b17726` included Storybook highlight and keydown overhead and forced reduced motion |
| Aim on a phone once shots exist | At 390×844 the move record, two instruction rows and a separate key pushed the own seat to 892px | The key shares the region instruction's row above the map; the idle Fire control under the cells names the cell instruction; shot lines fit one status line for a miss or hit | Hosted captures at 390/768/1440 in both themes; [phone regression](../../pkgs/ui-root-harness-ts/tests/storybook/battleship/layout/integration.checks.ts) | A sinking line ("…sank the Destroyer at G10. Your turn to fire.") still wraps; the own seat can then sit about 20px below a 390×844 screen |
| Know whose turn it is while a shot is sent | The frame kept saying "Your turn." with own-turn emphasis while the choice was in flight | The frame says "Sending choice…" and the viewer's seat stops deciding until success or refusal restores the turn | `libs/game-session-client-ts/tests/frame-pending-status.test.tsx` (shared frame) | Fixture model boundary, not live network rejection |

Round 1 has matched hosted screenshots and original automated videos, uploaded
and byte-verified on the draft PR, with both independent reviews in the PR
comments. Round 2 captures use the browser's own motion and exclude Storybook's
highlight and keydown overhead; every earlier Battleship video and timing ran
with motion forced off. Recorded fixture tasks do not establish live
multiplayer, persistence, reconnect or physical-device results. Axe reports
have no violations, but every report leaves colour contrast undecided (mostly
`bgOverlap`), so zero violations is not contrast coverage.

Full local verification remains reserved by the multi-game coordinator to
protect the shared host; it is not claimed as passed here.
