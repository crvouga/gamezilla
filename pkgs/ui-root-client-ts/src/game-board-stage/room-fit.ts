import { type Accessor, createEffect, createSignal, onCleanup } from 'solid-js';
import { createFrameResizeObserver } from '../observe-element-resize';

/** Below this a board is too small to play; the stage scrolls instead. */
const SMALLEST_BOARD = 184;

/**
 * The widest the board may be and still leave the stage inside its room.
 * `chrome` is what the stage holds besides the board (the seats, the gaps).
 */
export function boardRoomLimit(room: {
  width: number;
  height: number;
  chrome: number;
  boardWidth: number;
  boardHeight: number;
}): number | undefined {
  if (room.boardWidth <= 0 || room.boardHeight <= 0) return undefined;
  const tall = room.height - room.chrome;
  const fitted = Math.floor((tall * room.boardWidth) / room.boardHeight);
  return Math.max(SMALLEST_BOARD, Math.min(Math.floor(room.width), fitted));
}

/**
 * A fixed stage (`GameSessionLayout`'s `fixedStage` on a phone) gives the
 * board a room of a set height. This measures the room, the seats around
 * the board and the board's own shape, and returns the board's widest fit,
 * so a board taller than the room narrows instead of pushing its seats or
 * the commands off the screen. The layout says when it applies
 * (`--game-stage-room`); anywhere else the board keeps its measure.
 */
export function createStageRoomFit(
  root: Accessor<HTMLElement | undefined>,
  board: Accessor<HTMLElement | undefined>
): Accessor<number | undefined> {
  const [limit, setLimit] = createSignal<number>();
  createEffect(() => {
    const stage = root();
    const surface = board();
    const cell = stage?.parentElement;
    const view = stage?.ownerDocument.defaultView;
    if (!stage || !surface || !cell || !view) return;
    const read = () => {
      const fixed = view
        .getComputedStyle(cell)
        .getPropertyValue('--game-stage-room');
      if (fixed.trim() !== '1') {
        setLimit(undefined);
        return;
      }
      const next = boardRoomLimit({
        width: cell.clientWidth,
        height: cell.clientHeight,
        chrome: stage.offsetHeight - surface.offsetHeight,
        boardWidth: surface.offsetWidth,
        boardHeight: surface.offsetHeight,
      });
      // A pixel of rounding never starts another pass.
      setLimit((last) =>
        last !== undefined && next !== undefined && Math.abs(last - next) <= 1
          ? last
          : next
      );
    };
    read();
    const observer = createFrameResizeObserver(view, read);
    for (const target of [cell, stage, surface]) observer?.observe(target);
    view.addEventListener('resize', read);
    onCleanup(() => {
      observer?.disconnect();
      view.removeEventListener('resize', read);
    });
  });
  return limit;
}
