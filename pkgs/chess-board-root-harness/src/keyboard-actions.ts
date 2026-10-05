import type { Square } from '@pkgs/chess-board-core-shared/types';
import { defineAction } from '@pkgs/harness-root-shared/define-action';
import type { BoardWorld } from './board-world';
import {
  readFirstKeyboardSquare,
  readFocusedBoardSquare,
} from './keyboard-model';
import { sendBoardKey } from './options-actions';

export const focusBoardSquare = defineAction({
  name: 'focusBoardSquare',
  act: (w: BoardWorld, square: Square) => {
    w.app.focusSquare(square);
  },
});
export const enterBoardKeyboard = defineAction({
  name: 'enterBoardKeyboard',
  act(w: BoardWorld) {
    const square = readFirstKeyboardSquare(w);
    if (square === null) throw new Error('Board has no keyboard entry square');
    w.app.focusSquare(square as Square);
  },
});
export const selectSquareWithKeyboard = defineAction({
  name: 'selectSquareWithKeyboard',
  act: (w: BoardWorld, square: Square) => w.app.key(square),
});
export const chooseKeyboardSquare = defineAction({
  name: 'chooseKeyboardSquare',
  act: (w: BoardWorld, key: 'Space' | 'Enter') =>
    sendBoardKey(w, key === 'Space' ? ' ' : key),
});
export const tapKeyboardCoordinates = defineAction({
  name: 'tapKeyboardCoordinates',
  act: (w: BoardWorld, file: number, rank: number) =>
    w.app.tap(`${String.fromCharCode(97 + file)}${rank + 1}` as Square),
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
  enterBoardKeyboard,
  selectSquareWithKeyboard,
  chooseKeyboardSquare,
  tapKeyboardCoordinates,
  moveKeyboard,
];
