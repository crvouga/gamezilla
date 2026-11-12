import { describe, expect, test } from 'bun:test';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';
import { boardRoomFit, boardRoomLimit } from '../src/game-board-stage/room-fit';

const SMALLEST = 200;
const room = fc.record({
  width: fc.integer({ min: 240, max: 1200 }),
  height: fc.integer({ min: 200, max: 1400 }),
  chrome: fc.integer({ min: 0, max: 400 }),
  boardWidth: fc.integer({ min: 100, max: 1200 }),
  boardHeight: fc.integer({ min: 100, max: 1400 }),
});

describe('boardRoomLimit', () => {
  test('never wider than the room, never under the smallest board', () => {
    assertProperty(
      'the limit stays between the smallest board and the room',
      fc.property(room, (given) => {
        const limit = boardRoomLimit(given);
        expect(limit).toBeDefined();
        expect(limit).toBeGreaterThanOrEqual(SMALLEST);
        expect(limit).toBeLessThanOrEqual(Math.max(SMALLEST, given.width));
      })
    );
  });

  test('a board over the smallest fits the room with its chrome', () => {
    assertProperty(
      'a larger board fits its room',
      fc.property(room, (given) => {
        const limit = boardRoomLimit(given) ?? 0;
        fc.pre(limit > SMALLEST);
        const tall = (limit * given.boardHeight) / given.boardWidth;
        expect(tall + given.chrome).toBeLessThanOrEqual(given.height);
      })
    );
  });

  test('a taller room never narrows the board', () => {
    assertProperty(
      'a taller room never narrows',
      fc.property(room, fc.integer({ min: 0, max: 400 }), (given, more) => {
        const before = boardRoomLimit(given) ?? 0;
        const after =
          boardRoomLimit({ ...given, height: given.height + more }) ?? 0;
        expect(after).toBeGreaterThanOrEqual(before);
      })
    );
  });

  test('an unmeasured board has no limit', () => {
    expect(
      boardRoomLimit({
        width: 390,
        height: 600,
        chrome: 120,
        boardWidth: 0,
        boardHeight: 0,
      })
    ).toBeUndefined();
  });
});

describe('boardRoomFit', () => {
  test('a board that keeps its shape narrowed takes the limit', () => {
    assertProperty(
      'a board of one shape narrows to its limit',
      fc.property(room, (given) => {
        const shape = given.boardHeight / given.boardWidth;
        expect(
          boardRoomFit({ ...given, heightAt: (width) => width * shape })
        ).toBe(boardRoomLimit(given));
      })
    );
  });

  test('a board with a caption of a set height settles before it is shown', () => {
    // A board over a caption of a set height (Connect Four's drop hint) is
    // not one shape either, but narrowing does shorten it: the tries settle
    // on a width that fits, and only that width is shown.
    const connectFour = {
      width: 320,
      height: 360,
      chrome: 51,
      boardWidth: 320,
      boardHeight: 386,
    };
    const shown: number[] = [];
    const heightAt = (width: number) => {
      shown.push(width);
      return Math.round(width * 1.21 + 44);
    };
    const limit = boardRoomFit({ ...connectFour, heightAt });
    expect(limit).toBeDefined();
    expect(heightAt(limit ?? 0) + connectFour.chrome).toBeLessThanOrEqual(
      connectFour.height
    );
    expect(shown.length).toBeGreaterThan(2);
  });
});
