import type { Square } from '@pkgs/chess-board-core-shared/types';
import { defineAction } from '@pkgs/harness-shared/define-action';
import type { BoardWorld } from './board-world';
import { BLACK_CAPTURE_PROMOTION, WHITE_PROMOTION } from './interaction-fixtures';
import type { PromotionName } from './interaction-fixtures';

export const PROMOTION_KINDS = {
  queen: 'q',
  rook: 'r',
  bishop: 'b',
  knight: 'n',
} as const;
export const dragPiece = defineAction({
  name: 'dragPiece',
  act(w: BoardWorld, from: Square, to: Square) {
    w.app.pointer('pointerdown', from);
    w.app.lift(from);
    w.app.pointer('pointermove', to);
    w.app.pointer('pointerup', to);
  },
});
export const dropHeldPiece = defineAction({
  name: 'dropHeldPiece',
  act(w: BoardWorld, to: Square) {
    w.app.lift(to);
    w.app.pointer('pointermove', to);
    w.app.pointer('pointerup', to);
  },
});
export const dropHeldPieceOutside = defineAction({
  name: 'dropHeldPieceOutside',
  act: (w: BoardWorld) => w.app.dropOutside(),
});
export const dropHeldPieceAtRatio = defineAction({
  name: 'dropHeldPieceAtRatio',
  act: (
    w: BoardWorld,
    at: { source: Square; xRatio: number; yRatio: number }
  ) => {
    w.app.lift(at.source);
    w.app.dropAtRatio(at.xRatio, at.yRatio);
  },
});
export const setupPendingPromotion = defineAction<
  BoardWorld,
  [blackCapture?: boolean]
>({
  name: 'setupPendingPromotion',
  act(w, blackCapture = false) {
    w.app.reset(
      blackCapture
        ? { fen: BLACK_CAPTURE_PROMOTION, orientation: 'black' }
        : { fen: WHITE_PROMOTION }
    );
    w.app.tap(blackCapture ? 'b2' : 'a7');
    w.app.tap(blackCapture ? 'a1' : 'a8');
  },
});
export const choosePromotion = defineAction({
  name: 'choosePromotion',
  act: (w: BoardWorld, choice: PromotionName) =>
    w.app.promotion(PROMOTION_KINDS[choice]),
});
export const cancelPromotion = defineAction<BoardWorld, [escape?: boolean]>({
  name: 'cancelPromotion',
  act: (w, escape = false) => w.app.promotion(escape ? 'q' : 'cancel', escape),
});
export const interactionActions = [
  dragPiece,
  dropHeldPiece,
  dropHeldPieceOutside,
  dropHeldPieceAtRatio,
  setupPendingPromotion,
  choosePromotion,
  cancelPromotion,
];
