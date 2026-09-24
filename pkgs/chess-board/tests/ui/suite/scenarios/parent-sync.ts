import { describe, expect, test } from 'bun:test';

import type { ChessBoardHost } from '../board-host';
import { openBoard } from '../board-page';
import { FEN, play } from '../oracle';

export function defineParentSyncScenarios(host: ChessBoardHost): void {
  describe('parent-owned position', () => {
    test('a confirmed move keeps board and parent in step', async () => {
      const board = await openBoard(host, { parent: 'confirm' });
      await board.drag('e2', 'e4');
      const fen = play(FEN.start, 'e2e4');
      await board.expectFen(fen);
      expect(await board.ui.get('harness-parent-fen').text()).toBe(fen);
      expect((await board.probe()).lastMove).toEqual({ from: 'e2', to: 'e4' });
      await board.expectConsistent();
    });

    test('the board moves optimistically; bumping the sync key reverts it silently', async () => {
      const board = await openBoard(host, {
        fen: FEN.start,
        parent: 'ignore',
      });
      await board.drag('e2', 'e4');
      await board.expectFen(play(FEN.start, 'e2e4'));
      await board.expectSounds(['move']);
      await board.reject();
      expect(await board.probe()).toMatchObject({
        fen: FEN.start,
        lastMove: null,
        selected: null,
      });
      expect(await board.paintedPieces()).toContain('wp@e2');
      await board.expectConsistent();
      await board.settle();
      expect(await board.sounds()).toEqual(['move']);
    });

    test("an opponent's reply animates in with a last-move highlight and sound", async () => {
      const afterE4 = play(FEN.start, 'e2e4');
      const board = await openBoard(host, {
        parent: 'confirm',
        script: [play(afterE4, 'c7c5')],
      });
      await board.drag('e2', 'e4');
      await board.next();
      expect(await board.probe()).toMatchObject({
        fen: play(afterE4, 'c7c5'),
        turn: 'w',
        lastMove: { from: 'c7', to: 'c5' },
      });
      await board.expectConsistent();
      await board.expectSounds(['move', 'move']);
      expect(await board.spoken()).toBe('Pawn to c5');
      expect(await board.moves()).toHaveLength(1);
    });

    test('jumping to an unrelated position repaints everything with no highlight', async () => {
      const board = await openBoard(host, {
        script: [FEN.middlegame, FEN.castle, FEN.start],
      });
      for (const fen of [FEN.middlegame, FEN.castle, FEN.start]) {
        await board.next();
        expect(await board.probe()).toMatchObject({ fen, lastMove: null });
        await board.expectConsistent();
      }
      await board.settle();
      expect(await board.sounds()).toEqual([]);
    });

    test('a new position clears a selection', async () => {
      const board = await openBoard(host, { script: [FEN.middlegame] });
      await board.tap('e2');
      expect((await board.probe()).selected).toBe('e2');
      await board.next();
      expect(await board.probe()).toMatchObject({
        fen: FEN.middlegame,
        selected: null,
        legalTargets: [],
      });
      await board.expectConsistent();
    });

    test('a new position closes an open promotion picker', async () => {
      const board = await openBoard(host, {
        fen: FEN.whitePromotion,
        script: [FEN.start],
      });
      await board.drag('a7', 'a8');
      expect(await board.promotionVisible()).toBe(true);
      await board.next();
      expect(await board.promotionVisible()).toBe(false);
      expect(await board.probe()).toMatchObject({
        fen: FEN.start,
        promotion: null,
      });
      await board.expectConsistent();
    });

    test('a malformed FEN from the parent keeps the last good position', async () => {
      const board = await openBoard(host, {
        script: ['not a fen', FEN.middlegame],
      });
      await board.next();
      await board.expectFen(FEN.start);
      await board.expectConsistent();
      await board.drag('e2', 'e4');
      await board.expectFen(play(FEN.start, 'e2e4'));
      await board.next();
      await board.expectFen(FEN.middlegame);
      await board.expectConsistent();
    });

    test('a malformed initial FEN mounts the start position', async () => {
      const board = await openBoard(host, { fen: '8/8/8 w - - 0 1' });
      await board.expectFen(FEN.start);
      await board.expectConsistent();
    });
  });
}
