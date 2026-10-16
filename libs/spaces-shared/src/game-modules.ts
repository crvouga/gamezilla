import { createTurnGames } from '@pkgs/turn-game-shared/game-rules';
import type { GameDefinition, GameRoomCapability } from './game';
/** Install a shared capability once, even when several games use it. */
export function gameModules(
  games: readonly GameDefinition[]
): readonly GameDefinition[] {
  const rules = createTurnGames(
    games.flatMap((game) =>
      game.turnGame === undefined ? [] : [game.turnGame]
    )
  );
  const capabilities = new Map<string, GameRoomCapability>();
  for (const game of games)
    for (const capability of game.roomCapabilities ?? []) {
      const previous = capabilities.get(capability.id);
      if (previous !== undefined && previous !== capability)
        throw new Error(`Conflicting room capability: ${capability.id}`);
      capabilities.set(capability.id, capability);
    }
  return [
    ...games,
    ...[...capabilities.values()].map((capability) => capability.bind(rules)),
  ];
}
