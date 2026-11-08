# Word Tiles board readiness

This game-owned supplement supplies evidence for the Word Tiles row in the
[readiness matrix](../../../docs/SELF_SERVICE_READINESS.md). Its shared update
is coordinated separately during concurrent board work.

| Concern | Implementation and verification |
| --- | --- |
| Stable touch and mouse targets | Precision-board centering follows zoom, resize and deliberate region navigation. Ordinary focus leaves visible squares in place. Literal regression: `word-tiles-focus-moves-pointer-target`. |
| Narrow rack targets | Rack buttons keep their full target size and wrap when seven tiles cannot fit. The literal `word-tiles-narrow-rack-targets` checks dimensions and corner hit-testing after scrolling, across all player counts and both themes. Its unchanged-grid baseline fails all six cases; run 42438197100 at `5578866f0` passes all six. The same run still fails both 320px initial-score checks. New capture checks retain targets after placement too. |
| Score and workspace composition | All Word Tiles counts opt into a compact score rail and a 4px compact screen inset. Defaults for other games and wide screens remain unchanged. The original initial-score, 308px viewport and unobscured-control assertions remain in force; hosted verification of this composition is pending. Spectator identity and long score/name contracts have literal DOM regressions. |
| Draft recovery | Existing recall, undo, redo, blank assignment and word-list recovery remain covered by board stories and owning DOM contracts. Native capture journeys additionally retract and replace a tile before submitting. |
| Two, three and four players | The authority-backed fixture deals the appropriate number of private racks. Named match stories and native-input journeys use every registered seat count and assert score/turn settlement. |
| Accessibility | Focus remains roving; arrow navigation reveals offscreen squares. Hosted capture tests retain axe findings and keyboard traces. A DOM regression is not a browser or screen-reader pass. |
| Responsiveness | Captures retain trusted native input-to-animation-frame samples, timestamped long tasks, phase boundaries, CPU throttling conditions and videos. Named task timings include automation waits, asserted state and two animation frames. These are emulated browser measurements, not physical-device or display-presentation latency claims. |
| Current evidence limits | Original baseline run 42433806308 at `0fb4ff25e` has 41 passes and 8 failures; pointer-fix run 42434485062 at `1fdd55d29` has 48 passes and 2 narrow-opening failures. Original screenshots, videos and measurements were recovered and hashed. Both independent baseline reviews rate design 5.5 and UX 4; broader performance and contrast evidence remain incomplete. Live-app persistence and full verification are not established by these focused captures. |

The dedicated board-overhaul PR (284) records immutable
rounds and independent reviews. Historical PNG references are explicitly stale
and are not a substitute for fresh candidate evidence.
