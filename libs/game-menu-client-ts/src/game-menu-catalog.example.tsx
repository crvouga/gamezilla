import type { GameClientRegistration } from './game-client';

/** Supplied by the product catalog loader, which owns the concrete games. */
export class StoryGameCatalog {
  constructor(readonly games: readonly GameClientRegistration[]) {}
}

export function storyGame(
  loaded: Record<string, unknown>,
  choice: { id: string } | { tile: GameClientRegistration['motif'] }
) {
  const catalog = loaded['catalogGames'];
  if (!(catalog instanceof StoryGameCatalog))
    throw new Error('The game menu story requires its catalog loader');
  const game = catalog.games.find((entry) =>
    'id' in choice ? entry.id === choice.id : entry.motif === choice.tile
  );
  if (!game)
    throw new Error(
      'Unknown catalog game: ' + ('id' in choice ? choice.id : choice.tile)
    );
  return game;
}
