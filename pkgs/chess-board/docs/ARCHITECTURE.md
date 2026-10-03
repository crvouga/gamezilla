# Chess board architecture

`ChessBoard` (`src/chess-board.tsx`) is a Solid board that embeds the rules
(chess.js through `@pkgs/chess-board-core` `ChessGame`): a parent passes a FEN,
hears `onMove`, and confirms by passing the next FEN (or rejects by bumping
`fenSyncKey`).

## Rendering: compositor first

| Layer (bottom → top) | Element | Changes when |
| --- | --- | --- |
| Checker | one `div`, `repeating-conic-gradient` | theme |
| Square washes, legal hints, cell highlights, hover ring, coordinates | one-cell `div`s (only squares that show something) + one coordinates SVG | selection / move / flip |
| Pieces | one-cell `div` per piece, inline SVG background in CSS | its own square / code |
| Circles, arrows (+ live preview) | SVG | shapes / flip |
| Feedback badges | SVG | parent `cellFeedback` |
| Hit grid (under the pieces) | 64 static transparent buttons (focus, a11y, test ids) | cursor (2 `tabIndex` writes) |
| Dragged piece | an *avatar* outside the board, in the page's top layer | every pointer move |

Every box is placed with `translate(col·12.5cqw, row·12.5cqw)` — units of the board content
width — so a resize rewrites nothing and every motion is a `transform`.

- **Slides** are Web Animations on `transform` (`piece-animator.ts`), with transform-only keyframes. Native browser checks sample the painted
  timeline and gate frame work independently of the rules state. A slide always starts from where the piece is
  *painted*: its previous square, the pointer (a drop settles, an illegal drop
  springs back), or mid-flight (a reply landing during a slide retargets; an authoritative replacement settles immediately).
- **Pick-up is on the press.** Pressing a movable piece lifts it under the
  pointer in that same event — not on the first move. A mouse holds it by
  its centre at true size (chess.com desktop); a finger holds it by its
  *base*, grown 1.8× and 80% opaque, so the whole piece shows above the
  fingertip and the square it will land on shows through it. Until the pointer travels past a small threshold (4px mouse, 8px
  touch) the release still counts as a tap on the pressed square, so finger
  wobble across a square edge never drops on a neighbour; such a tap snaps
  home without a settle.
- **Drags** are drawn by one avatar per board (`piece-drag.ts`) in the
  browser's top layer (Popover API; a fixed element at max z-index on
  `<body>` where that is missing). It is above everything and clipped by
  nothing — a piece dragged off the board, or out of an `overflow: hidden`
  frame, stays visible. It is placed straight from `clientX / clientY`: one
  style write per `pointermove`, written in the event (a later frame would
  add latency), no layout math, no Solid work. It is *sized* to its zoom, not
  CSS-scaled, so a grown piece is crisp. The real piece stays on its square,
  faded; on release it takes over at the avatar's exact spot and settles.
  The hover ring (a halo twice the square on touch) moves only when the
  pointer crosses into another square.
- **Idle hover runs no script.** The host listens for `pointerdown` /
  `contextmenu` only; move / up / cancel listeners exist for the life of a
  press (`chess-board-pointer.ts`). Cursors come from CSS.
- **Presses are cheap on slow phones.** One layout read per press
  (`getBoundingClientRect` + `clientLeft/Top/Width`, no `getComputedStyle`,
  no observer), re-read only if the page scrolls mid-press. The board
  prevents the press's defaults: no compatibility mouse events after a touch,
  no text selection, no focus churn (a mouse press focuses its square itself
  so keyboard play continues).
- **A move touches only what moved.** Pieces keep identity across plies
  (`createPieceRowsTracker`), so `<For>` keeps every node and only the moved
  pieces' transforms change.
- **Production pays nothing for testing.** The probe (a chess.js parse + JSON
  of the board) renders only when `COMPONENT_IDS_ENABLED` (dev / test
  builds); in production the paint tokens are a no-op component chosen at
  load (not even a `<Show>`).

## Performance budget (each item has a test)

| Path | Cost |
| --- | --- |
| Idle pointer over the board | no script, no DOM write |
| Pick-up (press) | one layout read; legal targets reused from the game-status move generation (chess.js internal generator — the public verbose API costs a full-board generation *per destination*, plus two FENs); one reactive flush (`batch`) |
| Each drag move | one style write on the whole page (the avatar), no allocation beyond the transform string, no Solid work |
| Tap release on a piece | no re-render (picked up → selected paints the same) |
| Batching rule | pick-up, cancel, Escape and a tap on the piece itself are one `batch`; a release that may play a move never is — the parent's `onMove` must run with its own effects (a batched `onMove` lost offline puzzle outcomes) |
| A move | only the moved pieces are restyled; the hit grid changes only the two buttons trading focus; grab cursors are one host attribute (`data-grab`), not a class per square |
| Rules per move / external FEN | **one** legal-move generation for the whole status (check, mate, stalemate, draws); clearing the last-move highlight recomputes nothing; repeated target reads hit a per-position cache |
| Flip | pieces re-seat; the 64 hit targets use the same content-width transforms (no node moves) |
| Compositing | nothing is stacked above a sliding piece unless it has content: empty arrow / circle / badge layers are not rendered, the hit grid is below the pieces, the hover ring is not promoted, the avatar has no box while hidden; pieces are `contain: strict` leaves |
| Many boards on a screen | one shared bank of 7 audio players per audio port, not 7 per board |


## Motion policy

`resolveMotionPolicy` (`board-motion.ts`) decides once from:

| Input | Effect |
| --- | --- |
| `animations={false}` / `animationDurationMs={0}` | pieces snap |
| `prefers-reduced-motion: reduce` (iOS Reduce Motion, Android "Remove animations", Windows / macOS toggles) — live | pieces snap, no capture fade |
| No Web Animations in the engine | pieces snap (no ghost over a slide that never runs) |
| Low-end device (`deviceMemory` ≤ 2, ≤ 2 cores, Save-Data) | slides stay (compositor-only) but the paint-heavy capture fade goes |
| Hidden page | the slide is skipped |

The environment is injected (`BoardMotionProvider`); without one the board
reads the browser's (`createWallMotionEnvironment`). Tests inject a recording
environment that logs every slide.

## Interaction parity with chess.com

| Feature | Status |
| --- | --- |
| Click-click and drag moves, mixed; drag threshold per pointer type | yes |
| Legal-move dots / capture rings; last-move and selection washes (translucent) | yes |
| Hover ring on the square under a dragged piece | yes |
| Dropped piece settles; illegal / off-board drop springs back | yes |
| Opponent moves, castling (king + rook), en passant, promotions slide | yes |
| Capture: victim stays under the attacker for the slide | yes |
| King dropped on its own rook castles | yes (`ChessGame`) |
| Promotion picker on the promotion file; auto-queen option | yes |
| Premoves: several queued, all highlighted with ghosts, played one per reply | yes |
| Right-click cancels premoves / selection; right button during a drag cancels it | yes (a touch long-press never cancels a drag) |
| Piece picked up on the press; dragged piece above everything, visible off the board | yes |
| Escape cancels drag, selection, promotion and premoves | yes |
| Right-drag arrows (live preview, knight L-arrows), right-click circles, modifier brushes | yes |
| Keyboard play: arrow-key cursor, Enter / Space pick up and drop | yes |
| Spoken moves (ARIA live region) | yes |
| Move sounds (move / capture / check / castle / promote / illegal / game end) | yes |
| Touch: piece held by its base above the finger, enlarged and see-through; halo on the target square; haptics on pick-up / illegal | yes |
| Configurable animation speed | yes (`animationDurationMs`) |
| Coordinates inside the edge squares in the opposite square color | yes |
| Premoves chained off an earlier premove's destination | no — premoves are validated against the real position |
| Piece sets / board themes picker | no — Cburnett pieces; colors via `theme` |

## How it is proven

`bun check` is the proof; nothing here is verified by hand.

- `tests/steps` and `tests/quint` bind the business scenarios and temporal
  models in `specs/chess-board` through the public example app. Canonical
  move matrices independently check complete positions and callback payloads;
  `motion-adapter.contract.test.tsx` checks compositor requests and cancellation.
- `tests/browser` exercises the compiled public board in a native browser:
  real frame geometry, fresh reference rasters, accessibility and measured
  input/frame budgets. [CONFORMANCE.md](CONFORMANCE.md) maps these checks.
- `tests/chess-board-input.test.tsx` — input and DOM write contracts:
  idle hover writes nothing; each drag move is
  exactly one style write *on the whole page* (the avatar); a move restyles
  only the moved piece; the press itself picks the piece up; the avatar lives
  outside the board and follows off it. Regression pins for bugs found.
- `tests/piece-animator.test.ts` — model-based: under any sequence of
  placements, grabs, drags, releases and time, a piece has at most one slide,
  it heads for the resting place, and the piece ends there.
- `tests/board-motion.test.ts`, `tests/piece-drag.test.ts` — properties of the
  motion policy, hit testing, drag geometry and drag / hover write counts.
- `tests/chess-board-input.test.tsx` "render budgets" and
  `tests/chess-board-sounds.test.tsx` — the per-path budgets above.
- `@pkgs/chess-board-core` `game-status.test.ts` / `destinations.test.ts` —
  status and destinations equal chess.js's public answers on random games,
  at one move generation (counted).
- `libs/chess` spec — puzzles played through the board.
