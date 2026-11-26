import { BREAKPOINT_MIN_TABLET } from '@pkgs/ui-root-shared-ts/breakpoints';
import { spacing } from '@pkgs/ui-root-shared-ts/scale';
import { type Accessor, createEffect, createSignal } from 'solid-js';
import { belowStage, contentTop, layoutTargets } from './viewport-fit';

/** Under this the region keeps a usable size and the page scrolls instead. */
const SMALLEST_REGION = 240;

/**
 * The window's height left under the top of the board's box (`region`):
 * less what the stage holds under the box, the rows the layout puts under
 * the stage, and a gap to the window's edge. A wide game layout holds the
 * box at this height (`--game-board-viewport-room`), so the box is the
 * same in every state of the game whatever the board draws in it. It
 * depends only on what lies above the box, never on the board, so a board
 * that redraws never changes it. Phones lay their fixed stage out with
 * flex instead (`undefined` under a tablet's width).
 */
export function createBoardRegionFill(
  root: Accessor<HTMLElement | undefined>,
  region: Accessor<HTMLElement | undefined>,
  enabled: Accessor<boolean>
): Accessor<number | undefined> {
  const [room, setRoom] = createSignal<number>();
  createEffect(
    () => [enabled(), root(), region()] as const,
    ([on, stage, box]) => {
      const view = stage?.ownerDocument.defaultView;
      if (!on || !stage || !box || !view) {
        setRoom(undefined);
        return undefined;
      }
      const read = () => {
        if (view.innerWidth < BREAKPOINT_MIN_TABLET) {
          setRoom(undefined);
          return;
        }
        const rect = stage.getBoundingClientRect();
        const after = Math.max(
          0,
          rect.bottom - box.getBoundingClientRect().bottom
        );
        const height = view.visualViewport?.height ?? view.innerHeight;
        const left =
          height -
          contentTop(box) -
          after -
          belowStage(stage, rect) -
          spacing[4];
        setRoom(Math.max(SMALLEST_REGION, Math.floor(left)));
      };
      read();
      // Read in the same frame the rows above change (a seat band that
      // settles into two rows on its first layout), never a frame late:
      // the room depends only on what lies above the box, so setting it
      // never re-triggers this observer and the box never overflows the
      // window for a frame.
      const observer =
        typeof ResizeObserver === 'undefined'
          ? undefined
          : new ResizeObserver(() => read());
      for (const target of layoutTargets(box)) observer?.observe(target);
      view.addEventListener('resize', read);
      view.visualViewport?.addEventListener('resize', read);
      return () => {
        observer?.disconnect();
        view.removeEventListener('resize', read);
        view.visualViewport?.removeEventListener('resize', read);
      };
    }
  );
  return room;
}
