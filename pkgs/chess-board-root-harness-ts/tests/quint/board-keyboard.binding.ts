import type { BoardWorld } from '@pkgs/chess-board-root-harness-ts/board-world';
import { setupBoard } from '@pkgs/chess-board-root-harness-ts/chess-board';
import type { KeyboardDirection } from '@pkgs/chess-board-root-harness-ts/keyboard-actions';
import {
  chooseKeyboardSquare,
  enterBoardKeyboard,
  moveKeyboard,
  tapKeyboardCoordinates,
} from '@pkgs/chess-board-root-harness-ts/keyboard-actions';
import { readKeyboardModel } from '@pkgs/chess-board-root-harness-ts/keyboard-model';
import { readModelFingerprint } from '@pkgs/chess-board-root-harness-ts/model-evidence';
import { clearBoardEvidence } from '@pkgs/chess-board-root-harness-ts/options-actions';
import type { Run } from '@pkgs/harness-root-shared-ts/run-types';
import { bindQuintModel } from '@pkgs/quint-shared-ts/registry';

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
