import { type Accessor, createEffect, createSignal } from 'solid-js';
import { createFrameResizeObserver } from '../observe-element-resize';

/**
 * Below this a board is too small to play; the stage scrolls instead. A
 * chess board takes no moves under 196px inside its 2px border, so a
 * narrower one would show a board nobody can move on.
 */
const SMALLEST_BOARD = 200;

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
  /** A board nobody moves on (a finished game) may go below `SMALLEST_BOARD`. */
  smallest?: number | undefined;
}): number | undefined {
  if (room.boardWidth <= 0 || room.boardHeight <= 0) return undefined;
  const tall = room.height - room.chrome;
  const fitted = Math.floor((tall * room.boardWidth) / room.boardHeight);
  return Math.max(
    room.smallest ?? SMALLEST_BOARD,
    Math.min(Math.floor(room.width), fitted)
  );
}

/**
 * The smallest board the layout allows here (`--game-board-smallest`, in
 * pixels, set where the board takes no moves), or the playable smallest.
 */
function smallestIn(style: CSSStyleDeclaration): number | undefined {
  const set = Number.parseFloat(
    style.getPropertyValue('--game-board-smallest')
  );
  return Number.isFinite(set) && set > 0 ? set : undefined;
}

/** How much narrower to try when a narrowing drew the same height. */
const ROUNDING_STEP = 4;

/** Narrowings tried before one is shown; a board that settles needs few. */
const FIT_TRIES = 8;

/**
 * `boardRoomLimit`, tried before it is shown: `heightAt` is the board's
 * height laid out at a width. Each narrowing is measured, and the limit
 * taken again from the board's measured shape, until the stage fits its
 * room or the board is at its smallest; only that width is shown, so the
 * board never steps through the tries. A board that grows no shorter when
 * narrowed (its own tools wrapping under it) keeps its width, and the
 * stage scrolls for the rest. Widening is not tried: it only gives back
 * room.
 */
export function boardRoomFit(
  room: Parameters<typeof boardRoomLimit>[0] & {
    heightAt: (width: number) => number;
  }
): number | undefined {
  let board = { width: room.boardWidth, height: room.boardHeight };
  let limit = boardRoomLimit(room);
  // Each try is a layout: the rounding step below is taken once at most.
  let stepped = false;
  for (let tries = 0; tries < FIT_TRIES; tries++) {
    if (limit === undefined || limit >= board.width) return limit;
    const height = room.heightAt(limit);
    if (height >= board.height) {
      // A board that grows no shorter when narrowed keeps its width. But a
      // pixel or two narrower can draw the very same height (its cells are
      // whole pixels): then step on instead of giving up.
      const rounding =
        !stepped &&
        height === board.height &&
        board.width - limit < ROUNDING_STEP;
      if (!rounding) return undefined;
      stepped = true;
      limit = Math.max(room.smallest ?? SMALLEST_BOARD, limit - ROUNDING_STEP);
      continue;
    }
    board = { width: limit, height };
    if (height + room.chrome <= room.height) return limit;
    limit = boardRoomLimit({
      ...room,
      boardWidth: board.width,
      boardHeight: board.height,
    });
  }
  return limit;
}

/** The room and board `boardRoomFit` measured, and what it found. */
type RoomFitCache = {
  readonly key: string;
  readonly fit: number | undefined;
};

/**
 * `boardRoomFit`, tried again only when the room or the board changed: a
 * board that redraws itself (a move, a highlight) without changing its
 * room or its size reuses the last fit instead of laying out its tries
 * again before the next paint.
 */
export function createBoardRoomFitter(): (
  room: Parameters<typeof boardRoomFit>[0]
) => number | undefined {
  let cache: RoomFitCache | undefined;
  return (room) => {
    const key = [
      room.width,
      room.height,
      room.chrome,
      room.boardWidth,
      room.boardHeight,
      room.smallest,
    ].join(' ');
    if (cache?.key === key) return cache.fit;
    const fit = boardRoomFit(room);
    cache = { key, fit };
    return fit;
  };
}

/**
 * The board's height at `width`, laid out and read before the next paint
 * and then put back, so nobody sees the try.
 */
function heightAt(
  stage: HTMLElement,
  surface: HTMLElement,
  width: number
): number {
  const prior = stage.style.getPropertyValue('--game-board-room');
  stage.style.setProperty('--game-board-room', `${width}px`);
  const height = surface.offsetHeight;
  if (prior === '') stage.style.removeProperty('--game-board-room');
  else stage.style.setProperty('--game-board-room', prior);
  return height;
}

/**
 * A fixed game session gives the
 * board a room of a set height. This measures the room, the seats around
 * the board and the board's own shape, and returns the board's widest fit,
 * so a board taller than the room narrows instead of pushing its seats or
 * the commands off the screen. The layout says when it applies
 * (`--game-stage-room`); anywhere else the board keeps its measure. A
 * board that would not keep its shape narrowed (`boardRoomFit`), or that
 * grows no shorter when narrowed (a card table, whose rows wrap), keeps
 * the room's width, and the stage scrolls for the rest. `region` is the
 * board's box (which a fixed stage stretches over the room the seats
 * leave), `board` the game's content in it, as tall as it draws.
 */
export function createStageRoomFit(
  root: Accessor<HTMLElement | undefined>,
  region: Accessor<HTMLElement | undefined>,
  board: Accessor<HTMLElement | undefined>
): Accessor<number | undefined> {
  const [limit, setLimit] = createSignal<number>();
  createEffect(
    () => [root(), region(), board()] as const,
    ([stage, box, surface]) => {
      const cell = stage?.parentElement;
      const view = stage?.ownerDocument.defaultView;
      if (!stage || !box || !surface || !cell || !view) return undefined;
      const read = createRoomFitRead(
        { stage, box, surface, cell, view },
        (next) =>
          // A pixel of rounding never starts another pass.
          setLimit((last) =>
            last !== undefined &&
            next !== undefined &&
            Math.abs(last - next) <= 1
              ? last
              : next
          )
      );
      read();
      const observer = createFrameResizeObserver(view, read);
      for (const target of [cell, stage, box, surface])
        observer?.observe(target);
      view.addEventListener('resize', read);
      return () => {
        observer?.disconnect();
        view.removeEventListener('resize', read);
      };
    }
  );
  return limit;
}

/** What one room fit reads: the stage, the board's box and content, the room. */
type RoomFitParts = {
  readonly stage: HTMLElement;
  readonly box: HTMLElement;
  readonly surface: HTMLElement;
  readonly cell: HTMLElement;
  readonly view: Window;
};

/** One reading of the room and the board, reported to `report`. */
function createRoomFitRead(
  parts: RoomFitParts,
  report: (limit: number | undefined) => void
): () => void {
  const { stage, box, surface, cell, view } = parts;
  // The board's height at the room's whole width, and whether narrowing
  // it failed to shorten it, for the room's width that was measured at.
  let whole: { width: number; height: number } | undefined;
  let rigid = false;
  const fit = createBoardRoomFitter();
  return () => {
    if (whole !== undefined && whole.width !== cell.clientWidth) {
      whole = undefined;
      rigid = false;
    }
    const narrowed = surface.offsetWidth < cell.clientWidth - 1;
    if (!narrowed)
      whole = { width: cell.clientWidth, height: surface.offsetHeight };
    else if (whole !== undefined && surface.offsetHeight >= whole.height)
      rigid = true;
    const style = view.getComputedStyle(cell);
    const fixed = style.getPropertyValue('--game-stage-room');
    if (fixed.trim() !== '1' || rigid) {
      report(undefined);
      return;
    }
    report(
      fit({
        width: cell.clientWidth,
        height: cell.clientHeight,
        // Everything in the stage but the board's box: the seats, the gaps.
        chrome: stage.offsetHeight - box.offsetHeight,
        boardWidth: surface.offsetWidth,
        boardHeight: surface.offsetHeight,
        smallest: smallestIn(style),
        heightAt: (width) => heightAt(stage, surface, width),
      })
    );
  };
}
