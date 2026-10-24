import { connectCustomSimulation } from '@libs/game-session-client-ts/custom-simulation-session';
import { CustomGamesAttr } from '@libs/game-session-shared-ts/custom-game-state';
import type { GameRegistration } from '@libs/game-session-shared-ts/game-definition';
import { createTurnGames } from '@pkgs/turn-game-shared-ts/game-rules';

/** The production room/epoch/readiness and document lifecycle adapter, with explicit harness ports. */
export function connectSimulationRoomFixture(
  game: GameRegistration,
  options: Omit<Parameters<typeof connectCustomSimulation>[0], 'game' | 'rules'>
) {
  const current = CustomGamesAttr.from(options.room.getSnapshot()).current;
  if (current === null) throw new Error('The simulation room has no game');
  return connectCustomSimulation({
    ...options,
    game: current,
    rules: createTurnGames([game.registration]),
  });
}
