import { defineAction } from '@pkgs/harness-shared/define-action';
import type { BoardWorld } from './board-world';
import { sendBoardKey } from './options-actions';
import { PREMOVE_READY } from './premove-actions';

export const prepareTwoPremoves = defineAction({
  name: 'prepareTwoPremoves',
  act(w: BoardWorld, selected = false, cancelled = false) {
    w.app.reset({
      fen: PREMOVE_READY,
      premoves: true,
      enableUserArrows: true,
      animations: false,
    });
    w.app.tap('d2');
    w.app.tap('d4');
    w.app.tap('g1');
    w.app.tap('f3');
    if (selected || cancelled) w.app.tap('d2');
    if (w.app.probe().premoves.length !== 2)
      throw new Error('Two premoves were not queued');
    if (cancelled) sendBoardKey(w, 'Escape');
    w.app.clearEvidence();
  },
});
