import { describe, expect, test } from 'bun:test';

import type { ChessBoardHost } from '../board-host';
import { openBoard } from '../board-page';
import { FEN, play } from '../oracle';

export function defineAnnotationScenarios(host: ChessBoardHost): void {
  describe('annotations', () => {
    test('parent arrows paint with their color and can be removed', async () => {
      const board = await openBoard(host, {
        arrows: [
          { from: 'e2', to: 'e4' },
          { from: 'g1', to: 'f3', color: 'danger' },
          { from: 'b1', to: 'c3', color: '#00ff00', dashed: true },
        ],
      });
      expect(await board.layer('arrows')).toEqual([
        'arrow:#00ff00@b1-c3',
        'arrow:danger@g1-f3',
        'arrow:primary@e2-e4',
      ]);
      await board.toggleArrows();
      expect(await board.layer('arrows')).toEqual([]);
      await board.toggleArrows();
      expect(await board.layer('arrows')).toHaveLength(3);
      await board.flip();
      expect(await board.layer('arrows')).toHaveLength(3);
    });

    test('cell highlights paint as fills or rings under the pieces', async () => {
      const board = await openBoard(host, {
        cellHighlights: {
          e4: { color: 'red' },
          d4: { color: 'blue', ring: true },
        },
      });
      expect(
        (await board.layer('squares')).filter((t) => t.startsWith('highlight'))
      ).toEqual(['highlight:ring@d4', 'highlight@e4']);
      await board.expectConsistent();
    });

    test('cell feedback badges paint on their squares', async () => {
      const board = await openBoard(host, {
        cellFeedback: {
          e4: { kind: 'check' },
          d5: { kind: 'cross', corner: 'center' },
          h8: { kind: 'doubleExclam' },
        },
      });
      expect(await board.layer('feedback')).toEqual([
        'feedback:check@e4',
        'feedback:cross@d5',
        'feedback:doubleExclam@h8',
      ]);
    });

    test('legal-move markers can be turned off without hiding the selection', async () => {
      const board = await openBoard(host, { highlightLegalMoves: false });
      await board.tap('g1');
      expect((await board.probe()).legalTargets).toEqual(['f3', 'h3']);
      expect(await board.layer('squares')).toEqual(['selected@g1']);
      await board.expectConsistent({ highlightLegalMoves: false });
      await board.toggle('highlightLegalMoves');
      expect(await board.layer('squares')).toEqual([
        'dot@f3',
        'dot@h3',
        'selected@g1',
      ]);
    });

    test('capture targets paint as rings, quiet targets as dots', async () => {
      const fen = play(FEN.start, 'e2e4', 'd7d5');
      const board = await openBoard(host, { fen });
      await board.tap('e4');
      expect(await board.layer('squares')).toEqual([
        'dot@e5',
        'ring@d5',
        'selected@e4',
      ]);
      await board.expectConsistent();
    });

    test('the last-move highlight can be turned off', async () => {
      const board = await openBoard(host, {
        parent: 'confirm',
        highlightLastMove: false,
      });
      await board.drag('e2', 'e4');
      expect(await board.layer('squares')).toEqual([]);
      await board.expectConsistent({ highlightLastMove: false });
      await board.toggle('highlightLastMove');
      expect(await board.layer('squares')).toEqual([
        'last-move@e2',
        'last-move@e4',
      ]);
    });
  });
}
