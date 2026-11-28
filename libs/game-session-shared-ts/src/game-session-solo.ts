import type { GameSession } from './game-session-state';

/** Whether nobody but `game`'s creator plays it: the creator and bots. */
export function creatorAloneInGameSession(game: GameSession): boolean {
  return game.sides.every(
    (side) => game[side].person === '' || game[side].person === game.creator
  );
}
