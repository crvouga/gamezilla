import { describe, expect, test } from 'bun:test';

import type { Square } from '@pkgs/chess-board-core/types';
import type { ElementLayout } from '@pkgs/ui-testing';

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

    // Only a real layout engine positions the picker; happy-dom boxes are synthetic.
    if (host.measuresLayout) {
      test('the picker sits on the promotion file, queen on the square, all inside the board', async () => {
        const cases = [
          {
            fen: FEN.whitePromotion,
            from: 'a7',
            to: 'a8',
            orientation: 'white',
            size: 320,
          },
          {
            fen: FEN.whitePromotion,
            from: 'a7',
            to: 'b8',
            orientation: 'black',
            size: 333,
          },
          {
            fen: FEN.blackPromotion,
            from: 'a2',
            to: 'b1',
            orientation: 'white',
            size: null,
          },
          {
            fen: FEN.blackPromotion,
            from: 'a2',
            to: 'a1',
            orientation: 'black',
            size: null,
          },
        ] as const;
        for (const c of cases) {
          const board = await openBoard(host, {
            fen: c.fen,
            orientation: c.orientation,
            size: c.size,
            frameWidth: 363,
          });
          await board.drag(c.from, c.to);
          const problems = await pickerProblems(board, c.to);
          expect({ c, problems }).toEqual({ c, problems: [] });
          await host.close();
        }
      });
    }

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

const EPS = 0.5;

/** Where the open picker is not where it belongs (empty when it is). */
async function pickerProblems(
  board: Awaited<ReturnType<typeof openBoard>>,
  to: Square
): Promise<string[]> {
  const painted = await board.paintedBox();
  const square = await board.squareBox(to);
  const center = {
    x: square.x + square.width / 2,
    y: square.y + square.height / 2,
  };
  const problems: string[] = [];
  for (const choice of ['q', 'r', 'b', 'n', 'cancel'] as const) {
    const box = await board.promotionBox(choice);
    if (!contains(painted, box)) problems.push(`${choice} outside board`);
    const onFile = center.x >= box.x && center.x <= box.x + box.width;
    if (choice !== 'cancel' && !onFile) problems.push(`${choice} off the file`);
  }
  const queen = await board.promotionBox('q');
  if (!containsPoint(queen, center)) problems.push('queen off the square');
  return problems;
}

function contains(outer: ElementLayout, inner: ElementLayout): boolean {
  return (
    inner.x >= outer.x - EPS &&
    inner.y >= outer.y - EPS &&
    inner.x + inner.width <= outer.x + outer.width + EPS &&
    inner.y + inner.height <= outer.y + outer.height + EPS
  );
}

function containsPoint(
  box: ElementLayout,
  p: { readonly x: number; readonly y: number }
): boolean {
  return (
    p.x >= box.x &&
    p.x <= box.x + box.width &&
    p.y >= box.y &&
    p.y <= box.y + box.height
  );
}
