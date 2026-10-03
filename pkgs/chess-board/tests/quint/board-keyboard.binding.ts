import {
  type BoardWorld,
  chooseKeyboardSquare,
  clearBoardEvidence,
  enterBoardKeyboard,
  type KeyboardDirection,
  moveKeyboard,
  readKeyboardModel,
  readModelFingerprint,
  setupBoard,
  tapKeyboardCoordinates,
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
      await w.apply(enterBoardKeyboard);
    },
    moveKeyboard: (w, p) =>
      observedInput(w, () =>
        w.apply(moveKeyboard, p['direction'] as KeyboardDirection)
      ),
    chooseKeyboardSquare: (w, p) =>
      observedInput(w, () =>
        w.apply(chooseKeyboardSquare, p['key'] as 'Space' | 'Enter')
      ),
    tapKeyboardSquare: (w, p) =>
      observedInput(w, () =>
        w.apply(
          tapKeyboardCoordinates,
          p['file'] as number,
          p['rank'] as number
        )
      ),
  },
  observe: (w) => w.read(readKeyboardModel),
  fingerprint: (w) => w.read(readModelFingerprint),
});
