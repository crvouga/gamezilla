import {
  confirmOfferedPosition,
  startUnusableBoard,
  supplyUnusablePosition,
} from '@pkgs/chess-board-root-harness/authority-actions';
import type { BoardWorld } from '@pkgs/chess-board-root-harness/board-world';
import {
  beginDrag,
  cancelDrag,
  closeBoard,
  configureBoard,
  finishAnimation,
  leaveActivity,
  movePiece,
  reduceMotion,
  replacePosition,
  resizeBoard,
  selectSquare,
  setupBoard,
  setVisibility,
} from '@pkgs/chess-board-root-harness/chess-board';
import { finishEarlierAnimation } from '@pkgs/chess-board-root-harness/lifecycle-actions';
import {
  lifecyclePosition,
  readLifecycle,
} from '@pkgs/chess-board-root-harness/lifecycle-reads';
import { readModelFingerprint } from '@pkgs/chess-board-root-harness/model-evidence';
import { CAPTURE } from '@pkgs/chess-board-root-harness/positions';
import { supplyPremoveReply } from '@pkgs/chess-board-root-harness/premove-actions';
import type { Run } from '@pkgs/harness-root-shared/run-types';
import { bindQuintModel } from '@pkgs/quint-shared/registry';

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
    startBoard: (w, p) =>
      w.apply(setupBoard, {
        orientation: p['orientation'] as 'white' | 'black',
      }),
  },
  observe: (w) => w.read(readLifecycle),
  fingerprint: (w) => w.read(readModelFingerprint),
});
