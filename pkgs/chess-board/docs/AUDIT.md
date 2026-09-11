# Chess board audit (Phase 1)

Baseline written from code analysis of `@pkgs/chess-board` + `@pkgs/chess-board-core`. Chrome Performance traces (4× CPU throttle) are to be captured via the bench page (`ChessBoardBenchPage`); numbers below marked *pending trace* until that run.

## Architecture

| Layer | Location | Role |
| ----- | -------- | ---- |
| Rules | `chess-board-core` `ChessGame` (chess.js) | FEN, legal moves, last move, check |
| Interaction FSM | `BoardInteraction` | select / drag / drop / single premove / promotion |
| Piece identity | `createPieceRowsTracker` | Stable `ChessPieceRow.id` across plies |
| Solid binding | `createChessBoardModel` + `ChessBoard` | Owns game + interaction; paint via `ChessBoardView` |
| Layers | squares → pieces → arrows → feedback → promotion | Separate SVG/DOM stacks |

**Gap vs target:** public board owns rules. Plan: controlled `ChessBoard` view (`position` / `movable.dests`) + optional `SmartChessBoard` adapter wrapping `ChessGame`.

## Reactivity

- Snapshot subscriptions (`ChessGame` / `BoardInteraction`) → Solid signals in the model.
- Drag hot path: `onPointerMove` → `setDragAt({ x, y })` every move (`chess-board-handlers.ts`). That re-enters the reactive graph for the whole piece layer.
- Geometry: `getBoundingClientRect` cached on down + `ResizeObserver`; cleared on up/cancel. Context-menu path still needs a careful audit for stray layout reads.

## Rendering

- **Squares:** 64 `<rect>` fills via `SquareCell` + `For` over `BOARD_SQUARES` (not a single background layer).
- **Theme:** JS `BoardTheme` object merged and passed as fill/stroke props — not CSS custom properties on the host.
- **Pieces:** SVG `<image>` per row; CSS `transition: transform 150ms` for slides (`--chess-move-ms`).
- **`<For>` + stable row identity:** `createPieceRowsTracker` mutates/reuses the same `ChessPieceRow` object when an id survives a ply (`adoptRow`). Solid `<For>` reconciles by **object identity**, so surviving pieces keep their DOM nodes and only `transform` / `href` update. Prefer this over `<Index>` (index-keyed) so a piece sliding e2→e4 does not unmount/remount. Documented choice for Phase 2+.

## Events

- Primary pointer → `PointerSession` (4px drag threshold) → `BoardInteraction`.
- Right-click arrows via `createUserArrows` (toggle same from→to; no circles).
- Keyboard: arrow-key cursor + Enter/Space pick up/drop (`keyboard-nav` + handlers). No spoken live region / SAN entry yet.

## Animation

- CSS transform slide only; not interruptible/retargetable (WAAPI planner pending Phase 3).
- Capture ghost fades at vacated square; comments mention lift scale but **drag piece has no scale / finger lift offset** in the transform path.
- Castling / en passant identity handled in `piece-rows`; no explicit multi-motion planner yet (Phase 3 `planPositionDiff`).

## Accessibility

- Hit grid of focusable squares + arrow nav (partial).
- Missing: ARIA live spoken moves, full axe-clean themes, colorblind/high-contrast CSS-var themes, keyboard SAN/UCI entry.

## Bugs / jank (reproducible from code)

1. Drag ghost updates via Solid signals → extra work per `pointermove` (jank risk on mid-range Android).
2. Missing drag lift scale / touch finger offset (comment vs implementation).
3. Theme colors as JS fills → harder theming and more attribute churn than CSS vars.
4. 64 square paints every theme/selection path instead of one background + overlay highlights.
5. Single premove only (`BoardInteraction.premove`).
6. No circle shapes; brushes limited to arrow color keys.
7. Thin UI gesture tests relative to core unit coverage (pointer-session + mount smoke only).
8. `getBoundingClientRect` / reactive drag coupling risk under 4× throttle (*pending trace*).

## Baseline metrics

| Metric | Budget (plan) | Code-analysis estimate | Trace |
| ------ | ------------- | ---------------------- | ----- |
| Mount scripting (desktop) | ≤ 5 ms | ~1 SVG host + 64 cells + ~32 piece images; likely near budget before adapter split | *pending* |
| Pointer-down → paint | ≤ 16 ms (1 frame) | Signal write + piece `<For>` invalidate | *pending* |
| INP (board interactions) | ≤ 50 ms | Drag path allocates `{x,y}` each move | *pending* |
| Long tasks while scrubbing 200 plies | none > 50 ms | FEN apply + rematchRows per ply | *pending* |
| Drag @ 60 fps (4× CPU) | 0 dropped frames | Unlikely while drag is reactive | *pending* |
| 20 boards scroll | smooth | N×64 squares + pieces; isolation unproven | *pending* |
| Board JS gzip (excl. piece SVGs) | ≤ 35 kB | Packages still small | *pending* |

Run traces from `ChessBoardBenchPage`: “Run drag sim”, “Scrub 200 plies”, “Mount 20 boards”. Dev render counts: `import.meta.env.DEV && globalThis.__CHESS_BOARD_DEV__ === true`.

## Prioritized issues (feeds Phases 2–6)

### P0 — Phase 2 (architecture / perf)

- Imperative drag ghost + rAF; leave Solid graph on `pointermove`.
- Controlled view + `SmartChessBoard`; no dual deprecated API.
- CSS variables for theme; single background square layer.
- Prove budgets vs this baseline; render-count O(changed) on one move.

### P1 — Phase 3 (interaction / animation)

- Touch lift (scale ~1.08, offset ~0.15 cell) + cancel/snap-back.
- `planPositionDiff` + interruptible WAAPI (castling, EP, multi-ply scrub).
- Hover/target rings; haptics hook; reduced-motion honored end-to-end.

### P2 — Phase 4 (premoves / shapes)

- Multi-premove queue + visualization + flush.
- Circles + Shift/Alt/Ctrl brushes; knight L-arrows.
- Promotion UX (inline, underpromote modifier); Chess960 dests hook.

### P3 — Phases 5–6 (a11y / beyond)

- Live region, axe-clean, SAN/UCI keyboard.
- Blindfold, editor, history scrub, variants, 20-board isolation, puzzle affordances.
