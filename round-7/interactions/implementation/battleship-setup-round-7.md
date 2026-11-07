# J4 Battleship setup — round 7 implementation

Branch: `t3/game-board-ux-overhaul`. Requested source: `863c687fae76c57527d495ec436afcf0ea99539a`. Shared checkout; only the files listed below belong to this handoff. No commits, pushes, builds, native runs, manual QA, specs, reference images, shared targeting files, readiness matrix, or shared native checks were changed.

## Implementation

The production `BattleshipSetupBoard` now defaults to enlarged placement below 640px at mount. `initialPlacement: 'responsive' | 'full' | 'enlarged'` is a closed production prop; responsive is the default and an explicit in-board view choice persists until unmount. Desktop retains the full board. The existing toggle and every existing ID remain. Storybook exposes the same semantic choices and remounts the board on a Controls change while retaining the fixture fleet.

`BattleshipPlacementLayout` gives the full-fleet overview 224px instead of 112px on the 390px phone. Coordinates keep the 12px design-system type; each column has at least 16px. Ship selection/rotation/removal sit beside it. The labeled region selector has its own slot immediately above the guidance and enlarged grid. Guidance aligns to the bottom of the existing reserved refusal space: the board stays stationary on overlap, with no large blank gap below its instructions. Desktop retains the overview beside the working grid. Below 390px the layout stacks to avoid squeezing controls; whole-workspace viewport fit at those smaller widths is not established and scrolling may be necessary.

The enlarged production story now uses pointer placement plus Enter refusal, R rotation, arrow navigation, and Enter recovery. It places Carrier A1 across, Battleship A3 down, Cruiser G2 down, Submarine B8 across, Destroyer B2 across, then repositions Destroyer to I7 across. All four regions are used. The DOM contract also places a complete fleet across four regions and validates the actual emitted fleet through production `acceptFleet`. Existing removal, off-board refusal, full-board keyboard and locked contracts remain. A new enlarged locked test verifies disabled ship/region controls, all 100 overview cells, no editing instructions and no emitted change.

## Exact owned files

- `libs/battleship-client-ts/src/battleship-setup-board.tsx`
- `libs/battleship-client-ts/src/battleship-setup-precision.tsx`
- `libs/battleship-client-ts/src/battleship-setup-board.stories.tsx`
- `libs/battleship-client-ts/src/battleship-setup-placement.example.tsx`
- `libs/battleship-client-ts/tests/setup-precision.test.tsx`
- `pkgs/ui-root-client-ts/src/battleship-placement-layout/index.tsx`
- `pkgs/ui-root-client-ts/src/battleship-placement-layout/battleship-placement-layout.module.css`
- `pkgs/ui-root-client-ts/src/battleship-placement-layout/battleship-placement-layout.stories.tsx`
- `pkgs/ui-root-harness-ts/tests/battleship-placement-layout.test.tsx`
- `libs/tools-harness-ts/goal/known-bugs/battleship-phone-placement-default.json`
- `libs/tools-harness-ts/goal/known-bugs/battleship-placement-overview-legibility.json`
- `libs/tools-harness-ts/goal/known-bugs/battleship-placement-guidance-gap.json`
- This handoff: `implementation/battleship-setup-round-7.md`.

The controller and shared cell-grid-board were not changed. `bun run cache:sync` passed with zero derived files rewritten.

## Evidence and checks

Read only J4 entries from round-six `review-a.json` and `review-b.json`. Inspected immutable `after/screens-games-battleship-setup--empty--phone--light.png`, `after/screens-games-battleship-setup--enlarged-placement--phone--light.png`, both arrange/enlarged checkpoint records, and enlarged phone checkpoint images `003` (initial workspace) and `041` (overlap refusal). These are previous-round automated evidence, not evidence that this implementation renders correctly.

Red: `bunx turbo run test --filter=@libs/battleship-client-ts --only --concurrency=1` failed the literal phone-default regression: expected `setup-precision-cell-a1`, received null (38 passed, 1 failed). After implementation, the owning package passed lint, tc and all 42 tests (530 assertions) with `bunx turbo run lint tc test --filter=@libs/battleship-client-ts --only --concurrency=1`.

The combined requested focused run used `--only --concurrency=1 --continue=always` across `@libs/battleship-client-ts`, `@pkgs/ui-root-client-ts`, and `@pkgs/ui-root-harness-ts`. Six of nine tasks passed: all three type-checks, Battleship lint/test, and UI-client test (139 passed). The focused placement-layout DOM test passed within the UI harness. The overall run remains red on concurrent Word Tiles work:

- UI-client lint: Solid reactivity in `word-tile-board/index.tsx:125` and interactive-role lint in `word-tile-workbench/index.tsx:114`.
- UI-harness lint: deprecated `addListener`/`removeListener` in `tests/word-tile-board-precision.test.tsx`.
- UI-harness test: `tests/word-tile-board.test.tsx:129`, “enlargement retains all squares in an overview and announces the chosen mode” (771 passed, 1 failed).

Those paths belong to other implementation work and were not edited. The earlier combined run also caught targeting work in flight; the final Battleship package run is green. `bun obs last` reported no recent activity; task logs supplied failure evidence. `git diff --check` passed.

Logs are saved under `.overhaul-evidence/ui-ux-overhaul/round-7/implementation/` as `battleship-setup-red.log`, `battleship-setup-shared-checks.log`, and `battleship-setup-owned-checks.log`.

The two geometry regressions have literal production-story assertions and individual known-bug records, but their new red/green native runs have NOT been executed. No browser/pixel/axe/native pass is claimed. No bounds, coverage, tests or baselines were waived.

## Parent native verification and exact integration updates

Keep all existing `screens-games-battleship-setup--*` IDs and `games-battleship-placement-layout--enlarged`. Build and capture only in the parent's authorized integrated run.

1. `Empty`, `Partial`, `Complete`, `Locked` use the responsive production default. At 390px they now open enlarged; at 1440px they remain full. `RefusedOffBoard`, `PlaceAShip`, `ArrangeFullFleet` explicitly exercise the retained full-grid option. `EnlargedPlacement` explicitly starts enlarged: any external journey driver must REMOVE its initial click on `custom-game-setup-enlarge`, which would now close it.
2. The existing native wrappers at `tests/storybook/stories.checks.ts:278` and `:296`, and `board-round-four.checks.ts:17`, invoke the same production story and need no bounds relaxation. Add a wrapper for `screens-games-battleship-setup--empty` at 390px for `battleship-phone-placement-default`, and retain the enlarged wrapper for the two new geometry regression IDs.
3. Before input, assert the entire working grid and overview are in the viewport, the overview is 224px wide, all ten coordinate columns are at least 16px with font at least 12px, and both selectors fit horizontally and vertically. The old 112–176px thumbnail bound is replaced with the explicit 224px readable-overview contract, not removed. Keep cell width 44–64px and height at least 44px. Assert actual guidance/refusal bottom is no more than 8px above the working grid. Keep exact grid-top equality before/after overlap. These assertions are already in the production story helper; DOM tests cannot validate them.
4. Run the enlarged story through all four quadrants and through its keyboard refusal/recovery. Confirm all five ships, then reposition the Destroyer to I7. Retain the full-grid story's remove/re-place branch and off-board and locked stories. Capture initial/default, selected guidance, overlap, completed, repositioned and locked states in both themes and at phone/desktop widths. Check selected-ship and direction text, control clipping, label legibility and all pre-input bounds from the automated artifacts.
5. Run native Controls changes for `initialPlacement` and verify the board changes view while preserving fleet state. Review below-390px stacking separately; it is intentionally not represented as an established whole-workspace fit. Run the parent's full verification and baseline/reference decision process; this implementation did not run `bun verify` because the brief restricts it to focused tasks.

## Exact readiness-row proposal (parent applies)

In `docs/SELF_SERVICE_READINESS.md`, row “Play a custom game”, replace the sentence beginning “Battleship placement keeps labelled Ship and Region selectors” with:

> Battleship setup starts with comfortable enlarged placement on phones, keeps a legible full-fleet overview beside ship controls, and puts the labeled Region selector and selected-ship or refusal guidance immediately above the working grid; a completed fleet explicitly offers repositioning. The full-grid option, rotation, removal, keyboard input, overlap recovery and locked-state explanations remain available.

Retain the existing setup test/story evidence links. Append the new `battleship-setup-placement.example.tsx` geometry-contract link. In the limitation cell, record that round-seven pre-input geometry and native captures remain pending until the integrated run supplies its results; do not imply this DOM handoff establishes live persistence, transport or rendered geometry.
