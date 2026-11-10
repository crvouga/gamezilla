/**
 * Synthetic Populations a scenario starts from, built the fastest honest
 * way: the fixtures every scenario uses, then state written as the
 * Synthetic Population itself would have written it.
 */
import { scenarioAction } from '@libs/harness-ts/actor-ui';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { notifyChannels } from '@pkgs/sync-engine-server-ts/notify-channels';
import { prepareSyntheticMatch } from './synthetic-match-fixtures';
import { completeSyntheticGame } from './synthetic-population-control-actions';
import { givenSyntheticUser } from './synthetic-user-fixtures';

/** A Synthetic User, available, then every Synthetic User paused. */
export const givenEverySyntheticUserPaused = scenarioAction({
  name: 'givenEverySyntheticUserPaused',
  act: async (s) => {
    await Promise.resolve(givenSyntheticUser.act(s, 'Cedar', false));
    const db = s.harness.serverSql.sqlClient;
    await db.run(
      sql`UPDATE population_users SET paused = ${true} WHERE deleted_at IS NULL`
    );
    if (s.harness.server.events !== null)
      await notifyChannels({
        pubsub: s.harness.server.events,
        sql: db,
        tables: ['population_users'],
        topics: [],
        now: s.harness.clock.now,
        label: 'synthetic-population-paused-fixture',
      });
  },
});

/** The person has just finished a game of `game` against the Synthetic User Cedar. */
export const givenFinishedGameAgainst = scenarioAction({
  name: 'givenFinishedGameAgainst',
  act: async (s, game: string, name: string) => {
    if (name !== 'Cedar')
      throw new Error(`Only Cedar can have played a person, not ${name}`);
    await prepareSyntheticMatch(s, game);
    await Promise.resolve(completeSyntheticGame.act(s));
  },
});
