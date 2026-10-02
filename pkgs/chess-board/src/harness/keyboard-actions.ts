import type { Square } from '@pkgs/chess-board-core/types';
import { defineAction } from '@pkgs/harness';
import type { BoardWorld } from './board-world';
import { readFocusedBoardSquare } from './keyboard-model';
import { sendBoardKey } from './options-actions';

export const focusBoardSquare = defineAction({
  name: 'focusBoardSquare',
  act: (w: BoardWorld, square: Square) => {
    w.app.focusSquare(square);
  },
});
export const selectSquareWithKeyboard = defineAction({
  name: 'selectSquareWithKeyboard',
  act: (w: BoardWorld, square: Square) => w.app.key(square),
});
export type KeyboardDirection = 'up' | 'down' | 'left' | 'right';
const ARROW_KEYS = {
  up: 'ArrowUp',
  down: 'ArrowDown',
  left: 'ArrowLeft',
  right: 'ArrowRight',
};
export const moveKeyboard = defineAction({
  name: 'moveKeyboard',
  act(w: BoardWorld, direction: KeyboardDirection) {
    const key = ARROW_KEYS[direction];
    w.app.recordKeyboardInput(key, readFocusedBoardSquare(w));
    sendBoardKey(w, key);
  },
});
export const keyboardActions = [
  focusBoardSquare,
  selectSquareWithKeyboard,
  moveKeyboard,
];
