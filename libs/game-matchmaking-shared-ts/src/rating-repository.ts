import type { SqlTx } from '@pkgs/sql-client-root-shared-ts/interface';
import sql from '@pkgs/sql-root-shared-ts/sql';
import type { MultiplayerRating } from './multiplayer-rating';
import { NEW_MULTIPLAYER_RATING } from './multiplayer-rating';
import type { MultiplayerSpeed } from './time-control';

type RatingRow = {
  readonly rating: number | null;
  readonly rating_deviation: number | null;
  readonly volatility_micros: number | null;
  readonly games: number | null;
};

export function multiplayerRatingId(
  ownerId: string,
  speed: MultiplayerSpeed
): string {
  return JSON.stringify([ownerId, speed]);
}

export class MultiplayerRatingRepository {
  constructor(private readonly tx: SqlTx) {}

  async read(
    ownerId: string,
    speed: MultiplayerSpeed
  ): Promise<MultiplayerRating> {
    const rows = await this.tx.query(sql<RatingRow>`SELECT rating,
      rating_deviation, volatility_micros, games FROM chess_multiplayer_ratings
      WHERE owner_id = ${ownerId} AND speed = ${speed} AND deleted_at IS NULL`);
    const row = rows[0];
    if (row === undefined) return NEW_MULTIPLAYER_RATING;
    return {
      rating: Number(row.rating ?? NEW_MULTIPLAYER_RATING.rating),
      ratingDeviation: Number(
        row.rating_deviation ?? NEW_MULTIPLAYER_RATING.ratingDeviation
      ),
      volatilityMicros: Number(
        row.volatility_micros ?? NEW_MULTIPLAYER_RATING.volatilityMicros
      ),
      games: Number(row.games ?? 0),
    };
  }

  async write(
    ownerId: string,
    speed: MultiplayerSpeed,
    rating: MultiplayerRating,
    nowMs: number
  ): Promise<void> {
    const iso = new Date(nowMs).toISOString();
    await this.tx.run(sql`INSERT INTO chess_multiplayer_ratings
      (id, owner_id, speed, rating, rating_deviation, volatility_micros, games, created_at, updated_at, deleted_at)
      VALUES (${multiplayerRatingId(ownerId, speed)}, ${ownerId}, ${speed}, ${rating.rating},
        ${rating.ratingDeviation}, ${rating.volatilityMicros}, ${rating.games}, ${iso}, ${iso}, ${null})
      ON CONFLICT (id) DO UPDATE SET rating = excluded.rating,
        rating_deviation = excluded.rating_deviation, volatility_micros = excluded.volatility_micros,
        games = excluded.games, updated_at = excluded.updated_at, deleted_at = excluded.deleted_at`);
  }
}
