import type { SqlTx } from '@pkgs/sql-client-root-shared-ts/interface';
import type { MultiplayerGame } from './game-state';
import { isFinished } from './game-state';
import { matchChoiceOf } from './match-choice';
import { rateMultiplayerRound } from './multiplayer-rating';
import { multiplayerOwner, multiplayerSides } from './multiplayer-roster';
import { MultiplayerRatingRepository } from './rating-repository';

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
  const control = matchChoiceOf(game.time_control);
  if (control === null || !isFinished(game.outcome)) return game;
  const ratings = new MultiplayerRatingRepository(tx);
  const sides = multiplayerSides(game);
  const prior = await Promise.all(
    sides.map((side) =>
      ratings.read(multiplayerOwner(game, side), control.ratingPool)
    )
  );
  const deltas: Partial<MultiplayerGame> = {};
  for (const [index, side] of sides.entries()) {
    const player = prior[index]!;
    const results = sides.flatMap((opponent, other) => {
      if (other === index) return [];
      const score =
        game.outcome === 'draw'
          ? 0.5
          : game.outcome === side
            ? 1
            : game.outcome === opponent
              ? 0
              : 0.5;
      return [{ opponent: prior[other]!, score: score as 0 | 0.5 | 1 }];
    });
    const next = rateMultiplayerRound(player, results);
    await ratings.write(
      multiplayerOwner(game, side),
      control.ratingPool,
      next,
      nowMs
    );
    Object.assign(deltas, {
      [`${side}_rating_diff`]: next.rating - player.rating,
    });
  }
  return { ...game, ...deltas };
}
