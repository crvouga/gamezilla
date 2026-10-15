import type { SqlTx } from '@pkgs/sql-client-root-shared/interface';
import type { MultiplayerGame } from './game-state';
import { isFinished } from './game-state';
import { rateMultiplayerGame } from './multiplayer-rating';
import { MultiplayerRatingRepository } from './rating-repository';
import { timeControlOf } from './time-control';

/**
 * A game that just finished with a win or a draw moves both people's rating
 * for its speed once; an aborted game moves none. Returns the game with the
 * rating changes both people see.
 */
export async function rateFinishedGame(
  tx: SqlTx,
  game: MultiplayerGame,
  nowMs: number
): Promise<MultiplayerGame> {
  const control = timeControlOf(game.time_control);
  if (control === null || !isFinished(game.outcome)) return game;
  const ratings = new MultiplayerRatingRepository(tx);
  const white = await ratings.read(game.white_id, control.speed);
  const black = await ratings.read(game.black_id, control.speed);
  const whiteScore =
    game.outcome === 'white' ? 1 : game.outcome === 'draw' ? 0.5 : 0;
  const nextWhite = rateMultiplayerGame(white, black, whiteScore);
  const nextBlack = rateMultiplayerGame(
    black,
    white,
    (1 - whiteScore) as 0 | 0.5 | 1
  );
  await ratings.write(game.white_id, control.speed, nextWhite, nowMs);
  await ratings.write(game.black_id, control.speed, nextBlack, nowMs);
  return {
    ...game,
    white_rating_diff: nextWhite.rating - white.rating,
    black_rating_diff: nextBlack.rating - black.rating,
  };
}
