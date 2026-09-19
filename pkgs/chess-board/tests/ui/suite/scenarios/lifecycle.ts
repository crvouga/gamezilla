import { describe, expect, test } from 'bun:test';

import type { ChessBoardHost } from '../board-host';
import { openBoard } from '../board-page';
import { FEN, play } from '../oracle';

export function defineLifecycleScenarios(host: ChessBoardHost): void {
  describe('interactivity', () => {
    test('a non-interactive board ignores taps, drags and keys', async () => {
      const board = await openBoard(host, { interactive: false });
      expect((await board.probe()).interactive).toBe(false);
      await board.tap('e2');
      await board.drag('e2', 'e4');
      await board.clickMove('g1', 'f3');
      await board.key('enter');
      expect(await board.probe()).toMatchObject({
        fen: FEN.start,
        selected: null,
      });
      expect(await board.moves()).toEqual([]);
      expect(await board.sounds()).toEqual([]);
      await board.expectConsistent();
    });

    test('turning interaction off drops the selection; on again, moves work', async () => {
      const board = await openBoard(host, { parent: 'confirm' });
      await board.tap('e2');
      await board.toggle('interactive');
      expect(await board.probe()).toMatchObject({
        interactive: false,
        selected: null,
        legalTargets: [],
      });
      await board.expectConsistent();
      await board.toggle('interactive');
      await board.drag('e2', 'e4');
      await board.expectFen(play(FEN.start, 'e2e4'));
    });

    test('a view-only controlled board ignores gestures; a movable one plays', async () => {
      const board = await openBoard(host, {
        board: 'controlled',
        interactive: false,
        parent: 'confirm',
      });
      await board.drag('e2', 'e4');
      await board.expectFen(FEN.start);
      await board.toggle('interactive');
      await board.drag('e2', 'e4');
      await board.expectFen(play(FEN.start, 'e2e4'));
      expect(await board.moves()).toHaveLength(1);
      await board.expectConsistent();
    });
  });

  describe('mounting', () => {
    test('remounting shows the parent position with no leftover state', async () => {
      const board = await openBoard(host, { parent: 'ignore' });
      await board.drag('e2', 'e4');
      await board.tap('e7');
      await board.remount();
      expect(await board.probe()).toMatchObject({
        fen: FEN.start,
        selected: null,
        lastMove: null,
      });
      await board.expectConsistent();
    });

    test('unmounting cancels follow-up sounds still scheduled', async () => {
      const board = await openBoard(host, { fen: FEN.checkInOne });
      await board.drag('d1', 'h5');
      await board.unmount();
      expect(await board.isPresent()).toBe(false);
      await board.settle(600);
      expect(await board.sounds()).toEqual(['move']);
    });

    test('two boards on one screen do not share ids or state', async () => {
      const board = await openBoard(host, { testId: 'other-board' });
      await board.drag('e2', 'e4');
      await board.expectFen(play(FEN.start, 'e2e4'));
      await board.expectConsistent();
    });
  });

  describe('animation', () => {
    test('a capture leaves a fading ghost that clears after the slide', async () => {
      const fen = play(FEN.start, 'e2e4', 'd7d5');
      const board = await openBoard(host, { fen, animations: true });
      await board.drag('e4', 'd5');
      expect(await board.layer('pieces')).toContain('capture-ghost:bp@d5');
      await board.expectConsistent();
      await board.settle(400);
      expect(
        (await board.layer('pieces')).filter((t) => t.startsWith('capture'))
      ).toEqual([]);
      await board.expectSounds(['capture']);
    });

    test('with animations off, captures leave no ghost', async () => {
      const fen = play(FEN.start, 'e2e4', 'd7d5');
      const board = await openBoard(host, { fen, animations: false });
      await board.drag('e4', 'd5');
      expect(
        (await board.layer('pieces')).filter((t) => t.startsWith('capture'))
      ).toEqual([]);
    });

    test('fast successive moves never leave pieces behind', async () => {
      const board = await openBoard(host, {
        parent: 'confirm',
        animations: true,
      });
      for (const uci of ['e2e4', 'd7d5', 'e4d5', 'd8d5', 'b1c3', 'd5a5']) {
        await board.drag(uci.slice(0, 2) as 'e2', uci.slice(2, 4) as 'e4');
      }
      await board.expectFen(
        play(FEN.start, 'e2e4', 'd7d5', 'e4d5', 'd8d5', 'b1c3', 'd5a5')
      );
      await board.expectConsistent();
      await board.settle(400);
      expect(
        (await board.layer('pieces')).filter((t) => !t.startsWith('piece:'))
      ).toEqual([]);
    });
  });
}
