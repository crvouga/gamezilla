import {
  type BoardWorld,
  beginDrag,
  CAPTURE,
  cancelDrag,
  configureBoard,
  finishAnimation,
  movePiece,
  REPLACEMENT,
  readLifecycle,
  reduceMotion,
  replacePosition,
  resizeBoard,
  selectSquare,
  setVisibility,
} from '@pkgs/chess-board/harness';
import type { Run } from '@pkgs/harness';
import { bindQuintModel } from '@pkgs/quint/registry';

bindQuintModel<Run<BoardWorld>>({
  model: 'board-lifecycle',
  traces: 80,
  maxSteps: 40,
  verifySteps: 8,
  actions: {
    init: async (w) => {
      await w.read(readLifecycle);
    },
    selectPiece: (w) => w.apply(selectSquare, 'e4'),
    beginDrag: (w) => w.apply(beginDrag, 'e4'),
    cancelDrag: (w) => w.apply(cancelDrag),
    movePiece: (w) => w.apply(movePiece, 'e4', 'd5'),
    replacePosition: (w, p) =>
      w.apply(replacePosition, p['target'] === 0 ? CAPTURE : REPLACEMENT),
    configureBoard: async (w, p) => {
      await w.apply(configureBoard, {
        interactive: p['canMove'] as boolean,
        sound: p['sound'] as boolean,
      });
      await w.apply(reduceMotion, p['reduced'] as boolean);
    },
    flipBoard: async (w) => {
      const state = await w.read(readLifecycle);
      await w.apply(configureBoard, {
        orientation: state.board.orientation === 'white' ? 'black' : 'white',
      });
    },
    resizeBoard: (w) => w.apply(resizeBoard),
    finishAnimation: (w) => w.apply(finishAnimation),
    setVisibility: (w, p) => w.apply(setVisibility, p['visible'] as boolean),
  },
  observe: (w) => w.read(readLifecycle),
  fingerprint: async (w) => JSON.stringify(await w.read(readLifecycle)),
});
