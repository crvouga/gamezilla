import { expect, test } from 'bun:test';
import { establishCustomGame } from '@libs/game-session-harness-ts/custom-game-lineup';
import { customGameView } from '@libs/game-session-harness-ts/custom-game-probe';
import {
  finishingSimulationExample,
  restoreSharedSimulationAt,
} from '@libs/game-session-harness-ts/simulation-fixtures';
import { LIGHT_CYCLES_DUEL_HARNESS_GAME } from '@libs/light-cycles-harness-ts/light-cycles-harness-game';
import { PONG_HARNESS_GAME } from '@libs/pong-harness-ts/pong-harness-game';
import { openConformanceHarness } from './conformance-world';

// regression: simulation-finished-custom-game-needs-turns
test.each([PONG_HARNESS_GAME, LIGHT_CYCLES_DUEL_HARNESS_GAME])(
  '$label reaches a finished custom game from its own terminal example',
  async (game) => {
    await using s = await openConformanceHarness(
      `finished-simulation-${game.shared.id}`
    );
    await s.apply(establishCustomGame, game.shared.id, {});
    await s.apply(
      restoreSharedSimulationAt,
      finishingSimulationExample(game).initialPosition
    );
    const seen = await s.until((world) => customGameView(world, 'alice'), {
      pred: (view) => view.current?.status === 'completed',
    });
    expect(seen.current?.status).toBe('completed');
  },
  120_000
);
