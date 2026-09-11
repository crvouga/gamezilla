# Chess board — Phase 7 final report

## Before / after (vs Phase 1 audit)

| Metric | Phase 1 baseline | After upgrade |
| ------ | ---------------- | ------------- |
| Rules ownership | `ChessBoard` owned chess.js | Controlled `ChessBoard` + `SmartChessBoard` adapter |
| Drag hot path | Solid `setDragAt` every move | Imperative `DragGhostController` + rAF (`wall-frames`) |
| Square paints | 64 fill rects | CSS var host + single checker background (+ overlay highlights) |
| Theme | JS fill props | `--chess-*` CSS custom properties |
| Premoves | Single | Configurable queue (`createPremoveQueue`, max default 5) |
| Shapes | Arrows only | Arrows + circles + modifier brushes |
| Animation | CSS transition only | `planPositionDiff` + `createAnimationRunner` (WAAPI) |
| A11y | Partial keyboard | Live region helpers, SAN/UCI entry, speak-move |
| Variants | None | Chess960 castle dests, atomic explode hook |
| Editor / blindfold | None | `ChessBoardEditorTray`, `BlindfoldMode` |
| Perf harness | None | `ChessBoardBenchPage` + budgets constants |
| Bundle target | — | ≤35 kB gzip excl. pieces (guard via package size) |

Chrome DevTools traces (4× throttle): run `ChessBoardBenchPage` in the explorer / product console and attach numbers to `AUDIT.md`.

## Feature comparison

| Feature | Ours | chess.com | chessground |
| ------- | ---- | --------- | ----------- |
| Click + drag mix | Yes | Yes | Yes |
| Premoves (multi) | Yes (queue) | Yes | Limited / config |
| Promotion picker + auto-queen | Yes | Yes | Yes |
| User arrows + circles | Yes | Yes | Yes |
| Knight L-arrows | Yes | Yes | Yes |
| Sounds (Web Audio) | Yes | Yes | Partial |
| Haptics hook | Yes | Yes | No |
| Controlled dests API | Yes | N/A (app) | Yes |
| Stable piece identity slides | Yes | Yes | Yes |
| Imperative drag ghost | Yes | Yes | Yes |
| CSS-variable theming | Yes | Partial | Partial |
| ARIA live move speech | Helpers + region | Partial | No |
| Keyboard SAN/UCI | Yes (core) | Yes | No |
| Blindfold modes | Yes | Yes | No |
| Board editor tray | Yes | Yes | Yes (editor) |
| Atomic explode hook | Yes | Variant site | Via plugins |
| Chess960 castle onto rook | Dest helpers | Yes | Yes |
| Puzzle shake affordance | CSS `.wrongShake` | Yes | Via app |

## Known limitations

1. Controlled `ChessBoard` still reuses the smart paint pipeline for fen-driven piece rows; full dests-only rules without chess.js paint path is incremental.
2. Visual regression / Playwright gesture suite not fully expanded to every edge case in CI yet — core unit coverage is strong; add Playwright under `@apps/product` when live-game mounts exist.
3. Piece sets: still Cburnett only (lazy multi-set not shipped).
4. History scrub UX is supported via fen stream + diff planner; dedicated wheel-binding lives with the parent (review board).
5. Crazyhouse pockets: tray pattern exists for editor; pocket drop dests are parent-owned.
6. Full Chrome INP traces remain operator-run via the bench page.

## Test surface

- `@pkgs/chess-board-core`: game, interaction, piece-rows, geometry, arrows, premove-queue, position-diff, shapes, a11y, variants, …
- `@pkgs/chess-board`: mount, pointer-session, keyboard-nav, theme, render-counts, drag-ghost, blindfold

## How to verify budgets

```bash
bun run --filter @pkgs/chess-board-core test
bun run --filter @pkgs/chess-board test
# Open ChessBoardBenchPage in settings explorer / product console
```
