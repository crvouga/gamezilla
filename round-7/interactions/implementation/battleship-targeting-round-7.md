# J5 targeting implementation — round 7

Implemented in the shared checkout without commits, pushes, builds, manual QA, reference/spec edits, agents, or native runs. Setup files, shared cell-grid-board, battleship-copy, readiness matrix and shared stories.checks.ts were not edited by this implementation.

## Evidence read

Only J5 entries from `.overhaul-evidence/ui-ux-overhaul/round-6/review-a.json` and `review-b.json` informed changes. Inspected these retained automated images, plus the correction journey checkpoints JSON:

- `after/screens-games-battleship-board--your-turn--phone--light.png`
- `journeys/recordings/checkpoints/screens-games-battleship-board--correct-target-before-firing--phone--light--042.png`
- `after/screens-games-battleship-board--sink-the-fleet--phone--light.png`
- `journeys/recordings/screens-games-battleship-board--correct-target-before-firing--phone--light.checkpoints.json`

Paths above are relative to the round-6 directory. Read AGENTS, frontend-design, the UI design contract, Storybook agent workflow, existing inventory, production grid and panel contracts, and readiness requirements.

## Result

The default targeting workspace retains every cell/outcome in a labelled whole-field map. Ten directly exposed coarse region buttons select five columns by two rows; the precise grid is present immediately. No enlargement or dropdown step is needed. Region changes preserve the tentative shot until corrected or canceled. The compact Map/Aim toggle is optional; existing whole-field cell IDs and direct targeting/automation remain available. Region controls have visible coordinate endpoints and accessible range names. The existing palette, glyphs and coordinate type size are reused. Layout uses intrinsic wrapping so narrower widths give the precise grid its full line.

All existing story IDs, full-field cell IDs, Fire/Cancel, region/tool and view IDs remain. `area-0` through `area-3` now identify the first four two-row regions; `area-4` through `area-9` complete the field. `aim-grid` and `aim-<cell>` identify the default precise picker. Native consumers must not interpret the original area indices as quadrants anymore.

The production confirmation/refusal/pending logic is unchanged. Miss/hit/sunk stories still use the production resolver; the victory story still shows the entire defeated fleet. Board vertical spacing is reduced from md to xs. No outcome or legend entry was removed.

## Exact owned files

Modified:

- `libs/battleship-client-ts/src/battleship-board.tsx`
- `libs/battleship-client-ts/src/battleship-target-grid.tsx`
- `libs/battleship-client-ts/src/battleship-targeting.example.tsx`
- `libs/battleship-client-ts/src/battleship-board.stories.tsx`
- `libs/battleship-client-ts/tests/targeting-precision.test.tsx`

Added:

- `libs/battleship-client-ts/tests/targeting-default.test.tsx`
- `libs/tools-harness-ts/goal/known-bugs/battleship-default-precision-loses-whole-field.json`
- `libs/tools-harness-ts/goal/known-bugs/battleship-target-context-below-fold.json`
- `pkgs/ui-root-client-ts/src/battleship-target-layout/index.tsx`
- `pkgs/ui-root-client-ts/src/battleship-target-layout/battleship-target-layout.module.css`
- `pkgs/ui-root-client-ts/src/battleship-target-layout/battleship-target-layout.stories.tsx`
- `pkgs/ui-root-harness-ts/tests/battleship-target-layout.test.tsx`
- `implementation/battleship-targeting-round-7.md`

## Red / green results

- **Observed red:** new literal 100-cell fixture in `targeting-default.test.tsx` fails against the original implementation because `precise-aim-grid` does not exist. Turbo test run: 39 pass / 1 fail. Log `/tmp/battleship-targeting-r7-red.log`.
- **Green:** `bunx turbo run lint tc test --filter=@libs/battleship-client-ts --only --concurrency=1` — all three tasks successful after implementation. Final repeat restores all three from cache. Logs `/tmp/battleship-targeting-r7-check.log` and `/tmp/battleship-targeting-r7-final.log`.
- **Green:** both UI packages' typechecks and UI-client tests in the six-task run. The new UI harness keyboard/pointer contract passes.
- **Shared-check failures, outside ownership:** the six-task UI run had 772 passing harness tests and one failure in `tests/word-tile-board.test.tsx`, “enlargement retains all squares in an overview and announces the chosen mode”. It also found Word Tiles accessibility lint and deprecated listener stubs. Log `/tmp/battleship-targeting-r7-ui-final.log`.
- **Latest static check:** `bunx turbo run lint tc --filter=@pkgs/ui-root-client-ts --filter=@pkgs/ui-root-harness-ts --only --concurrency=1 --continue=always` — three of four successful: both typechecks and UI-client lint pass; harness lint still fails on `addListener` / `removeListener` in concurrent `tests/word-tile-board-precision.test.tsx`. Log `/tmp/battleship-targeting-r7-ui-static-final.log`. Did not edit those files or waive failures.
- **Green:** scoped Biome formatting/checks; `git diff --check`.
- **Green:** `bun run cache:sync`, zero derived files rewritten.

The viewport bug's red evidence is the supplied round-6 screenshot/review, not a new browser execution. Its pre-input regression is authored but has NOT been run in a browser. No claim that geometry, native checks, references, coverage, or full verification are green.

## Parent native updates and pending checks

Do not weaken existing bounds or coverage. Build/recollect through the parent's authorized automated workflow. The existing `correct-target-before-firing` native regression still invokes the same story ID, now running the default precise route. Add the following literal cases to `pkgs/ui-root-harness-ts/tests/storybook/stories.checks.ts` beside the existing Battleship checks:

```ts
// regression: battleship-default-precision-loses-whole-field
test('screens-games-battleship-board--correct-target-before-firing regression battleship-default-precision-loses-whole-field', async ({ page }) => {
  await verifyBoardRegression(page, 'screens-games-battleship-board--correct-target-before-firing', 390);
});

// regression: battleship-target-context-below-fold
test('screens-games-battleship-board--your-turn regression battleship-target-context-below-fold', async ({ page }) => {
  await verifyBoardRegression(page, 'screens-games-battleship-board--your-turn', 390);
});
```

`YourTurn`, all four outcome journeys, and correction now measure the initial map, precise picker, coarse controls, Fire, optional mode control and `custom-game-seat-near` before any input. All coarse buttons and precise cells must be at least 44×44. Correction measures again after cross-region selection and before cancellation/commit; it retains the previous <=64px upper target bound. The journey selects B1, changes directly to region 9 without spending a shot, corrects J9 to J10, cancels, then explicitly fires J10. No story-only viewport branching or scrollIntoView was added.

Pending parent work:

1. Run all Battleship board native stories in both themes at phone and desktop, including existing refusal, keyboard, victory and spectator contracts; inspect captured automated geometry/checkpoints. Check narrower wrapping too. The intrinsic wrapping is implementation, not measured proof.
2. Collect changed automated images/videos and judge the map's 12px coordinate/glyph readability, coarse-region clarity, and local-player strip fit. The full map remains directly selectable as an optional fine route; comfortable default selection is the coarse button plus precise picker.
3. Include `games-battleship-target-layout--precise` and `--map-only` in generated discovery/coverage; collect references only via the parent's authorized reference workflow. No references were changed here.
4. Resolve concurrent Word Tiles check failures, then run the integrated gate and full `bun verify` under parent ownership.

## Readiness row proposal

For the existing Battleship row in `docs/SELF_SERVICE_READINESS.md`, append to current recovery/UX behavior:

“Targeting opens with a whole-field outcome map and a precise two-row picker. Direct coarse areas avoid repeated enlargement or region menus; area changes preserve tentative aim, Cancel clears it, and only Fire spends the shot. Full-field outcomes and enemy-fleet victory context remain available.”

Add evidence links to `libs/battleship-client-ts/tests/targeting-default.test.tsx`, `libs/battleship-client-ts/src/battleship-targeting.example.tsx`, `pkgs/ui-root-harness-ts/tests/battleship-target-layout.test.tsx`, and both new bug IDs. Add this limitation until native evidence lands:

“Round-seven pre-input 44px geometry and local-seat viewport checks are authored; native browser, reference, accessibility and full-gate results remain pending. Board fixtures do not establish live transport or persisted recovery.”
