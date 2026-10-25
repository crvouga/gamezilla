import type { CustomGame } from './custom-game-state';

/** Whether nobody but `game`'s creator plays it: the creator and bots. */
export function creatorAloneInCustomGame(game: CustomGame): boolean {
  return game.sides.every(
    (side) => game[side].person === '' || game[side].person === game.creator
  );
}
