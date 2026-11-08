# Word Tiles board readiness

This game-owned supplement supplies evidence for the Word Tiles row in the
[readiness matrix](../../../docs/SELF_SERVICE_READINESS.md). Its shared update
is coordinated separately during concurrent board work.

| Concern | Implementation and verification |
| --- | --- |
| Stable touch and mouse targets | Precision-board centering follows zoom, resize and deliberate region navigation. Ordinary focus leaves visible squares in place. Literal regression: `word-tiles-focus-moves-pointer-target`. |
| Draft recovery | Existing recall, undo, redo, blank assignment and word-list recovery remain covered by board stories and owning DOM contracts. Native capture journeys additionally retract and replace a tile before submitting. |
| Two, three and four players | The authority-backed fixture deals the appropriate number of private racks. Named match stories and native-input journeys use every registered seat count and assert score/turn settlement. |
| Accessibility | Focus remains roving; arrow navigation reveals offscreen squares. Hosted capture tests retain axe findings and keyboard traces. A DOM regression is not a browser or screen-reader pass. |
| Responsiveness | Captures retain trusted native input-to-animation-frame samples, long tasks, CPU throttling conditions and videos. These are emulated browser measurements, not physical-device or display-presentation latency claims. |
| Current evidence limits | Hosted baseline build at `003b644a4` failed with Node heap exhaustion before rendering. Current screenshots/videos, live-app persistence and full verification remain unproven until their automated jobs complete. |

The dedicated board-overhaul PR (284) records immutable
rounds and independent reviews. Historical PNG references are explicitly stale
and are not a substitute for fresh candidate evidence.
