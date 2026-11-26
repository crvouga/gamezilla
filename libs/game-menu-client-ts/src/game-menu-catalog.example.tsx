import type { GameClientRegistration } from './game-client';

/** The product preview loader supplies the same registered clients as the app. */
export function storyGame(loaded: Record<string, unknown>, id: string) {
  const games = loaded['catalogGames'] as readonly GameClientRegistration[];
  const game = games.find((entry) => entry.id === id);
  if (!game) throw new Error('Unknown game in the catalog story: ' + id);
  return game;
}
