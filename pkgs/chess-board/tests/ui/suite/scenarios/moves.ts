import { describe, expect, test } from 'bun:test';
import type { Square } from '@pkgs/chess-board-core/types';

import type { ChessBoardHost } from '../board-host';
import { openBoard } from '../board-page';
import { FEN, legalTargets, play } from '../oracle';

export function defineMoveScenarios(host: ChessBoardHost): void {
  describe('selecting', () => {
    test('tapping a piece of the side to move selects it and marks its legal targets', async () => {
      const board = await openBoard(host, { fen: FEN.middlegame });
      for (const square of ['f6', 'c5', 'e8', 'h8', 'a7', 'd8'] as const) {
        await board.tap(square);
        const probe = await board.probe();
        expect(probe.selected).toBe(square);
        expect(probe.legalTargets).toEqual(
          legalTargets(FEN.middlegame, square)
        );
        await board.expectConsistent();
        await board.tap(square);
      }
    });

    test('tapping the selected piece again deselects it', async () => {
      const board = await openBoard(host, {});
      await board.tap('g1');
      expect((await board.probe()).selected).toBe('g1');
      await board.tap('g1');
      expect(await board.probe()).toMatchObject({
        selected: null,
        legalTargets: [],
      });
      await board.expectConsistent();
    });

    test('tapping another own piece moves the selection to it', async () => {
      const board = await openBoard(host, {});
      await board.tap('g1');
      await board.tap('b1');
      expect((await board.probe()).selected).toBe('b1');
      expect(await board.moves()).toEqual([]);
      await board.tap('e2');
      expect(await board.probe()).toMatchObject({
        selected: 'e2',
        legalTargets: ['e3', 'e4'],
      });
      expect(await board.sounds()).toEqual([]);
      await board.expectConsistent();
    });

    test("opponent pieces, empty squares and off-turn pieces don't select", async () => {
      const board = await openBoard(host, {});
      for (const square of ['e7', 'e4', 'd8', 'a6'] as const) {
        await board.tap(square);
        expect((await board.probe()).selected).toBeNull();
      }
      await board.expectConsistent();
    });

    test('a pinned piece selects with no legal targets and cannot move', async () => {
      const board = await openBoard(host, { fen: FEN.pinned });
      await board.tap('f2');
      expect(await board.probe()).toMatchObject({
        selected: 'f2',
        legalTargets: [],
      });
      await board.tap('f3');
      await board.drag('f2', 'f4');
      await board.expectFen(FEN.pinned);
      expect(await board.moves()).toEqual([]);
    });

    test('in check, only moves that answer the check are offered', async () => {
      const fen = play(FEN.checkInOne, 'd1h5');
      const board = await openBoard(host, { fen });
      expect((await board.probe()).inCheck).toBe(true);
      await board.expectConsistent();
      for (const square of ['e8', 'g7', 'a7', 'b8'] as const) {
        await board.tap(square);
        expect((await board.probe()).legalTargets).toEqual(
          legalTargets(fen, square)
        );
        await board.tap(square);
      }
      await board.drag('a7', 'a6');
      await board.expectFen(fen);
      await board.clickMove('g7', 'g6');
      await board.expectFen(play(fen, 'g7g6'));
      expect((await board.probe()).inCheck).toBe(false);
      await board.expectConsistent();
    });
  });

  describe('moving', () => {
    test('click-click plays a legal move and hands the turn over', async () => {
      const board = await openBoard(host, { parent: 'confirm' });
      await board.clickMove('g1', 'f3');
      const probe = await board.probe();
      expect(probe).toMatchObject({
        fen: play(FEN.start, 'g1f3'),
        turn: 'b',
        selected: null,
        legalTargets: [],
        lastMove: { from: 'g1', to: 'f3' },
      });
      expect(await board.moves()).toEqual([
        { from: 'g1', to: 'f3', san: 'Nf3', promotion: null, captured: null },
      ]);
      await board.expectConsistent();
      await board.expectSounds(['move']);
    });

    test('drag-and-drop plays a legal move', async () => {
      const board = await openBoard(host, { parent: 'confirm' });
      await board.drag('e2', 'e4');
      await board.expectFen(play(FEN.start, 'e2e4'));
      expect(await board.paintedPieces()).toContain('wp@e4');
      expect(await board.paintedPieces()).not.toContain('wp@e2');
      await board.expectConsistent();
      await board.expectSounds(['move']);
    });

    test('both sides move in turn on a free board', async () => {
      const board = await openBoard(host, { parent: 'confirm' });
      const line = ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5', 'a7a6'];
      let fen: string = FEN.start;
      for (const [i, uci] of line.entries()) {
        const from = uci.slice(0, 2) as Square;
        const to = uci.slice(2, 4) as Square;
        if (i % 2 === 0) await board.drag(from, to);
        else await board.clickMove(from, to);
        fen = play(fen, uci);
        await board.expectFen(fen);
        await board.expectConsistent();
      }
      expect((await board.moves()).map((m) => m.san)).toEqual([
        'e4',
        'e5',
        'Nf3',
        'Nc6',
        'Bb5',
        'a6',
      ]);
    });

    test('captures remove the captured piece and play the capture sound', async () => {
      const fen = play(FEN.start, 'e2e4', 'd7d5');
      const board = await openBoard(host, { fen, animations: false });
      await board.drag('e4', 'd5');
      await board.expectFen(play(fen, 'e4d5'));
      const pieces = await board.paintedPieces();
      expect(pieces).toContain('wp@d5');
      expect(pieces).not.toContain('bp@d5');
      expect((await board.moves())[0]).toMatchObject({ captured: 'p' });
      await board.expectConsistent();
      await board.expectSounds(['capture']);
    });

    test('an illegal click target clears the selection and plays the illegal sound', async () => {
      const board = await openBoard(host, {});
      await board.clickMove('e2', 'e5');
      expect(await board.probe()).toMatchObject({
        fen: FEN.start,
        selected: null,
      });
      expect(await board.moves()).toEqual([]);
      await board.expectConsistent();
      await board.expectSounds(['illegal']);
    });

    test('an illegal drop snaps the piece back', async () => {
      const board = await openBoard(host, {});
      await board.drag('f1', 'f5');
      await board.expectFen(FEN.start);
      expect(await board.paintedPieces()).toContain('wb@f1');
      expect(await board.moves()).toEqual([]);
      await board.expectConsistent();
      await board.expectSounds(['illegal']);
    });

    test('dropping a piece back on its own square does not move it', async () => {
      const board = await openBoard(host, {});
      await board.drag('e2', 'e2');
      await board.expectFen(FEN.start);
      expect(await board.moves()).toEqual([]);
      await board.expectConsistent();
    });

    test('dragging off the board cancels without a move', async () => {
      const board = await openBoard(host, {});
      for (const to of [
        { xRatio: 1.3, yRatio: 0.5 },
        { xRatio: 0.5, yRatio: -0.4 },
      ]) {
        await board.dragToRatio('e2', to);
        await board.expectFen(FEN.start);
        expect((await board.probe()).selected).not.toBe('e3');
      }
      expect(await board.moves()).toEqual([]);
      expect(await board.paintedPieces()).toContain('wp@e2');
      await board.expectConsistent();
    });

    test('dragging an opponent piece or an empty square does nothing', async () => {
      const board = await openBoard(host, {});
      await board.drag('e7', 'e5');
      await board.drag('e4', 'e5');
      await board.expectFen(FEN.start);
      expect(await board.moves()).toEqual([]);
      expect(await board.sounds()).toEqual([]);
      await board.expectConsistent();
    });

    test('starting a drag on another piece replaces the selection', async () => {
      const board = await openBoard(host, {});
      await board.tap('g1');
      await board.drag('d2', 'd4');
      expect(await board.probe()).toMatchObject({
        fen: play(FEN.start, 'd2d4'),
        selected: null,
      });
      await board.expectConsistent();
    });

    test('a move after the game ended is impossible', async () => {
      const board = await openBoard(host, { fen: FEN.mateInOne });
      await board.drag('f3', 'f7');
      const mated = play(FEN.mateInOne, 'f3f7');
      expect(await board.probe()).toMatchObject({
        fen: mated,
        status: 'checkmate',
        inCheck: true,
      });
      await board.expectConsistent();
      await board.drag('e8', 'f7');
      await board.drag('g8', 'f6');
      await board.expectFen(mated);
      expect(await board.moves()).toHaveLength(1);
    });
  });
}
