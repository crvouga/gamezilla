import { defineAction } from '@pkgs/harness';
import type { BoardWorld } from './board-world';
import { WHITE_PROMOTION } from './interaction-fixtures';
export const prepareFixedWidthPromotion = defineAction({
  name: 'prepareFixedWidthPromotion',
  act(w: BoardWorld) {
    w.app.reset({ size: undefined });
    w.app.setAvailableWidth(195);
    w.app.configure({ size: 512 });
    w.app.configure({
      fen: WHITE_PROMOTION,
      fenSyncKey: (w.app.config().fenSyncKey ?? 0) + 1,
    });
    w.app.tap('a7');
    w.app.tap('a8');
    w.app.clearEvidence();
  },
});
