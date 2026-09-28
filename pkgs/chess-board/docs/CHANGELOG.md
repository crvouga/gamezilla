# Chess board changelog

## Performance pass

- Rules: one legal-move generation per snapshot (was ~3); a move's status
  comes from its snapshot (was computed twice); clearing the last-move
  highlight recomputes nothing; external FENs reuse the cached position.
- Pick-up: legal destinations from chess.js's generator in one pass (the
  verbose public API cost a full-board generation + two FENs per
  destination), cached per position; premove targets cached too.
- Gestures flush reactively once (`batch`); the drag move path allocates
  nothing.
- Hit grid: static buttons (CSS rotation for black), one `focusin`
  listener, selector-driven `tabIndex`, no pointer events, under the pieces;
  grab cursors via one host attribute.
- Empty annotation layers are not rendered; the hover ring is not promoted;
  the hidden avatar has no box; pieces are `contain: strict`.
- One shared audio bank per port; unused theme variables dropped; a
  fill-width resize no longer rebuilds the host style; production paint
  tokens are a load-time no-op.

## Touch drag polish

- A finger holds the dragged piece by its base (the art's feet), so the
  whole piece shows above the fingertip; the piece is grown 1.8× (sized, so
  crisp — now on low-end devices too) and 80% opaque so the landing square
  shows through. Mouse drags stay centred, true size, opaque.
- Release hands the piece back at the avatar's exact centre and size; the
  settle animates the zoom away.

## Touch pass

- A movable piece is picked up on `pointerdown` (jumps under the pointer /
  above the finger at once); a release before the drag threshold is a tap on
  the pressed square and snaps home.
- The dragged piece is a top-layer avatar (Popover API, fixed max-z-index
  fallback): above everything, visible outside the board and any clipping
  ancestor. The real piece stays faded on its square and takes over on
  release.
- Touch: crisp enlarged piece (sized, not scaled), halo on the target square.
- Cheaper presses: one layout read, no `getComputedStyle`, no per-press
  observer, defaults prevented (no compatibility mouse events / focus churn).
- Fixed: an Android long-press (`contextmenu`) cancelled the held piece.

## Compositor rewrite

- Pieces, washes and hints are one-cell HTML boxes placed by percent
  `transform`; piece art is inline SVG in the stylesheet.
- Slides are Web Animations on `transform` from the painted position:
  drops settle, illegal drops spring back, mid-flight moves retarget.
- Drags move the real piece: one style write per pointer move; press-scoped
  native listeners; hover ring on the target square.
- Motion policy: reduced motion (live), no Web Animations, low-end devices,
  hidden pages; `animationDurationMs`.
- Parity: every premove highlighted, right-click / Escape cancel, right button
  cancels a drag, live arrow preview, touch lift + haptics, chess.com-style
  translucent washes and coordinates.
- Fixed: arrows ignored a flip; Windows right-drags drew nothing; a second
  finger could steer / drop a drag.
- The probe and paint tokens are dev / test only.
- `SmartChessBoard` is now `ChessBoard`. The old `ChessBoard` (a "controlled"
  wrapper whose `movable.dests`, `position`, `lastMove`, `check` and premove
  callbacks were ignored) is gone, as are unused modules (WAAPI runner,
  position-diff planner, editor tray, blindfold, SAN entry, variant helpers).
- Design and proof: [`ARCHITECTURE.md`](./ARCHITECTURE.md).

## Earlier

- Imperative drag ghost, CSS-variable theme, single checker background,
  premove queue, user shapes, Web Audio sounds, ARIA live region.
