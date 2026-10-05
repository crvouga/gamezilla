/**
 * §8 rating fixtures for scenarios: an earlier, settled puzzle rating.
 */

import { scenarioAction } from '@libs/harness/actor-ui';
import { accountIdOf, actorLocalSql } from '@libs/harness/identity';
import sql from '@pkgs/sql-root-shared/sql';

/**
 * Give a signed-in actor an earlier puzzle rating, on the server and in the
 * device's synced copy, as if earlier rated attempts had settled it there.
 */
export const seedPuzzleRating = scenarioAction({
  name: 'seedPuzzleRating',
  act: async (
    s,
    actorId: string,
    state: { rating: number; ratingDeviation: number; volatilityMicros: number }
  ) => {
    const owner = await accountIdOf(s, actorId);
    if (owner === null) throw new Error(`${actorId} is not signed in`);
    const device = actorLocalSql(s, actorId);
    if (device === null) throw new Error(`${actorId} has no device database`);
    const at = new Date(s.harness.clock.now()).toISOString();
    for (const db of [device, s.harness.serverSql.sqlClient]) {
      await db.run(sql`
        INSERT INTO chess_puzzle_profiles (
          id, owner_id, rating, rating_deviation, volatility_micros,
          last_interaction_at, created_at, updated_at, deleted_at
        ) VALUES (
          ${owner}, ${owner}, ${state.rating}, ${state.ratingDeviation},
          ${state.volatilityMicros}, ${at}, ${at}, ${at}, NULL
        )
      `);
    }
  },
});
