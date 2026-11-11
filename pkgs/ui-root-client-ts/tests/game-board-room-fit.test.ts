import { expect, test } from 'bun:test';
import { boardRoomFit, boardRoomLimit } from '../src/game-board-stage/room-fit';

// regression: chess-fixed-stage-board-below-playable
test('a chess board in a 320 x 640 room stays large enough to take moves', () => {
  // The board with its guidance under it, in a 320 x 640 phone's room: the
  // stage narrowed it to 184px, under the 196px a chess board needs
  // inside its 2px border to take a move, so the board went inert.
  expect(
    boardRoomLimit({
      width: 320,
      height: 393,
      chrome: 120,
      boardWidth: 320,
      boardHeight: 456,
    })
  ).toBeGreaterThanOrEqual(196 + 2 * 2);
});

// regression: quoridor-fixed-stage-narrows-precision-board
test('a board whose tools wrap when narrowed keeps its width', () => {
  // Quoridor's board, wall tools and target picker in a 390 x 844 phone's
  // room: shown at 350px it was 464px tall, not the 428px its shape
  // promised, then at 323px its tools wrapped to 485px, and the stage
  // gave its width back, the board jumping on first paint.
  const quoridor = {
    width: 390,
    height: 589,
    chrome: 160,
    boardWidth: 390,
    boardHeight: 477,
  };
  const measured = new Map([
    [350, 464],
    [323, 485],
  ]);
  const heightAt = (width: number) => {
    const height = measured.get(width);
    if (height === undefined) throw new Error(`unmeasured ${width}`);
    return height;
  };
  expect(boardRoomLimit(quoridor)).toBe(350);
  expect(boardRoomFit({ ...quoridor, heightAt })).toBeUndefined();
});
