/** @jsxImportSource solid-js */

import {
  type Accessor,
  createEffect,
  createSignal,
  type JSX,
  onCleanup,
} from 'solid-js';
import { GameBoardPreviewContext } from '../game-board-stage/board-preview';
import { createFrameResizeObserver } from '../observe-element-resize';
import styles from './game-lobby.module.css';

const asPreview = (): boolean => true;

/**
 * The widest a board of the measured shape may be and still stand whole in
 * its room, or nothing while either has no size yet.
 */
export function modeArtWidth(
  room: { width: number; height: number },
  board: { width: number; height: number }
): number | undefined {
  if (board.width <= 0 || board.height <= 0) return undefined;
  if (room.width <= 0 || room.height <= 0) return undefined;
  const fitted = (room.height * board.width) / board.height;
  return Math.floor(Math.min(room.width, fitted));
}

/** The fitted width of `board` in `room`, kept as either changes size. */
function createModeArtFit(
  room: Accessor<HTMLElement | undefined>,
  board: Accessor<HTMLElement | undefined>
): Accessor<number | undefined> {
  const [width, setWidth] = createSignal<number>();
  createEffect(() => {
    const outer = room();
    const inner = board();
    const view = outer?.ownerDocument.defaultView;
    if (!outer || !inner || !view) return;
    const read = () => {
      const next = modeArtWidth(
        { width: outer.clientWidth, height: outer.clientHeight },
        { width: inner.offsetWidth, height: inner.offsetHeight }
      );
      // A pixel of rounding never starts another pass.
      setWidth((last) =>
        last !== undefined && next !== undefined && Math.abs(last - next) <= 1
          ? last
          : next
      );
    };
    read();
    const observer = createFrameResizeObserver(view, read);
    observer?.observe(outer);
    observer?.observe(inner);
    onCleanup(() => observer?.disconnect());
  });
  return width;
}

/**
 * The mode card's picture: the game's own board, drawn as a preview (no
 * turn chrome), whole and centred in the room the card has over its words.
 * A board is as tall as its game makes it, so its width is fitted to the
 * room's height by its measured shape, never cropped.
 */
export function GameModeArt(props: { art: JSX.Element }): JSX.Element {
  const [room, setRoom] = createSignal<HTMLDivElement>();
  const [board, setBoard] = createSignal<HTMLDivElement>();
  const width = createModeArtFit(room, board);
  return (
    <div ref={setRoom} class={styles['modeArt']} aria-hidden="true" inert>
      <div
        ref={setBoard}
        class={styles['modeArtBoard']}
        style={{ width: width() === undefined ? undefined : `${width()}px` }}
      >
        <GameBoardPreviewContext.Provider value={asPreview}>
          {props.art}
        </GameBoardPreviewContext.Provider>
      </div>
    </div>
  );
}
