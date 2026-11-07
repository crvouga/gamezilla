# Word Tiles round 6 implementation

Scope: reviewer B round-5 J10/J11 only. No reviewer A content read. No agents, manual QA, builds, reference edits, specs, commits or pushes. Existing round-5 evidence was read only. Parent-owned history/rail and other game paths were not edited. The Word Tiles readiness-row sentence was updated before the parent requested no further readiness edits; the parent's multiplayer row is preserved.

## Changes

- The match disclosure says **Pass, exchange & tools**. Primary play and exchange confirmation remain exposed; the existing disclosure, disabled actions, Escape and focus recovery remain intact. This retains the compact two-control starting row.
- Blank choices use medium buttons inside the shared `WordTileLetterChoices` wrapper, which enforces both actual width and height of at least the 44px control token. It wraps with separate 4px gaps; no overlapping enlarged hit regions. Keyboard entry focuses A without scrolling; leaving the chooser restores its invoking cell. The product puzzle/board chooser is shared; no puzzle production file needed changing.
- The small overview is explicitly a **Map** locator button (44px wide) with the existing viewport outline. It opens the existing ResponsiveSurface with a complete fitted board, live focused-square description, and ordinary arrow/Home/End navigation. Selecting any location, including committed intersections, closes the map and focuses/reveals that square in the enlarged board without placing a tile or consuming a rack selection. Escape restores the map trigger. The full map reuses WordTileBoard's new closed `purpose="locator"` mode. A private renderer slot removes the overview/board runtime import cycle.
- The map remains outside the precision viewport. Its 44px width plus 4px gap reserves the same 48px as the previous 40px overview plus 8px gap. Existing 308×308 minimum placement checks, rack/actions/corner hit tests, fit/enlarged modes, sticky coordinates, panning, acceptance, exchange, blank assignment and retry coverage are retained.
- Board headers/cells are extracted into the private `word-tile-cell.tsx` module to satisfy structural limits. No limits were disabled.

## Evidence inspected

- `.overhaul-evidence/ui-ux-overhaul/round-5/review-b.json`: only J10 and J11 findings used.
- `.overhaul-evidence/ui-ux-overhaul/round-5/after/screens-games-word-tiles-board--enlarged-coordinates--phone--dark.png`
- `.overhaul-evidence/ui-ux-overhaul/round-5/after/screens-games-word-tiles-puzzle--ready--phone--light.png`
- `.overhaul-evidence/ui-ux-overhaul/round-5/journeys/recordings/checkpoints/screens-games-word-tiles-puzzle--enlarged-blank--phone--light--051.png`

Read AGENTS, frontend-design, UI design contract and the Storybook agent workflow. Used existing static story inventory and production contracts; no static build refreshed.

## Automated results

- Red check restored only the three owned implementation files from HEAD temporarily (finally-restored working content, no git index/ref changes). The generic disclosure, small blank controls and missing readable-map tests all failed; 0/2 Turbo package tasks passed. See `word-tiles-round-6-red.log`.
- Final command: `bunx turbo run tc lint test --filter=@libs/word-tiles-client-ts --filter=@pkgs/ui-root-client-ts --filter=@pkgs/ui-root-harness-ts --only --concurrency=1`. **9/9 tasks passed**. Word Tiles: **25 tests**; UI client: **139 tests**; UI harness: **771 tests**. See final and package-test logs alongside this report.
- `bunx turbo run //#task:cache:sync --only --concurrency=1`: passed, no derived files rewritten.
- Cyclic import, non-null assertion, structural function size and test typing issues encountered during implementation were resolved; final lint/typecheck pass.
- Three individually registered regressions: `word-tiles-hidden-turn-choices`, `word-tiles-blank-small-targets`, `word-tiles-overview-unreadable-context`. Literal product CAT rack, AEST?RN blank-at-j8 and 15-column CAT/TOE map cases are covered. The map test checks all 225 cells, a remote o15 destination, retained rack selection and Escape focus recovery.

## Stories and pending native checks

Existing production stories updated:
- `screens-games-word-tiles-board--assign-a-blank`: all 26 actual button bounds, disjointness and corner hits before letter interaction.
- `screens-games-word-tiles-board--enlarged-coordinates`: named map hit/viewport checks, full-board contents, destination/focus retention and Escape, alongside existing center/corner coordinate and 308px precision checks.
- `screens-games-word-tiles-puzzle--enlarged-blank`: chooser bounds/containment and unchanged rack/actions/308×308 viewport asserted **before** clicking/tabbing can autoscroll; A-to-S native Tab/Enter journey and return to j8; whole-board map interaction.
- `product-wordtileworkbench--secondary-tools`: new discoverable disclosure name.

Native assertions are authored but **not executed on this candidate**, because parent owns the integrated build/run and explicitly deferred builds. DOM tests do not establish CSS dimensions, clipping, hit tests, pixel approval or native viewport containment. Parent should run the above stories at phone/desktop and both themes through the canonical native suite before accepting this candidate. No screenshots or reference images were generated/accepted. The parent reports round-5 Ubuntu run 42294182190 succeeded, with references not accepted; this is not round-6 evidence.

The full map intentionally provides spatial inspection/navigation; it does not make 225 phone cells simultaneously large precision targets. Fit and enlarged/panning remain necessary for precise play. Full `bun verify`, live transport/persistence and new canonical pixel acceptance remain outside this scoped task.

## Exact changed paths in this lane

- `libs/tools-harness-ts/goal/known-bugs/word-tiles-blank-small-targets.json`
- `libs/tools-harness-ts/goal/known-bugs/word-tiles-hidden-turn-choices.json`
- `libs/tools-harness-ts/goal/known-bugs/word-tiles-overview-unreadable-context.json`
- `libs/word-tiles-client-ts/src/word-tiles-blank-geometry.example.tsx`
- `libs/word-tiles-client-ts/src/word-tiles-board-view.stories.tsx`
- `libs/word-tiles-client-ts/src/word-tiles-board-view.tsx`
- `libs/word-tiles-client-ts/src/word-tiles-coordinate.example.tsx`
- `libs/word-tiles-client-ts/src/word-tiles-geometry.example.tsx`
- `libs/word-tiles-client-ts/src/word-tiles-map.example.tsx`
- `libs/word-tiles-client-ts/src/word-tiles-panels.tsx`
- `libs/word-tiles-client-ts/src/word-tiles-puzzle-player-view.stories.tsx`
- `libs/word-tiles-client-ts/tests/word-tiles-blank-targets.test.tsx`
- `libs/word-tiles-client-ts/tests/word-tiles-board.test.tsx`
- `libs/word-tiles-client-ts/tests/word-tiles-map.test.tsx`
- `libs/word-tiles-client-ts/tests/word-tiles-puzzle-bonus-context.test.tsx`
- `pkgs/ui-root-client-ts/src/word-tile-board/index.tsx`
- `pkgs/ui-root-client-ts/src/word-tile-board/word-tile-board.module.css`
- `pkgs/ui-root-client-ts/src/word-tile-board/word-tile-cell.tsx`
- `pkgs/ui-root-client-ts/src/word-tile-board/word-tile-overview.module.css`
- `pkgs/ui-root-client-ts/src/word-tile-board/word-tile-overview.tsx`
- `pkgs/ui-root-client-ts/src/word-tile-board/word-tile-view-controls.tsx`
- `pkgs/ui-root-client-ts/src/word-tile-workbench/index.tsx`
- `pkgs/ui-root-client-ts/src/word-tile-workbench/word-tile-workbench.module.css`
- `pkgs/ui-root-client-ts/src/word-tile-workbench/word-tile-workbench.stories.tsx`
- `pkgs/ui-root-harness-ts/tests/word-tile-board.test.tsx`
- `docs/SELF_SERVICE_READINESS.md` — Word Tiles row sentence only; shared file also contains the parent's separate multiplayer-row edit.

Report and unique logs are under `.overhaul-evidence/ui-ux-overhaul/implementation/word-tiles-round-6*`.
