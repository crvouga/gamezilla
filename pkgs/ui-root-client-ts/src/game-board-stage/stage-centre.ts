import { type Accessor, createEffect, createSignal, onCleanup } from 'solid-js';
import { createFrameResizeObserver } from '../observe-element-resize';

/** What the stage's centring is measured from. */
export type StageCentreRoom = {
  /** The room's size: the stage slot's width and height. */
  readonly width: number;
  readonly height: number;
  /** The board's width: a fit that narrows it is a new layout. */
  readonly boardWidth: number;
};

/**
 * How much taller or shorter a stage may draw and still keep its place: a
 * board's own hint line coming and going, a finished game's board with no
 * hint. Another game's board differs by more, and is centred anew.
 */
export const STAGE_CENTRE_TOLERANCE = 32;

export type HeldCentre = { readonly height: number; readonly offset: number };

/**
 * The space above a fixed stage that sets it in the middle of its room,
 * held for as long as the room and the board's width stay the same. The
 * board and its seats are centred once, when the room is first laid out,
 * and stay where they are while the game is played, from its live board to
 * its result (another place, so another stage, in the same room): a stage
 * a few pixels taller or shorter keeps its top edge, so the board never
 * moves. A new room (the window turned or resized) or a stage of another
 * size (another game) centres it again. `held` is shared by every stage of
 * a document.
 */
export function stageCentreOffset(
  held: Map<string, HeldCentre>,
  room: StageCentreRoom,
  stageHeight: number
): number {
  const key = `${room.width} ${room.height} ${room.boardWidth}`;
  const last = held.get(key);
  if (
    last !== undefined &&
    Math.abs(last.height - stageHeight) <= STAGE_CENTRE_TOLERANCE
  )
    return last.offset;
  const offset = Math.max(0, Math.floor((room.height - stageHeight) / 2));
  held.set(key, { height: stageHeight, offset });
  return offset;
}

/** Every document's held centres: a stage that remounts finds its place. */
const HELD = new WeakMap<Document, Map<string, HeldCentre>>();

function heldIn(document: Document): Map<string, HeldCentre> {
  const found = HELD.get(document);
  if (found !== undefined) return found;
  const made = new Map<string, HeldCentre>();
  HELD.set(document, made);
  return made;
}

/**
 * A fixed stage's centring (`GameSessionLayout`'s `fixedStage` on a phone,
 * where the layout sets `--game-stage-room`), as the space above the stage.
 * Anywhere else the stage keeps its own place (`undefined`).
 */
export function createStageCentre(
  root: Accessor<HTMLElement | undefined>,
  board: Accessor<HTMLElement | undefined>
): Accessor<number | undefined> {
  const [offset, setOffset] = createSignal<number>();
  createEffect(() => {
    const stage = root();
    const surface = board();
    const cell = stage?.parentElement;
    const view = stage?.ownerDocument.defaultView;
    if (!stage || !surface || !cell || !view) return;
    const held = heldIn(stage.ownerDocument);
    const read = () => {
      const fixed = view
        .getComputedStyle(cell)
        .getPropertyValue('--game-stage-room');
      if (fixed.trim() !== '1') {
        setOffset(undefined);
        return;
      }
      setOffset(
        stageCentreOffset(
          held,
          {
            width: cell.clientWidth,
            height: cell.clientHeight,
            boardWidth: surface.offsetWidth,
          },
          stage.offsetHeight
        )
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
  return offset;
}
