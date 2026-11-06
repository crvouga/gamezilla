# Round 3 integration findings

Initial input: fad0bb1786ffe182b0bf9ff996117d612d7cdbdf. All original logs and media retained.

The initial focused geometry run completed 31 cases: 8 controlled font checks passed, 13 cases reached pixel comparisons, and 10 failed native play (five repetitions each of two literal defects). The four same-OS desktop font pairs and three phone pairs (AcceptedExchange light/dark, AcceptedPass light) passed geometry and pixel equality with fonts released by observed loader events. This does not attribute exact old Ubuntu failures.

- Battleship enlarged setup measured 40.359375px cells in both viewports/themes, below the unchanged 44px bound. The default grid maximum omitted coordinate width, gaps and padding. The bounded Battleship sizing now includes all three. Targeting uses the bounded grid when enlarged and its story also asserts the existing 64px upper bound.
- Chess puzzle's `[data-square]` selector included the BoardFit layout marker, producing 65 elements. It now selects the 64 square buttons; every clipping, coordinate, minimum size, and first-rank action assertion remains intact.
- Added Word Tiles native story `screens-games-word-tiles-board--enlarged-coordinates`, asserting center and all four corners through keyboard navigation, with focus target bounds clear of both sticky coordinate axes. It reached pixels in all four canonical viewport/theme combinations in the initial run.

`bun obs last` resolved local `.observability`, 2026-11-06T14:59:17.609Z through 15:09:17.609Z UTC, with no activity. Native Storybook failure reports and browser output supplied the relevant render evidence. No manual QA, skipped assertions, tolerance changes, retries or reference acceptance.

The complete initial 626-case run exposed two remaining causes: four bounded targeting-width failures (23.796875px in the centered panel) and eighteen chess story-pointer failures. The latter were multiline errors and were not detected by the narrow live-log filter; the parsed full JSON report is authoritative. All 596 other visual cases reached pixels and all eight controlled font checks passed.

The targeting stack now spans its panel so the bounded board can use its intended width. The chess first-rank helper sends pointer input to the actual application surface at the measured e1 center; it does not disable pointer checks or change production input. The keyboard-only square layer intentionally has pointer-events:none. All selection, legal-move, cancellation, target-size and clipping assertions remain.

A rebuilt focused run across every chess puzzle state and the targeting correction story reached pixels in all 28 cases with no native play, browser-error or serious/critical axe failures. These fixes were committed as d4ba9d517c59e9e03ecd2453a59972e77da866f4 after 9/9 owning lint/typecheck/test tasks and ci:goals passed.

The three phone font cases (exchange light/dark, pass light) produced identical scroll geometry and byte-identical images under both ready-font and held-font schedules in two independently completed runs. See phone-schedule-comparison.json. This verifies the current composition under those schedules; it does not retroactively identify the exact old Ubuntu 50px drift, whose actual/diff artifacts remain unavailable.
