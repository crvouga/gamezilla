import { describe, expect, test } from 'bun:test';

import type { ChessBoardHost } from '../board-host';
import { openBoard } from '../board-page';
import { FEN } from '../oracle';

export function defineUserShapeScenarios(host: ChessBoardHost): void {
  describe('user shapes', () => {
    test('a right-drag draws an arrow and reports it; the same drag erases it', async () => {
      const board = await openBoard(host, { enableUserArrows: true });
      await board.rightDrag('e2', 'e4');
      expect(await board.layer('arrows')).toEqual(['arrow:primary@e2-e4']);
      expect(await board.userArrows()).toEqual([
        { from: 'e2', to: 'e4', color: 'primary', id: 'e2-e4' },
      ]);
      await board.rightDrag('g1', 'f3');
      expect(await board.layer('arrows')).toEqual([
        'arrow:primary@e2-e4',
        'arrow:primary@g1-f3',
      ]);
      await board.rightDrag('e2', 'e4');
      expect(await board.layer('arrows')).toEqual(['arrow:primary@g1-f3']);
      expect(await board.userArrows()).toHaveLength(1);
      await board.expectFen(FEN.start);
      expect(await board.moves()).toEqual([]);
    });

    test('a right-click circles a square; again removes the circle', async () => {
      const board = await openBoard(host, { enableUserArrows: true });
      await board.rightClick('d5');
      expect(await board.layer('shapes')).toEqual(['circle:primary@d5']);
      await board.rightClick('f7');
      expect(await board.layer('shapes')).toEqual([
        'circle:primary@d5',
        'circle:primary@f7',
      ]);
      await board.rightClick('d5');
      expect(await board.layer('shapes')).toEqual(['circle:primary@f7']);
      expect(await board.userArrows()).toEqual([]);
    });

    test('a left press clears every user shape but keeps parent arrows', async () => {
      const board = await openBoard(host, {
        enableUserArrows: true,
        arrows: [{ from: 'd2', to: 'd4', color: 'secondary' }],
      });
      await board.rightDrag('e2', 'e4');
      await board.rightClick('c6');
      await board.tap('h5');
      expect(await board.layer('arrows')).toEqual(['arrow:secondary@d2-d4']);
      expect(await board.layer('shapes')).toEqual([]);
      expect(await board.userArrows()).toEqual([]);
    });

    test('right-button gestures never move pieces', async () => {
      const board = await openBoard(host, { enableUserArrows: true });
      await board.rightDrag('e2', 'e4');
      await board.rightClick('g1');
      await board.rightDrag('g1', 'f3');
      await board.expectFen(FEN.start);
      expect((await board.probe()).selected).toBeNull();
      expect(await board.moves()).toEqual([]);
      await board.expectConsistent();
    });

    test('with user arrows off, right-button gestures draw nothing', async () => {
      const board = await openBoard(host, {});
      await board.rightDrag('e2', 'e4');
      await board.rightClick('d5');
      expect(await board.layer('arrows')).toEqual([]);
      expect(await board.layer('shapes')).toEqual([]);
      await board.expectFen(FEN.start);
      expect(await board.moves()).toEqual([]);
    });

    test('shapes follow the board when it flips', async () => {
      const board = await openBoard(host, { enableUserArrows: true });
      await board.flip();
      await board.rightDrag('e7', 'e5');
      await board.rightClick('a1');
      expect(await board.layer('arrows')).toEqual(['arrow:primary@e7-e5']);
      expect(await board.layer('shapes')).toEqual(['circle:primary@a1']);
    });
  });
}
