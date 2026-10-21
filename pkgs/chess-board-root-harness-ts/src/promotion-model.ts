import type { BoardWorld } from './board-world';
import {
  identifyPreparedPosition,
  PREPARED_PROMOTIONS,
} from './prepared-positions';
export const readPromotionModel = (w: BoardWorld) => {
  const identity = identifyPreparedPosition(
    w.app.probe().fen,
    PREPARED_PROMOTIONS
  );
  const promoted = ['queen', 'rook', 'bishop', 'knight'].includes(identity);
  return {
    promotionBoard: {
      position: promoted ? 'promoted' : identity,
      choice: w.app.promotionChoices().length > 0,
      promotedPiece: promoted ? identity : 'none',
      interactive: w.app.probe().interactive,
      automaticQueen: w.app.config().autoPromoteQueen === true,
      offers: w.app
        .moveDetails()
        .map((move) =>
          move.promotion === undefined
            ? 'rook ' + move.from + ' to ' + move.to
            : ({ q: 'queen', r: 'rook', b: 'bishop', n: 'knight' } as const)[
                move.promotion
              ]
        ),
    },
  };
};
