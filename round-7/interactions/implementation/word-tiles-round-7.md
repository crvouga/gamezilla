# Word Tiles round 7 implementation handoff

Source supplied: `863c687fae76c57527d495ec436afcf0ea99539a`, shared branch `t3/game-board-ux-overhaul`. Scope J10/J11 only. No commits, pushes, specs, references, builds, native runs, shared participant/frame edits, global readiness edits, or shared `stories.checks.ts` edits.

## Design and behavior

Production `WordTileBoard` uses a reactive media query: phones below 640px default to precision; desktop starts fitted. Explicit Fit/Enlarge choices persist. The actual board has 44px cells, a viewport at least 312px high, sticky coordinates and retained focus. Initial centering scrolls only the board container, not the page or keyboard focus.

Precision context is now a persistent 132px whole-board diagram beneath the full-width placement viewport, with a tracked viewport outline and nine disjoint 44px region buttons. A region click focuses its center without placing a tile, consuming the selected rack tile, or opening a dialog. Current square information sits beside the context. The ordinary Map button/dialog and arrow/Home/End navigation remain for exact coordinate location. Fit and Enlarge retain their existing accessible names; all CSF IDs remain.

This removes the explicit Enlarge action for ordinary phone placement and replaces open-Map + tiny-intersection navigation with one coarse region action. It does not make 225 simultaneous 44px cells possible. Tradeoff: the larger persistent overview consumes vertical space; precision exposes a local word-sized neighborhood, while full-board word reading remains available in Fit/Map. Full native geometry is pending, especially chooser-open and long-label states. Do not claim all context fits until the assertions below pass.

Empty premium squares retain their printed multiplier/bonus names and accessible labels but use quiet surfaces and lighter label weight, giving actual tile faces precedence. Overview bonus coloring remains. Puzzle covered-square bonus text is unchanged.

Blank choices keep all 26 medium controls and focus restoration. Typing an unmodified A–Z key on any letter button immediately chooses that letter (case insensitive), without tabbing through the alphabet. Modifier shortcuts remain untouched. The duplicate preview instruction is suppressed only while the blank chooser is already presenting it. Puzzle vertical gaps and blank-choice gaps are compacted without shrinking controls.

## Required inputs inspected

Read AGENTS.md, frontend-design skill, design-system README and Storybook agent workflow; used the existing generated Storybook index and owning production contracts. Read only J10/J11 assessments in round-6 review-a.json/review-b.json. Inspected immutable automated `after/screens-games-word-tiles-board--your-turn--phone--dark.png`, enlarged-coordinates phone/light checkpoint 201, enlarged-blank phone/light checkpoint 712 and their checkpoint manifests. No `.feedback/` directory exists here. No manual QA was performed.

## Exact owned files

- `libs/word-tiles-client-ts/src/word-tiles-blank-geometry.example.tsx`
- `libs/word-tiles-client-ts/src/word-tiles-board-view.stories.tsx`
- `libs/word-tiles-client-ts/src/word-tiles-board-view.tsx`
- `libs/word-tiles-client-ts/src/word-tiles-coordinate.example.tsx`
- `libs/word-tiles-client-ts/src/word-tiles-panels.tsx`
- `libs/word-tiles-client-ts/src/word-tiles-puzzle-player-view.stories.tsx`
- `libs/word-tiles-client-ts/src/word-tiles-puzzle-player-view.tsx`
- `libs/word-tiles-client-ts/tests/word-tiles-blank-targets.test.tsx`
- `libs/word-tiles-client-ts/tests/word-tiles-map.test.tsx`
- `libs/word-tiles-client-ts/tests/word-tiles-puzzle-bonus-context.test.tsx`
- `pkgs/ui-root-client-ts/src/word-tile-board/index.tsx`
- `pkgs/ui-root-client-ts/src/word-tile-board/word-tile-board.module.css`
- `pkgs/ui-root-client-ts/src/word-tile-board/word-tile-overview.module.css`
- `pkgs/ui-root-client-ts/src/word-tile-board/word-tile-overview.tsx`
- `pkgs/ui-root-client-ts/src/word-tile-board/word-tile-view-controls.tsx`
- `pkgs/ui-root-client-ts/src/word-tile-workbench/index.tsx`
- `pkgs/ui-root-client-ts/src/word-tile-workbench/word-tile-workbench.module.css`
- `pkgs/ui-root-harness-ts/tests/word-tile-board.test.tsx`
- `libs/tools-harness-ts/goal/known-bugs/word-tiles-blank-direct-letter-entry.json`
- `libs/tools-harness-ts/goal/known-bugs/word-tiles-blank-duplicate-instruction.json`
- `libs/tools-harness-ts/goal/known-bugs/word-tiles-map-fine-target-detour.json`
- `libs/tools-harness-ts/goal/known-bugs/word-tiles-phone-precision-default.json`
- `libs/word-tiles-client-ts/src/word-tiles-precision.example.tsx`
- `pkgs/ui-root-client-ts/src/word-tile-board/word-tile-regions.tsx`
- `pkgs/ui-root-harness-ts/tests/word-tile-board-precision.test.tsx`

## Red and green evidence

Evidence logs: `.overhaul-evidence/ui-ux-overhaul/round-7/implementation/word-tiles/`.

- `red.log`: direct lowercase `s` at A failed on the old chooser (expected `['S']`, got `[]`).
- `precision-red.log`: literal phone media condition with 15×15 board failed on original board initialization (expected enlarged true).
- `regions-red.log`: CAT/TOE fixture with C selected failed to find `View a1 to e5` against original board/overview; the final regression checks c3 focus, empty c3, retained rack selection and no dialog.
- `duplicate-red.log`: literal AEST?RN blank at j8 found two copies of the instruction before the preview guard.
- Every regression has its own known-bug JSON; paths are in the file list above.
- `green.log`: `bunx turbo run lint tc test --filter=@libs/word-tiles-client-ts --filter=@pkgs/ui-root-client-ts --filter=@pkgs/ui-root-harness-ts --only --concurrency=1`: **9 successful / 9**, 3 cached, exit 0.
- `cache.log`: `bun run cache:sync`: passed, zero edge/slice rewrites.
- `git diff --check`: passed.

Existing accepted CAT, pass, exchange, retry, refusal, disabled, puzzle completion and keyboard tests remain. The existing mode test now queries the live button after the control moves into/out of the context area, rather than retaining a detached node. This does not waive its mode assertions. No bounds, coverage, skips or retries were relaxed.

## Native assertions authored, not yet executed

`word-tiles-precision.example.tsx` runs from the existing `screens-games-word-tiles-board--your-turn` and `screens-games-word-tiles-puzzle--ready` IDs. Before any input it checks real responsive selection, the full viewport box and ≥308×308 area, centered h8 full visibility and ≥44px cells, all nine region controls' full visibility and ≥44px dimensions. It then verifies single-action remote region focus without placement/dialog. The test-only viewport read asserts the production choice; it does not determine production UI behavior.

`word-tiles-coordinate.example.tsx` retains ≥308×308, coordinate clearance, corner/center focus and rack/action visibility assertions. The overview's new placement is asserted below the viewport, within its horizontal bounds and screen bottom, with width ≥132px (replacing the previous side-rail-specific maximum fraction). Full-box checks remain.

`word-tiles-blank-geometry.example.tsx` retains 26 disjoint ≥44px targets and adds exactly-one instruction. `enlarged-blank` uses one `keyboard('s')` instead of 18 Tabs + Enter, checks the target before placement, retains focus return and puzzle bonus assertions. Distant `place-a-word`/`reach-target` puzzle fixtures use actual region navigation before placement; the disconnected a1 and scoring j8 targets are checked before clicks. There is no new autoscroll used to satisfy geometry assertions.

## Exact parent work / pending checks

1. Build the combined source once and run the native Word Tiles matrix in both schemes at 390×844 and 1440×900, plus narrow phone/landscape as required. Preserve failures and initial checkpoints before input. No current screenshot or native pass is claimed.
2. In the parent-owned native checks, add explicit regression registrations for `word-tiles-phone-precision-default` and `word-tiles-map-fine-target-detour` using `screens-games-word-tiles-board--your-turn` and `screens-games-word-tiles-puzzle--ready`, following existing `visualScenarios` + `verifyStoryScenario` registrations. Add direct-entry and duplicate-instruction registrations using `screens-games-word-tiles-puzzle--enlarged-blank`; retain `screens-games-word-tiles-board--assign-a-blank` for pointer letters.
3. Keep round-five/round-six geometry registrations and bounds, especially `word-tiles-blank-chooser-pushes-precision-below-fold`, `word-tiles-cramped-precision-window`, rack corner hit checks, desktop overflow and blank target coverage. A new layout failure needs implementation repair, not a threshold reduction. The context is below the board now, so any other side-only assertion must be replaced with full visible below-board bounds, not deleted.
4. Replay accepted CAT, pass/exchange settlement, lexicon retry, refusal, disabled and solved states. Capture user journeys for one-step coarse navigation and single-letter blank entry. Do not treat synchronous fixture retry as live dictionary/network persistence evidence.
5. Check the visible word/bonus hierarchy and discoverability of the nine region controls through automated screenshots. The local score strip is in the shared frame outside this ownership; this implementation does not change its placement. Phone blank-open overview fit and long current-square labels remain particular risks.
6. Full `bun verify`, coverage, reference review and native evidence are parent-owned and pending under this task's limits.

## Readiness row proposal (parent applies)

In `docs/SELF_SERVICE_READINESS.md`, row `Play Word Tiles`, append to implemented behavior:

> Phones start with 44px precision cells and a persistent whole-board region navigator; nine 44px region targets move focus without placing or consuming a selected tile, while Fit and the keyboard-accessible Map retain full-board reading and exact navigation. Blank letters accept direct A–Z keyboard selection and keep the single instruction, pointer controls and placement-focus recovery.

Append verification paths `pkgs/ui-root-harness-ts/tests/word-tile-board-precision.test.tsx`, `libs/word-tiles-client-ts/tests/word-tiles-map.test.tsx`, `libs/word-tiles-client-ts/tests/word-tiles-blank-targets.test.tsx`, and `libs/word-tiles-client-ts/src/word-tiles-precision.example.tsx`.

Append limitation:

> Round-seven focused lint/typecheck/DOM contracts pass; native geometry, responsive context visibility, blank-open fit, screenshots and release verification remain pending in the combined round-seven evidence. No live transport/persistence claim follows from these fixtures.
