import { expect, test } from 'bun:test';
import {
  establishCustomGame,
  returnToCustomGames,
} from '@libs/game-session-harness-ts/custom-game-lineup';
import { customGameView } from '@libs/game-session-harness-ts/custom-game-probe';
import { backToTabs, focusActor } from '@libs/harness-ts/shell-actions';
import { LIGHT_CYCLES_DUEL_HARNESS_GAME } from '@libs/light-cycles-harness-ts/light-cycles-harness-game';
import { PONG_HARNESS_GAME } from '@libs/pong-harness-ts/pong-harness-game';
import { closeSpaceScreen } from '@libs/spaces-harness-ts/space-actions';
import { readSpaceLink } from '@libs/spaces-harness-ts/spaces-ui-reads';
import { openConformanceHarness } from './conformance-world';

// regression: simulation-board-release-reads-controls-while-disposed
test.each([PONG_HARNESS_GAME, LIGHT_CYCLES_DUEL_HARNESS_GAME])(
  'returning to the custom games with $label under way shows the game still running',
  async (game) => {
    await using s = await openConformanceHarness(
      `simulation-board-return-${game.shared.id}`
    );
    await s.apply(establishCustomGame, game.shared.id, {});
    const link = await s.read(readSpaceLink, 'alice');
    // Alice steps out of the space and comes back to its custom games: the
    // board she left is taken away as the screen shows the game again.
    await s.apply(focusActor, 'alice');
    await s.apply(closeSpaceScreen, 'alice');
    await s.apply(backToTabs, 'alice');
    await s.apply(returnToCustomGames, game.shared.id, 'alice', link!);
    const seen = await s.read((world) => customGameView(world, 'alice'));
    expect(seen.current?.status).toBe('active');
    expect(seen.current?.outcome ?? '').toBe('');
  },
  120_000
);
