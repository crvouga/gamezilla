/**
 * How pieces move: which slides run, from where, for how long — and when
 * they must not run at all (reduced motion, no Web Animations, a flip).
 * Slides are read from the harness's recording motion environment.
 */

import { describe, expect, test } from 'bun:test';

import type { ChessBoardHost } from '../board-host';
import { openBoard } from '../board-page';
import { FEN, play } from '../oracle';

const AFTER_E4 = play(FEN.start, 'e2e4');

export function defineMotionScenarios(host: ChessBoardHost): void {
  describe('motion', () => {
    test('a click-click move slides the piece from its square', async () => {
      const board = await openBoard(host, {});
      await board.clickMove('g1', 'f3');
      expect(await board.slides()).toEqual(['wn:g1>f3@150']);
    });

    test('a dropped piece settles from under the pointer; nothing else moves', async () => {
      const board = await openBoard(host, {});
      await board.drag('e2', 'e4');
      expect(await board.slides()).toEqual(['wp:hand>e4@90']);
      await board.expectConsistent();
    });

    test('an illegal drop springs back to its square', async () => {
      const board = await openBoard(host, {});
      await board.drag('f1', 'f5');
      expect(await board.slides()).toEqual(['wb:hand>f1@90']);
      expect(await board.paintedPieces()).toContain('wb@f1');
    });

    test('a piece dragged off the board springs back', async () => {
      const board = await openBoard(host, {});
      await board.dragToRatio('g1', { xRatio: 1.4, yRatio: 0.5 });
      expect(await board.slides()).toEqual(['wn:hand>g1@90']);
      await board.expectFen(FEN.start);
    });

    test("the opponent's reply slides in", async () => {
      const board = await openBoard(host, {
        parent: 'confirm',
        script: [play(AFTER_E4, 'e7e5')],
      });
      await board.drag('e2', 'e4');
      await board.next();
      expect(await board.slides()).toEqual(['wp:hand>e4@90', 'bp:e7>e5@150']);
    });

    test('castling slides the king and the rook together', async () => {
      const board = await openBoard(host, { fen: FEN.castle });
      await board.clickMove('e1', 'g1');
      expect([...(await board.slides())].sort()).toEqual([
        'wk:e1>g1@150',
        'wr:h1>f1@150',
      ]);
    });

    test('a replacement landing mid-slide settles at the authoritative position', async () => {
      const board = await openBoard(host, {
        fen: FEN.start,
        parent: 'ignore',
      });
      await board.clickMove('g1', 'f3');
      await board.settle(75);
      await board.reject();
      expect(await board.slides()).toEqual(['wn:g1>f3@150']);
      await board.expectFen(FEN.start);
      await board.expectConsistent();
    });

    test('flipping the board re-seats the pieces without sliding', async () => {
      const board = await openBoard(host, {});
      await board.flip();
      await board.flip();
      expect(await board.slides()).toEqual([]);
      await board.expectConsistent();
    });

    test('a custom duration drives every slide; 0 snaps', async () => {
      const slow = await openBoard(host, { animationDurationMs: 300 });
      await slow.clickMove('g1', 'f3');
      expect(await slow.slides()).toEqual(['wn:g1>f3@300']);
      await host.close();
      const snap = await openBoard(host, { animationDurationMs: 0 });
      await snap.clickMove('g1', 'f3');
      await snap.drag('e7', 'e5');
      expect(await snap.slides()).toEqual([]);
    });

    test('low-end devices still slide (compositor-only)', async () => {
      const board = await openBoard(host, { lowEnd: true });
      await board.clickMove('g1', 'f3');
      expect(await board.slides()).toEqual(['wn:g1>f3@150']);
    });
  });

  describe('reduced motion', () => {
    test('under reduce motion, moves snap and captures leave no ghost', async () => {
      const fen = play(FEN.start, 'e2e4', 'd7d5');
      const board = await openBoard(host, { fen, reducedMotion: true });
      await board.clickMove('e4', 'd5');
      await board.drag('d8', 'd5');
      await board.expectFen(play(fen, 'e4d5', 'd8d5'));
      expect(await board.slides()).toEqual([]);
      expect(
        (await board.layer('pieces')).filter((t) => t.startsWith('capture'))
      ).toEqual([]);
      await board.expectSounds(['capture', 'capture']);
    });

    test('turning reduce motion on mid-game stops slides at once, and off again', async () => {
      const board = await openBoard(host, {});
      await board.clickMove('g1', 'f3');
      await board.toggle('reducedMotion');
      await board.clickMove('g8', 'f6');
      expect(await board.slides()).toEqual(['wn:g1>f3@150']);
      await board.toggle('reducedMotion');
      await board.clickMove('b1', 'c3');
      expect(await board.slides()).toEqual(['wn:g1>f3@150', 'wn:b1>c3@150']);
    });

    test('an engine without Web Animations snaps every move and shows no ghost', async () => {
      const fen = play(FEN.start, 'e2e4', 'd7d5');
      const board = await openBoard(host, { fen, webAnimations: false });
      await board.clickMove('e4', 'd5');
      await board.expectFen(play(fen, 'e4d5'));
      expect(await board.slides()).toEqual([]);
      expect(
        (await board.layer('pieces')).filter((t) => t.startsWith('capture'))
      ).toEqual([]);
      await board.expectConsistent();
    });
  });
}
