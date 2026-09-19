import { describe, expect, test } from 'bun:test';
import type { BoardOrientation, Square } from '@pkgs/chess-board-core/types';

import type { ChessBoardHost } from '../board-host';
import { openBoard } from '../board-page';
import { ALL_SQUARES, FEN } from '../oracle';

/** Every edge coordinate label, whatever the order they paint in. */
const COORDINATE_LABELS = 'abcdefgh12345678'.split('').sort().join('');

/** ~1px inside each corner of a 40px square: top-left, bottom-right, … */
const EDGE_POINTS: readonly (readonly [number, number])[] = [
  [0.03, 0.03],
  [0.97, 0.97],
  [0.03, 0.97],
  [0.97, 0.03],
];

export function defineRenderingScenarios(host: ChessBoardHost): void {
  describe('rendering', () => {
    test('start position paints exactly the 32 pieces and no overlays', async () => {
      const board = await openBoard(host, {});
      const probe = await board.probe();
      expect(probe).toMatchObject({
        fen: FEN.start,
        turn: 'w',
        orientation: 'white',
        size: 320,
        status: 'playing',
        inCheck: false,
        selected: null,
        legalTargets: [],
        lastMove: null,
        promotion: null,
        premoves: [],
        interactive: true,
      });
      expect(probe.pieces).toHaveLength(32);
      const paint = await board.paint();
      expect(paint.squares).toEqual([]);
      expect(paint.shapes).toEqual([]);
      expect(paint.arrows).toEqual([]);
      expect(paint.feedback).toEqual([]);
      await board.expectConsistent();
    });

    test('a custom FEN paints its own pieces and side to move', async () => {
      const board = await openBoard(host, { fen: FEN.middlegame });
      expect(await board.probe()).toMatchObject({
        fen: FEN.middlegame,
        turn: 'b',
      });
      expect(await board.paintedPieces()).toContain('wb@c4');
      expect(await board.paintedPieces()).toContain('bn@f6');
      await board.expectConsistent();
    });

    test('every square has a focusable hit target', async () => {
      const board = await openBoard(host, {});
      for (const square of ALL_SQUARES) {
        expect(await board.squareButtonVisible(square)).toBe(true);
      }
    });

    test('coordinates paint once per file and rank, and hide on demand', async () => {
      for (const orientation of ['white', 'black'] as const) {
        const board = await openBoard(host, { orientation });
        const labels = (await board.coordinateText()).split('').sort().join('');
        expect(labels).toBe(COORDINATE_LABELS);
        await board.toggle('showCoordinates');
        expect(await board.coordinateText()).toBe('');
        await host.close();
      }
    });

    for (const orientation of ['white', 'black'] as const) {
      test(`${orientation} orientation: a tap at every square's center lands on that square`, async () => {
        const board = await openBoard(host, { orientation });
        await expectEveryCenterHits(board, orientation);
      });
    }

    test('flipping the board re-maps taps without touching the position', async () => {
      const board = await openBoard(host, {});
      await board.flip();
      expect(await board.probe()).toMatchObject({
        orientation: 'black',
        fen: FEN.start,
      });
      await board.expectConsistent();
      await board.tap('e7');
      expect((await board.probe()).cursor).toBe('e7');
      await board.drag('e2', 'e4');
      expect((await board.probe()).fen).not.toBe(FEN.start);
      expect(await board.paintedPieces()).toContain('wp@e4');
      await board.expectConsistent();
    });

    // Only a real layout engine paints squares; happy-dom boxes are synthetic.
    if (host.measuresLayout) {
      test('taps just inside the painted edges of a square land on it', async () => {
        const layouts = [
          { size: 320 },
          { size: 333 },
          { size: null, frameWidth: 360 },
          { size: null, frameWidth: 363 },
        ] as const;
        for (const layout of layouts) {
          const board = await openBoard(host, {
            ...layout,
            interactive: false,
          });
          const misses = await edgeMisses(board);
          expect({ layout, misses }).toEqual({ layout, misses: [] });
          await host.close();
        }
      }, 120_000);
    }

    test('fill-width boards measure their frame', async () => {
      const board = await openBoard(host, { size: null });
      const layout = await board.ui.get(board.testId).layout();
      const probe = await board.probe();
      expect(layout).not.toBeNull();
      expect(probe.size).toBeGreaterThan(0);
      expect(Math.abs(probe.size - (layout?.width ?? 0))).toBeLessThanOrEqual(
        8
      );
      await expectEveryCenterHits(board, 'white');
    });
  });
}

/** Taps ~1px inside every painted square's corners; returns the misses. */
async function edgeMisses(
  board: Awaited<ReturnType<typeof openBoard>>
): Promise<string[]> {
  const misses: string[] = [];
  for (const square of ALL_SQUARES) {
    for (const [x, y] of EDGE_POINTS) {
      await board.tapInsidePaintedSquare(square, x, y);
      const hit = (await board.probe()).cursor;
      if (hit !== square) misses.push(`${square}@${x},${y}->${hit}`);
    }
  }
  return misses;
}

async function expectEveryCenterHits(
  board: Awaited<ReturnType<typeof openBoard>>,
  orientation: BoardOrientation
): Promise<void> {
  expect((await board.probe()).orientation).toBe(orientation);
  const misses: Square[] = [];
  for (const square of ALL_SQUARES) {
    await board.tap(square);
    if ((await board.probe()).cursor !== square) misses.push(square);
  }
  expect(misses).toEqual([]);
}
