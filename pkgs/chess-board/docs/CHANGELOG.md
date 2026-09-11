# Chess board changelog

## Phase 2 — Imperative drag + CSS theme + geometry

- **Imperative drag ghost:** `createDragGhostController` + `wallScheduleFrame` / `wallCancelFrame` wired through `BoardController` / handlers. `pointermove` while dragging calls `ghost.moveTo` only (no Solid `setDragAt`). Source piece hides via `dragFrom`; ghost `<g>` registered with `ghost.setElement`.
- **Pointer thresholds:** `MOUSE_DRAG_THRESHOLD_PX` (4) vs `TOUCH_DRAG_THRESHOLD_PX` (8) from `pointerType === 'touch'`.
- **CSS theme vars:** `boardThemeToCssVars` → host `--chess-*`. `ChessBoardBackground` paints the 8×8 checker via `repeating-conic-gradient`. Square cells paint overlays only.
- **Geometry snap:** `snapBoardPx` rounds size to a multiple of 8 device pixels.
- **Dev render counts:** bump when `isChessBoardDevInstrumentation()`.
- **API split:** Controlled `ChessBoard` + `SmartChessBoard` adapter; puzzles migrated.

## Phase 3–7 — Interaction, shapes, a11y, beyond, report

- Animation planner (`planPositionDiff`) + WAAPI runner; haptics helper.
- Multi-premove queue; user shapes (arrows + circles + brushes); Chess960 / atomic hooks.
- ARIA live region + `speakMove` / SAN-UCI entry; blindfold + editor tray; `.wrongShake`.
- Final comparison: [`docs/FINAL.md`](./FINAL.md).

## Phase 1 — Audit + instrumentation + bench

- [`docs/AUDIT.md`](./AUDIT.md), render-count registry, bench helpers + `ChessBoardBenchPage`.
