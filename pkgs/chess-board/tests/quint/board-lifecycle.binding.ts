import {
  type BoardWorld,
  beginDrag,
  CAPTURE,
  cancelDrag,
  closeBoard,
  configureBoard,
  confirmOfferedPosition,
  finishAnimation,
  finishEarlierAnimation,
  leaveActivity,
  lifecyclePosition,
  movePiece,
  readLifecycle,
  readModelFingerprint,
  reduceMotion,
  replacePosition,
  resizeBoard,
  selectSquare,
  setupBoard,
  setVisibility,
  startUnusableBoard,
  supplyPremoveReply,
  supplyUnusablePosition,
} from '@pkgs/chess-board/harness';
import type { Run } from '@pkgs/harness';
import { bindQuintModel } from '@pkgs/quint/registry';

bindQuintModel<Run<BoardWorld>>({
  model: 'board-lifecycle',
  traces: 100,
  maxSteps: 30,
  verifySteps: 8,
  actions: {
    init: (w) => w.apply(setupBoard, { fen: CAPTURE }),
    selectPiece: (w) => w.apply(selectSquare, 'e4'),
    beginDrag: (w) => w.apply(beginDrag, 'e4'),
    cancelDrag: (w) => w.apply(cancelDrag),
    switchAway: (w) => w.apply(leaveActivity),
    movePiece: (w) => w.apply(movePiece, 'e4', 'd5'),
    receiveReply: (w) => w.apply(supplyPremoveReply, 'g8', 'f6'),
    replacePosition: async (w, p) => {
      const current = await w.read(readLifecycle);
      if (current.board.position === p['target'])
        await w.apply(confirmOfferedPosition);
      else
        await w.apply(
          replacePosition,
          lifecyclePosition(p['target'] as number)
        );
    },
    supplyUnusablePosition: (w) => w.apply(supplyUnusablePosition),
    configureBoard: async (w, p) => {
      await w.apply(configureBoard, {
        interactive: p['canMove'] as boolean,
        sound: p['sound'] as boolean,
      });
      await w.apply(reduceMotion, p['reduced'] as boolean);
    },
    flipBoard: async (w) => {
      const current = await w.read(readLifecycle);
      await w.apply(configureBoard, {
        orientation: current.board.orientation === 'white' ? 'black' : 'white',
      });
    },
    resizeBoard: (w) => w.apply(resizeBoard),
    finishAnimation: (w) => w.apply(finishAnimation),
    finishEarlierAnimation: (w) => w.apply(finishEarlierAnimation),
    setVisibility: (w, p) => w.apply(setVisibility, p['visible'] as boolean),
    closeBoard: (w) => w.apply(closeBoard),
    startBoardWithUnusablePosition: (w) => w.apply(startUnusableBoard),
  },
  observe: (w) => w.read(readLifecycle),
  fingerprint: (w) => w.read(readModelFingerprint),
});
