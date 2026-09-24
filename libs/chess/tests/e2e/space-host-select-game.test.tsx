// goal:spaces:3
import { describe, expect, test } from 'bun:test';
import { focusActor } from '@libs/sim-harness';
import {
  createSpace,
  joinFromPrompt,
  openSpaceLink,
  selectChessGame,
} from '@libs/spaces/sim/space-actions';
import { readSpaceLink } from '@libs/spaces/sim/spaces-ui-reads';
import { Handles } from '@libs/test-ids';
import { openSim } from './support/open-chess-sim';

describe('space host selects the game', () => {
  test('the host picks chess and everyone in the space is taken to it', async () => {
    await using s = await openSim('host-select-game');
    await s.apply(createSpace, 'alice');
    const link = await s.read(readSpaceLink, 'alice');
    expect(link).toMatch(/^\/space\//);
    await s.apply(openSpaceLink, 'bob', link ?? '');
    await s.apply(joinFromPrompt, 'bob');

    await s.apply(focusActor, 'alice');
    await s.apply(selectChessGame, 'alice');

    // What the space plays is room state: bob lands on chess without acting.
    await s.apply(focusActor, 'bob');
    await s.until(
      async (surf) => {
        const bob = surf.actors.get('bob');
        return (
          (await bob?.ui.get(Handles.chessMenuPuzzle).isVisible()) ?? false
        );
      },
      { maxMs: 15_000 }
    );
  });
});
