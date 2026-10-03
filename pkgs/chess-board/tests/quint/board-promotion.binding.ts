import type { PromotionName } from '@pkgs/chess-board/harness';
import {
  type BoardWorld,
  choosePromotion,
  clearBoardEvidence,
  configureBoard,
  movePiece,
  PREPARED_PROMOTIONS,
  pressBoardKey,
  readModelFingerprint,
  readPromotionModel,
  replacePosition,
  setupBoard,
} from '@pkgs/chess-board/harness';
import type { Run } from '@pkgs/harness';
import { bindQuintModel } from '@pkgs/quint/registry';

async function observedInput(w: Run<BoardWorld>, input: () => Promise<void>) {
  await w.apply(clearBoardEvidence);
  await input();
}
bindQuintModel<Run<BoardWorld>>({
  model: 'board-promotion',
  traces: 100,
  maxSteps: 30,
  verifySteps: 4,
  actions: {
    init: (w) =>
      w.apply(setupBoard, {
        fen: PREPARED_PROMOTIONS.ready,
        animations: false,
      }),
    requestPromotion: (w) =>
      observedInput(w, () => w.apply(movePiece, 'a7', 'a8')),
    choosePromotion: (w, p) =>
      observedInput(w, () =>
        w.apply(choosePromotion, p['piece'] as PromotionName)
      ),
    cancelPromotion: (w) =>
      observedInput(w, () => w.apply(pressBoardKey, 'Escape')),
    tryOtherPromotionMove: (w) =>
      observedInput(w, () => w.apply(movePiece, 'h1', 'h2')),
    configurePromotionInput: (w, p) =>
      observedInput(w, () =>
        w.apply(configureBoard, { interactive: p['canMove'] as boolean })
      ),
    configureAutomaticQueen: (w, p) =>
      observedInput(w, () =>
        w.apply(configureBoard, { autoPromoteQueen: p['automatic'] as boolean })
      ),
    replacePromotionPosition: (w, p) =>
      observedInput(w, () =>
        w.apply(
          replacePosition,
          PREPARED_PROMOTIONS[p['target'] as keyof typeof PREPARED_PROMOTIONS]
        )
      ),
  },
  observe: (w) => w.read(readPromotionModel),
  fingerprint: (w) => w.read(readModelFingerprint),
});
