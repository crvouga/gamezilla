import { expect, test } from 'bun:test';
import {
  boardRoomFit,
  boardRoomLimit,
  createBoardRoomFitter,
} from '../src/game-board-stage/room-fit';

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

test('a board that redraws in the same room is not laid out again', () => {
  // A move redraws the board and its observers read the room again; the
  // tries cost a layout each, so the same room and board reuse the fit.
  const fit = createBoardRoomFitter();
  const room = {
    width: 320,
    height: 360,
    chrome: 51,
    boardWidth: 320,
    boardHeight: 431,
  };
  let tries = 0;
  const heightAt = (width: number) => {
    tries++;
    return Math.round(width * 1.21 + 44);
  };
  const first = fit({ ...room, heightAt });
  const measured = tries;
  expect(measured).toBeGreaterThan(0);
  expect(fit({ ...room, heightAt })).toBe(first);
  expect(tries).toBe(measured);
  fit({ ...room, height: 340, heightAt });
  expect(tries).toBeGreaterThan(measured);
});
