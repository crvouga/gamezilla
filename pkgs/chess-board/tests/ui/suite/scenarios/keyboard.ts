import { describe, expect, test } from 'bun:test';
import { chessBoardSquareTestId } from '@pkgs/chess-board-core/probe';
import type { Square } from '@pkgs/chess-board-core/types';
import type { DriverKey } from '@pkgs/ui-testing';

import type { ChessBoardHost } from '../board-host';
import { openBoard } from '../board-page';
import { ALL_SQUARES, FEN, play } from '../oracle';

export function defineKeyboardScenarios(host: ChessBoardHost): void {
  describe('keyboard', () => {
    test('arrows move the cursor in screen space for white', async () => {
      const board = await openBoard(host, {});
      expect((await board.probe()).cursor).toBe('a1');
      const walk: [DriverKey, Square][] = [
        ['arrowUp', 'a2'],
        ['arrowRight', 'b2'],
        ['arrowRight', 'c2'],
        ['arrowDown', 'c1'],
        ['arrowLeft', 'b1'],
      ];
      for (const [key, square] of walk) {
        await board.key(key);
        expect((await board.probe()).cursor).toBe(square);
      }
    });

    test('arrows move the cursor in screen space for black', async () => {
      const board = await openBoard(host, { orientation: 'black' });
      expect((await board.probe()).cursor).toBe('h8');
      const walk: [DriverKey, Square][] = [
        ['arrowUp', 'h7'],
        ['arrowRight', 'g7'],
        ['arrowDown', 'g8'],
        ['arrowLeft', 'h8'],
      ];
      for (const [key, square] of walk) {
        await board.key(key);
        expect((await board.probe()).cursor).toBe(square);
      }
    });

    test('the cursor stops at the board edges', async () => {
      const board = await openBoard(host, {});
      await board.key('arrowDown');
      await board.key('arrowLeft');
      expect((await board.probe()).cursor).toBe('a1');
      for (let i = 0; i < 9; i += 1) await board.key('arrowUp');
      for (let i = 0; i < 9; i += 1) await board.key('arrowRight');
      expect((await board.probe()).cursor).toBe('h8');
    });

    test('Enter picks a piece up and puts it down on a legal square', async () => {
      const board = await openBoard(host, { parent: 'confirm' });
      await board.key('arrowRight');
      await board.key('arrowRight');
      await board.key('arrowRight');
      await board.key('arrowRight');
      await board.key('arrowUp');
      await board.key('enter');
      expect((await board.probe()).selected).toBe('e2');
      await board.key('arrowUp');
      await board.key('arrowUp');
      await board.key('enter');
      await board.expectFen(play(FEN.start, 'e2e4'));
      await board.expectConsistent();
    });

    test('Space works like Enter and a second press on the piece deselects', async () => {
      const board = await openBoard(host, {});
      await board.key('arrowRight');
      await board.key('space');
      expect((await board.probe()).selected).toBe('b1');
      await board.key('space');
      expect((await board.probe()).selected).toBeNull();
      await board.key('space');
      await board.key('arrowUp');
      await board.key('arrowUp');
      await board.key('arrowRight');
      await board.key('space');
      await board.expectFen(play(FEN.start, 'b1c3'));
    });

    for (const orientation of ['white', 'black'] as const) {
      test(`${orientation}: Enter on a focused square button acts on that square`, async () => {
        const board = await openBoard(host, { orientation, parent: 'confirm' });
        await board.ui
          .get(chessBoardSquareTestId(board.testId, 'g1'))
          .key('enter');
        expect(await board.probe()).toMatchObject({
          cursor: 'g1',
          selected: 'g1',
        });
        await board.ui
          .get(chessBoardSquareTestId(board.testId, 'f3'))
          .key('enter');
        await board.expectFen(play(FEN.start, 'g1f3'));
        await board.expectConsistent();
      });
    }

    // Only a real layout engine puts each button over its painted square.
    if (host.measuresLayout) {
      for (const orientation of ['white', 'black'] as const) {
        test(`${orientation}: every square button sits over its own square`, async () => {
          const board = await openBoard(host, {
            orientation,
            interactive: false,
          });
          const misses: string[] = [];
          for (const square of ALL_SQUARES) {
            await board.ui
              .get(chessBoardSquareTestId(board.testId, square))
              .tap();
            const hit = (await board.probe()).cursor;
            if (hit !== square) misses.push(`${square}->${hit}`);
          }
          expect(misses).toEqual([]);
        });
      }
    }

    test('tapping a square moves the keyboard cursor there', async () => {
      const board = await openBoard(host, {});
      await board.tap('d5');
      expect((await board.probe()).cursor).toBe('d5');
      await board.key('arrowDown');
      expect((await board.probe()).cursor).toBe('d4');
    });
  });
}
