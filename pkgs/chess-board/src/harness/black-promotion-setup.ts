import { defineAction } from '@pkgs/harness';
import type { BoardWorld } from './board-world';
import type { Side } from './interaction-fixtures';
export const BLACK_PROMOTION_MATRIX = '6k1/8/8/8/8/8/p7/1N4K1 b - - 0 1';
export const prepareBlackPromotion = defineAction({
  name: 'prepareBlackPromotion',
  act(
    w: BoardWorld,
    options: { side: Side; pending?: 'a1' | 'b1'; disabled?: boolean }
  ) {
    w.app.reset({
      fen: BLACK_PROMOTION_MATRIX,
      orientation: options.side === 'White' ? 'white' : 'black',
      interactive: options.disabled !== true,
    });
    if (options.pending !== undefined) {
      w.app.tap('a2');
      w.app.tap(options.pending);
    }
    w.app.clearEvidence();
  },
});
