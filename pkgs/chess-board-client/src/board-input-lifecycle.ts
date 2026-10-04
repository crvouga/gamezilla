import { type Accessor, createEffect, on } from 'solid-js';
import type { BoardController } from './chess-board-controller';
import type { BoardPointer } from './chess-board-pointer';
import type { ChessBoardProps } from '@pkgs/chess-board-shared/chess-board-types';
/** A gesture belongs to the position, orientation and geometry it started on. */
export function watchBoardInput(
  props: ChessBoardProps,
  parts: Pick<BoardController, 'model' | 'orientation' | 'boardPx'> & {
    readonly hidden: Accessor<boolean>;
  },
  pointer: BoardPointer
): void {
  createEffect(
    on(
      [
        () => parts.model.interaction().interactive,
        () => parts.model.game().position,
        parts.orientation,
        parts.boardPx,
        () => props.enableUserArrows === true,
        parts.hidden,
      ],
      (current, prev) => {
        if (
          prev === undefined ||
          current.every((value, index) => value === prev[index])
        )
          return;
        pointer.cancelPress();
      }
    )
  );
}
