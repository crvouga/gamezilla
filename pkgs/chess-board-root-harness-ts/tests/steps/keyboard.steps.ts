import { expect } from 'bun:test';
import type { Square } from '@pkgs/chess-board-core-shared-ts/types';
import type { BoardWorld } from '@pkgs/chess-board-root-harness-ts/board-world';
import {
  selectSquare,
  setupBoard,
} from '@pkgs/chess-board-root-harness-ts/chess-board';
import type { Side } from '@pkgs/chess-board-root-harness-ts/interaction-fixtures';
import { readInteraction } from '@pkgs/chess-board-root-harness-ts/interaction-reads';
import type { KeyboardDirection } from '@pkgs/chess-board-root-harness-ts/keyboard-actions';
import {
  chooseKeyboardSquare,
  focusBoardSquare,
  moveKeyboard,
  selectSquareWithKeyboard,
} from '@pkgs/chess-board-root-harness-ts/keyboard-actions';
import {
  readFocusedBoardSquare,
  readKeyboardInput,
} from '@pkgs/chess-board-root-harness-ts/keyboard-model';
import { stepsFor } from '@pkgs/gherkin-shared-ts/registry';
import type { Run } from '@pkgs/harness-root-shared-ts/run-types';

const { Given, When, Then } = stepsFor<Run<BoardWorld>>();
Given(
  'Alice has a chessboard facing {word} with the keyboard on {word}',
  async (w, side: Side, square: Square) => {
    await w.apply(setupBoard, {
      orientation: side === 'White' ? 'white' : 'black',
    });
    await w.apply(focusBoardSquare, square);
  }
);
Given(
  'Alice has e2 selected with the keyboard on {word}',
  async (w, square: Square) => {
    await w.apply(setupBoard, {});
    await w.apply(selectSquare, 'e2');
    await w.apply(focusBoardSquare, square);
  }
);
Given(
  'Alice has a chessboard with interactivity disabled and the keyboard on e2',
  async (w) => {
    await w.apply(setupBoard, { interactive: false });
    await w.apply(focusBoardSquare, 'e2');
  }
);
When(
  'Alice moves the keyboard one square {word}',
  (w, direction: KeyboardDirection) => w.apply(moveKeyboard, direction)
);
Given(
  'Alice has g1 selected with the keyboard on f3 on a chessboard facing {word}',
  async (w, side: Side) => {
    await w.apply(setupBoard, {
      orientation: side === 'White' ? 'white' : 'black',
    });
    await w.apply(selectSquareWithKeyboard, 'g1');
    expect((await w.read(readInteraction)).selected).toBe('g1');
    expect(await w.read(readFocusedBoardSquare)).toBe('g1');
    await w.apply(focusBoardSquare, 'f3');
  }
);
When(
  "Alice chooses the keyboard's square with {word}",
  (w, key: 'Space' | 'Enter') => w.apply(chooseKeyboardSquare, key)
);
Then(
  "Alice cannot move the keyboard beyond the chessboard's edge",
  async (w) => {
    const input = await w.read(readKeyboardInput);
    expect(input.before).not.toBeNull();
    expect(input.before?.key).toMatch(/^Arrow/);
    expect(input.after).toBe(input.before?.before ?? null);
  }
);
