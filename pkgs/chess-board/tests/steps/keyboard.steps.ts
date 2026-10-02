import { expect } from 'bun:test';
import type { Square } from '@pkgs/chess-board/chess-board-types';
import {
  type BoardWorld,
  focusBoardSquare,
  type KeyboardDirection,
  moveKeyboard,
  pressBoardKey,
  readKeyboardInput,
  type Side,
  selectSquare,
  setupBoard,
} from '@pkgs/chess-board/harness';
import { stepsFor } from '@pkgs/gherkin/registry';
import type { Run } from '@pkgs/harness';

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
When("Alice chooses the keyboard's square with Space", (w) =>
  w.apply(pressBoardKey, ' ')
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
