import type { BoardWorld } from './board-world';
import { INITIAL } from './positions';
import {
  identifyPreparedPosition,
  PREPARED_OPTIONS,
} from './prepared-positions';

export const readFocusedBoardSquare = (w: BoardWorld) =>
  w.app.host.contains(document.activeElement)
    ? (document.activeElement?.getAttribute('data-square') ?? null)
    : null;
export const readKeyboardInput = (w: BoardWorld) => ({
  before: w.app.keyboardInput(),
  after: readFocusedBoardSquare(w),
});
export const readKeyboardModel = (w: BoardWorld) => {
  const square = readFocusedBoardSquare(w);
  const probe = w.app.probe();
  return {
    keyboardBoard: {
      orientation: probe.orientation === 'white' ? 'White' : 'Black',
      file: square === null ? -1 : square.charCodeAt(0) - 97,
      rank: square === null ? -1 : Number(square[1]) - 1,
      position: identifyPreparedPosition(probe.fen, {
        opening: INITIAL,
        moved: PREPARED_OPTIONS.moved,
      }),
      selected: probe.selected !== null,
      interactive: probe.interactive,
      offers: w.app.moveDetails().map((move) => move.from + ' to ' + move.to),
    },
  };
};
