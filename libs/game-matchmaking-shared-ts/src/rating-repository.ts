import type { SqlTx } from '@pkgs/sql-client-root-shared-ts/interface';
import sql, { join } from '@pkgs/sql-root-shared-ts/sql';
import type { MultiplayerRating } from './multiplayer-rating';
import { NEW_MULTIPLAYER_RATING } from './multiplayer-rating';
import type { MultiplayerRatingPool } from './time-control';

type RatingRow = {
  readonly rating: number | null;
  readonly rating_deviation: number | null;
  readonly volatility_micros: number | null;
  readonly games: number | null;
};

export function multiplayerRatingId(
  ownerId: string,
  speed: MultiplayerRatingPool
): string {
  return JSON.stringify([ownerId, speed]);
}

export class MultiplayerRatingRepository {
  constructor(private readonly tx: SqlTx) {}

  async readMany(
    ownerIds: readonly string[],
    speed: MultiplayerRatingPool
  ): Promise<ReadonlyMap<string, MultiplayerRating>> {
    const owners = [...new Set(ownerIds)];
    if (owners.length === 0) return new Map();
    const rows = await this.tx.query(sql<
      RatingRow & { owner_id: string }
    >`SELECT owner_id,
      rating, rating_deviation, volatility_micros, games FROM chess_multiplayer_ratings
      WHERE owner_id IN (${join(owners)}) AND speed = ${speed} AND deleted_at IS NULL`);
    const byOwner = new Map(rows.map((row) => [row.owner_id, row]));
    return new Map(
      owners.map((ownerId) => [ownerId, ratingOf(byOwner.get(ownerId))])
    );
  }

  async read(
    ownerId: string,
    speed: MultiplayerRatingPool
  ): Promise<MultiplayerRating> {
    const rows = await this.tx.query(sql<RatingRow>`SELECT rating,
      rating_deviation, volatility_micros, games FROM chess_multiplayer_ratings
      WHERE owner_id = ${ownerId} AND speed = ${speed} AND deleted_at IS NULL`);
    return ratingOf(rows[0]);
  }

  async write(
    ownerId: string,
    speed: MultiplayerRatingPool,
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

function ratingOf(row: RatingRow | undefined): MultiplayerRating {
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
