import { createTurnGames } from '@pkgs/turn-game-shared/game-rules';
import type { GameDefinition, SharedGameModule } from './game';
/**
 * The registered games and, once each, the shared modules they are played
 * through, bound to the rules of every registered turn game.
 */
export function gameModules(
  games: readonly GameDefinition[]
): readonly GameDefinition[] {
  const rules = createTurnGames(
    games.flatMap((game) =>
      game.turnGame === undefined ? [] : [game.turnGame]
    )
  );
  const shared = new Map<string, SharedGameModule>();
  for (const game of games)
    for (const module of game.sharedModules ?? []) {
      const previous = shared.get(module.id);
      if (previous !== undefined && previous !== module)
        throw new Error(`Conflicting shared game module: ${module.id}`);
      shared.set(module.id, module);
    }
  return [
    ...games,
    ...[...shared.values()].map((module) => module.bind(rules)),
  ];
}
