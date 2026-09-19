import { describe, expect, test } from 'bun:test';
import type { HarnessConfig } from '../../harness/harness-config';
import type { ChessBoardHost } from '../board-host';
import { openBoard } from '../board-page';
import { FEN, play } from '../oracle';

const AFTER_E4 = play(FEN.start, 'e2e4');

/**
 * White plays e4 (the parent confirms it); `replies` are black's answers the
 * parent pushes, one per `harness-next`, each as a UCI line from after 1.e4.
 */
function premoveConfig(
  ...replies: readonly (readonly string[])[]
): HarnessConfig {
  return {
    parent: 'confirm',
    premoves: true,
    animations: false,
    script: replies.map((line) => play(AFTER_E4, ...line)),
  };
}

export function definePremoveScenarios(host: ChessBoardHost): void {
  describe('premoves', () => {
    test("queueing a move on the opponent's turn shows a premove and plays it after the reply", async () => {
      const board = await openBoard(host, premoveConfig(['e7e5']));
      await board.drag('e2', 'e4');
      await board.drag('g1', 'f3');
      expect(await board.probe()).toMatchObject({
        fen: AFTER_E4,
        premoves: [{ from: 'g1', to: 'f3' }],
      });
      const pieces = await board.layer('pieces');
      expect(pieces).toContain('premove-ghost:wn@f3');
      expect(pieces).toContain('piece:wn@g1');
      await board.expectConsistent();
      expect(await board.moves()).toHaveLength(1);

      await board.next();
      const fen = play(AFTER_E4, 'e7e5', 'g1f3');
      expect(await board.probe()).toMatchObject({
        fen,
        premoves: [],
        lastMove: { from: 'g1', to: 'f3' },
      });
      expect((await board.moves()).map((m) => m.san)).toEqual(['e4', 'Nf3']);
      expect(await board.ui.get('harness-parent-fen').text()).toBe(fen);
      expect(await board.layer('pieces')).not.toContain('premove-ghost:wn@f3');
      await board.expectConsistent();
    });

    test('a click-click premove works like a dragged one', async () => {
      const board = await openBoard(host, premoveConfig(['e7e5']));
      await board.drag('e2', 'e4');
      await board.clickMove('d2', 'd4');
      expect((await board.probe()).premoves).toEqual([
        { from: 'd2', to: 'd4' },
      ]);
      await board.next();
      await board.expectFen(play(AFTER_E4, 'e7e5', 'd2d4'));
      await board.expectConsistent();
    });

    test('a premove the reply made illegal is dropped', async () => {
      const board = await openBoard(host, premoveConfig(['b7b5']));
      await board.drag('e2', 'e4');
      await board.drag('f1', 'a6');
      expect((await board.probe()).premoves).toEqual([
        { from: 'f1', to: 'a6' },
      ]);
      await board.next();
      expect(await board.probe()).toMatchObject({
        fen: play(AFTER_E4, 'b7b5'),
        premoves: [],
        turn: 'w',
      });
      expect(await board.moves()).toHaveLength(1);
      await board.expectConsistent();
    });

    test('tapping an empty square cancels the queued premoves', async () => {
      const board = await openBoard(host, premoveConfig(['e7e5']));
      await board.drag('e2', 'e4');
      await board.drag('g1', 'f3');
      await board.tap('a5');
      expect((await board.probe()).premoves).toEqual([]);
      await board.expectConsistent();
      await board.next();
      await board.expectFen(play(AFTER_E4, 'e7e5'));
      expect(await board.moves()).toHaveLength(1);
    });

    test('several premoves queue and land one per reply', async () => {
      const board = await openBoard(
        host,
        premoveConfig(['e7e5'], ['e7e5', 'g1f3', 'b8c6'])
      );
      await board.drag('e2', 'e4');
      await board.drag('g1', 'f3');
      await board.drag('f1', 'c4');
      expect((await board.probe()).premoves).toEqual([
        { from: 'g1', to: 'f3' },
        { from: 'f1', to: 'c4' },
      ]);
      await board.expectConsistent();
      await board.next();
      await board.expectFen(play(AFTER_E4, 'e7e5', 'g1f3'));
      expect((await board.probe()).premoves).toEqual([
        { from: 'f1', to: 'c4' },
      ]);
      await board.expectConsistent();
      await board.next();
      expect(await board.probe()).toMatchObject({
        fen: play(AFTER_E4, 'e7e5', 'g1f3', 'b8c6', 'f1c4'),
        premoves: [],
      });
      expect((await board.moves()).map((m) => m.san)).toEqual([
        'e4',
        'Nf3',
        'Bc4',
      ]);
      await board.expectConsistent();
    });

    test("with premoves off, the waiting side's pieces don't move", async () => {
      const board = await openBoard(host, {
        ...premoveConfig(['e7e5']),
        premoves: false,
      });
      await board.drag('e2', 'e4');
      await board.drag('g1', 'f3');
      expect(await board.probe()).toMatchObject({
        fen: AFTER_E4,
        premoves: [],
      });
      await board.tap('d2');
      expect((await board.probe()).selected).toBeNull();
    });

    test('turning premoves off drops the queue', async () => {
      const board = await openBoard(host, premoveConfig(['e7e5']));
      await board.drag('e2', 'e4');
      await board.drag('g1', 'f3');
      await board.toggle('premoves');
      expect((await board.probe()).premoves).toEqual([]);
      await board.expectConsistent();
      await board.next();
      await board.expectFen(play(AFTER_E4, 'e7e5'));
    });
  });
}
