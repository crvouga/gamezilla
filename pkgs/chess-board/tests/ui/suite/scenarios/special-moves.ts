import { describe, expect, test } from 'bun:test';

import type { ChessBoardHost } from '../board-host';
import { openBoard } from '../board-page';
import { FEN, play } from '../oracle';

export function defineSpecialMoveScenarios(host: ChessBoardHost): void {
  describe('castling', () => {
    for (const [uci, rook, san] of [
      ['e1g1', 'wr@f1', 'O-O'],
      ['e1c1', 'wr@d1', 'O-O-O'],
    ] as const) {
      test(`${san} moves king and rook (drag and click)`, async () => {
        for (const gesture of ['drag', 'click'] as const) {
          const board = await openBoard(host, { fen: FEN.castle });
          const from = 'e1';
          const to = uci.slice(2, 4) as 'g1' | 'c1';
          if (gesture === 'drag') await board.drag(from, to);
          else await board.clickMove(from, to);
          await board.expectFen(play(FEN.castle, uci));
          const pieces = await board.paintedPieces();
          expect(pieces).toContain(`wk@${to}`);
          expect(pieces).toContain(rook);
          expect((await board.moves())[0]?.san).toBe(san);
          await board.expectConsistent();
          await board.expectSounds(['castle']);
          expect(await board.spoken()).toContain(
            san === 'O-O' ? 'kingside' : 'queenside'
          );
          await host.close();
        }
      });
    }
  });

  describe('en passant', () => {
    test('removes the pawn that passed, not a piece on the target square', async () => {
      const board = await openBoard(host, {
        fen: FEN.enPassant,
        animations: false,
      });
      await board.tap('e5');
      expect((await board.probe()).legalTargets).toEqual(['e6', 'f6']);
      await board.tap('f6');
      await board.expectFen(play(FEN.enPassant, 'e5f6'));
      const pieces = await board.paintedPieces();
      expect(pieces).toContain('wp@f6');
      expect(pieces).not.toContain('bp@f5');
      expect((await board.moves())[0]).toMatchObject({
        san: 'exf6',
        captured: 'p',
      });
      await board.expectConsistent();
      await board.expectSounds(['capture']);
    });
  });

  describe('promotion', () => {
    for (const choice of ['q', 'r', 'b', 'n'] as const) {
      test(`the picker promotes to ${choice}`, async () => {
        const board = await openBoard(host, { fen: FEN.whitePromotion });
        await board.drag('a7', 'a8');
        expect(await board.promotionVisible()).toBe(true);
        expect((await board.probe()).promotion).toEqual({
          from: 'a7',
          to: 'a8',
          color: 'w',
        });
        expect(await board.moves()).toEqual([]);
        await board.promote(choice);
        expect(await board.promotionVisible()).toBe(false);
        await board.expectFen(play(FEN.whitePromotion, `a7a8${choice}`));
        expect(await board.paintedPieces()).toContain(`w${choice}@a8`);
        expect(await board.paintedPieces()).not.toContain('wp@a8');
        expect((await board.moves())[0]).toMatchObject({ promotion: choice });
        await board.expectConsistent();
      });
    }

    test('promotion with capture, by clicks, for black on a flipped board', async () => {
      const board = await openBoard(host, {
        fen: FEN.blackPromotion,
        orientation: 'black',
        animations: false,
      });
      await board.clickMove('a2', 'b1');
      expect((await board.probe()).promotion).toEqual({
        from: 'a2',
        to: 'b1',
        color: 'b',
      });
      await board.promote('n');
      await board.expectFen(play(FEN.blackPromotion, 'a2b1n'));
      expect(await board.paintedPieces()).toContain('bn@b1');
      expect(await board.paintedPieces()).not.toContain('wn@b1');
      expect((await board.moves())[0]).toMatchObject({
        promotion: 'n',
        captured: 'n',
      });
      await board.expectConsistent();
      await board.expectSounds(['capture', 'promote']);
    });

    test('cancelling the picker leaves the pawn where it was', async () => {
      const board = await openBoard(host, { fen: FEN.whitePromotion });
      await board.drag('a7', 'a8');
      await board.promote('cancel');
      expect(await board.promotionVisible()).toBe(false);
      expect(await board.probe()).toMatchObject({
        fen: FEN.whitePromotion,
        promotion: null,
      });
      expect(await board.paintedPieces()).toContain('wp@a7');
      expect(await board.moves()).toEqual([]);
      await board.expectConsistent();
      await board.drag('a7', 'b8');
      await board.promote('q');
      await board.expectFen(play(FEN.whitePromotion, 'a7b8q'));
      await board.expectConsistent();
    });

    test('Escape in the picker cancels', async () => {
      const board = await openBoard(host, { fen: FEN.whitePromotion });
      await board.drag('a7', 'a8');
      await board.ui.get(`${board.testId}-promotion-q`).key('escape');
      expect(await board.promotionVisible()).toBe(false);
      await board.expectFen(FEN.whitePromotion);
      expect(await board.moves()).toEqual([]);
    });

    test('while the picker is open the board takes no other move', async () => {
      const board = await openBoard(host, { fen: FEN.whitePromotion });
      await board.drag('a7', 'a8');
      await board.drag('g1', 'g2');
      await board.expectFen(FEN.whitePromotion);
      expect(await board.moves()).toEqual([]);
      expect(await board.paintedPieces()).toContain('wk@g1');
    });

    test('autoPromoteQueen skips the picker', async () => {
      const board = await openBoard(host, {
        fen: FEN.whitePromotion,
        autoPromoteQueen: true,
      });
      await board.drag('a7', 'a8');
      expect(await board.promotionVisible()).toBe(false);
      await board.expectFen(play(FEN.whitePromotion, 'a7a8q'));
      expect(await board.paintedPieces()).toContain('wq@a8');
      await board.expectConsistent();
    });
  });

  describe('check and game end', () => {
    test('check highlights the king and plays move then check', async () => {
      const board = await openBoard(host, { fen: FEN.checkInOne });
      await board.drag('d1', 'h5');
      expect(await board.probe()).toMatchObject({
        inCheck: true,
        status: 'playing',
        turn: 'b',
      });
      expect(
        (await board.layer('squares')).filter((t) => t.startsWith('check'))
      ).toEqual(['check@e8']);
      await board.expectConsistent();
      await board.expectSounds(['move', 'check']);
      expect(await board.spoken()).toBe('Queen to h5, check');
    });

    test('checkmate ends the game with move, check and game-end sounds', async () => {
      const board = await openBoard(host, {
        fen: FEN.mateInOne,
        animations: false,
      });
      await board.clickMove('f3', 'f7');
      expect(await board.probe()).toMatchObject({ status: 'checkmate' });
      await board.expectConsistent();
      await board.expectSounds(['capture', 'check', 'gameEnd']);
      expect(await board.spoken()).toBe('Queen takes f7, checkmate');
    });

    test('stalemate ends the game without a check', async () => {
      const board = await openBoard(host, { fen: FEN.stalemateInOne });
      await board.drag('f6', 'f7');
      expect(await board.probe()).toMatchObject({
        status: 'stalemate',
        inCheck: false,
      });
      await board.expectConsistent();
      await board.expectSounds(['move', 'gameEnd']);
    });
  });
}
