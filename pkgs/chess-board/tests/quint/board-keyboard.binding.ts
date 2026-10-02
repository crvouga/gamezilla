import {
  type BoardWorld,
  clearBoardEvidence,
  focusBoardSquare,
  type KeyboardDirection,
  moveKeyboard,
  pressBoardKey,
  readKeyboardModel,
  readModelFingerprint,
  selectSquare,
  setupBoard,
} from '@pkgs/chess-board/harness';
import type { Run } from '@pkgs/harness';
import { bindQuintModel } from '@pkgs/quint/registry';

async function observedInput(w: Run<BoardWorld>, input: () => Promise<void>) {
  await w.apply(clearBoardEvidence);
  await input();
}
bindQuintModel<Run<BoardWorld>>({
  model: 'board-keyboard',
  traces: 100,
  maxSteps: 30,
  verifySteps: 4,
  actions: {
    init: async (w, p) => {
      await w.apply(setupBoard, {
        orientation: p['orientation'] === 'White' ? 'white' : 'black',
        interactive: p['canMove'] as boolean,
        animations: false,
      });
      await w.apply(focusBoardSquare, 'e2');
    },
    moveKeyboard: (w, p) =>
      observedInput(w, () =>
        w.apply(moveKeyboard, p['direction'] as KeyboardDirection)
      ),
    chooseKeyboardSquare: (w) =>
      observedInput(w, () => w.apply(pressBoardKey, ' ')),
    tapKeyboardSquare: (w, p) =>
      observedInput(w, () =>
        w.apply(selectSquare, p['rank'] === 1 ? 'e2' : 'e4')
      ),
  },
  observe: (w) => w.read(readKeyboardModel),
  fingerprint: (w) => w.read(readModelFingerprint),
});
