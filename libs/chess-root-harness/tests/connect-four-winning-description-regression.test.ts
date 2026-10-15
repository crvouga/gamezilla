import { expect, test } from 'bun:test';
import { establishConnectFour } from '@libs/connect-four-harness/connect-four-actions';
import { connectFourBoardDescription } from '@libs/connect-four-harness/connect-four-review';
import { openHarness } from './open-chess-harness';

// regression: connect-four-winning-description
test('the completed board describes all four winning discs accessibly', async () => {
  await using s = await openHarness('connect-four-winning-description');
  await s.apply(establishConnectFour, { moves: [0, 6, 1, 6, 2, 6, 3] });
  const board = (await s.read(connectFourBoardDescription, 'alice')) ?? '';
  expect(board.match(/winning disc/g) ?? []).toHaveLength(4);
  for (const column of [1, 2, 3, 4]) {
    expect(board).toContain(
      `Column ${column}, row 1: Red circle, winning disc`
    );
  }
}, 120_000);
