# Chess Board Debugging Notes (session 2818a3)

## Working mental model (verified by runtime evidence)

- `ChessBoardView` renders an SVG piece/square layer (all `pointer-events: none`)
  and an invisible 8×8 `<button>` hit grid on top (default stacking order,
  both absolute).
- Pointer events: bubbling `pointerdown` on a grid button reaches the host
  Box's Solid `onPointerDown`, which (button 0) calls
  `host.setPointerCapture(event.pointerId)` BEFORE `session.down(sq)`.
- `PointerSession.down` → `BoardInteraction.beginDrag(from)` when the pressed
  square is a side-to-move piece; returns false otherwise.
- `up` → `finishDrag(from, wasSelected, to)`; `to !== from` → `drop(from, to)`.

## Evidence captured (2026-09-08)

- Chess screen navigation: dispatch reaches the room (`hasEntry: true`),
  selector updates `root → puzzle`, and the play screen mounts.
- Test later times out waiting for the board probe to report size > 0
  (`chess-puzzle-board ready`), i.e. the board renders but the probe size is
  zero in the headless sim DOM.
- Drags are built on `boardPx` (ResizeObserver / `getBoundingClientRect`)
  which is 0 when the host has no layout.

## Open question

Is the drag gesture broken in the real app (pieces can't be picked up), or
was the user describing the test failure? The probe-size-0 failure is a
headless-layout artifact; the drag pipeline itself (handlers → session →
interaction) has no observed defect. Confirm with a real-sim reproduction
before touching board/pointer code.