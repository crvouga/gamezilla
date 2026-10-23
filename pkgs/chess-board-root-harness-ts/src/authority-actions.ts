import { defineAction } from '@pkgs/harness-root-shared-ts/define-action';
import type { BoardWorld } from './board-world';
import { createExampleApp } from './example-app';
import { MATE_IN_ONE } from './interaction-fixtures';
import { INITIAL } from './positions';
import { pushReply } from './premove-actions';

export const setupOfferedWhiteMove = defineAction<
  BoardWorld,
  [selectedReply?: boolean]
>({
  name: 'setupOfferedWhiteMove',
  async act(w, selectedReply = false) {
    w.app.reset({});
    w.app.tap('e2');
    w.app.tap('e4');
    if (selectedReply) w.app.tap('e7');
    await w.session.advanceTime(1000);
    w.app.clearEvidence();
  },
});
export const confirmOfferedPosition = defineAction({
  name: 'confirmOfferedPosition',
  act: (w: BoardWorld) => w.app.configure({ fen: w.app.probe().fen }),
});
export const setupMatedWhiteMove = defineAction({
  name: 'setupMatedWhiteMove',
  async act(w: BoardWorld) {
    w.app.reset({ fen: MATE_IN_ONE });
    w.app.tap('g6');
    w.app.tap('g7');
    await w.session.advanceTime(1000);
    w.app.clearEvidence();
  },
});
export const refuseOfferedMove = defineAction({
  name: 'refuseOfferedMove',
  act: (w: BoardWorld) =>
    w.app.configure({
      fen: INITIAL,
      fenSyncKey: (w.app.config().fenSyncKey ?? 0) + 1,
    }),
});
export const supplyBlackReply = defineAction({
  name: 'supplyBlackReply',
  act: (w: BoardWorld) => pushReply(w, 'e7', 'e5'),
});
export const supplyUnusablePosition = defineAction({
  name: 'supplyUnusablePosition',
  act: (w: BoardWorld) => w.app.configure({ fen: 'not a chess position' }),
});
export const startUnusableBoard = defineAction({
  name: 'startUnusableBoard',
  act(w: BoardWorld) {
    w.app.close();
    const earlierCompletion = w.app.motion.earlierCompletion;
    w.app = createExampleApp(
      w.session,
      { fen: 'not a chess position' },
      earlierCompletion
    );
    w.auditedMarkups.clear();
  },
});
export const authorityActions = [
  setupOfferedWhiteMove,
  confirmOfferedPosition,
  refuseOfferedMove,
  supplyBlackReply,
  supplyUnusablePosition,
  startUnusableBoard,
  setupMatedWhiteMove,
];
