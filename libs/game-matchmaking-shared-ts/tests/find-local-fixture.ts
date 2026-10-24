import { findOpponentMutation } from '@libs/game-matchmaking-shared-ts/find-opponent-mutation';
import { MULTIPLAYER_TABLES } from '@libs/game-matchmaking-shared-ts/multiplayer-tables';
import { CASE_NOW_MS } from '@libs/permissions-shared-ts/people';
import {
  mutationEnvFor,
  openConformanceDb,
} from '@libs/permissions-shared-ts/world';
import { spaceUserEntityId } from '@libs/spaces-shared-ts/participation-ids';
import { SPACES_TABLES } from '@libs/spaces-shared-ts/tables';
import { defineTable } from '@pkgs/db-schema-root-shared-ts/define-table';
import {
  matchmakingActivePartitions,
  matchmakingOwners,
  matchmakingRequests,
  matchmakingWaiting,
} from '@pkgs/matchmaking-sql-shared-ts/tables';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { MutationError } from '@pkgs/sync-engine-shared-ts/mutations-types';
import { MULTISEAT_GAMES } from './multiseat-fixture';

const billing = defineTable({
  domain: 'billing',
  name: 'billing_subscriptions',
  columns: {
    account_id: 'text',
    status: 'text',
    current_period_end: 'timestamp',
    cancel_at_period_end: 'boolean',
  },
});

export type FindLocalCase = {
  readonly presence: 'host' | 'guest' | 'absent';
  readonly waiting?: boolean;
  readonly unfinished?: boolean;
  readonly control?: string;
  readonly authoritativeWaiting?: boolean;
};

export async function localFind(input: FindLocalCase) {
  const db = await openConformanceDb([
    ...MULTIPLAYER_TABLES,
    ...SPACES_TABLES,
    billing,
    matchmakingActivePartitions,
    matchmakingOwners,
    matchmakingRequests,
    matchmakingWaiting,
  ]);
  const { serverNow: _serverNow, ...identity } = mutationEnvFor(
    'free account',
    CASE_NOW_MS
  );
  const env = {
    ...identity,
    turnGames: MULTISEAT_GAMES,
    ...(input.authoritativeWaiting ? { serverNow: _serverNow } : {}),
  };
  const statements: string[] = [];
  try {
    const host = input.presence === 'host' ? env.actorId : 'other-owner';
    await db.run(
      sql`INSERT INTO spaces (id, host_id, host_member_id) VALUES ('space', ${host}, ${host})`
    );
    if (input.presence === 'guest')
      await db.run(sql`INSERT INTO spaces_users (id, space_id, user_id, joined)
        VALUES (${spaceUserEntityId('space', env.actorId)}, 'space', ${env.actorId}, ${true})`);
    if (input.waiting)
      await db.run(sql`INSERT INTO chess_opponent_searches (id, owner_id, standing)
        VALUES ('waiting', ${env.actorId}, 'waiting')`);
    if (input.unfinished)
      await db.run(sql`INSERT INTO chess_multiplayer_games (id, white_id, black_id, outcome)
        VALUES ('unfinished', ${env.actorId}, 'opponent', 'ongoing')`);
    if (input.authoritativeWaiting) {
      await db.run(sql`INSERT INTO matchmaking_owners (id, current_id, available)
        VALUES (${env.actorId}, 'accepted-search', ${true})`);
      await db.run(sql`INSERT INTO matchmaking_waiting (id, owner_id)
        VALUES ('accepted-search', ${env.actorId})`);
    }
    let code: string | null = null;
    try {
      await db.transaction(async (tx) =>
        findOpponentMutation.run(
          {
            env,
            tx: {
              query: async (query) => {
                statements.push(query.sql);
                return tx.query(query);
              },
              run: async (query) => {
                statements.push(query.sql);
                return tx.run(query);
              },
            },
          },
          {
            spaceId: 'space',
            requestId: 'literal-find',
            timeControl: input.control ?? 'four-seat-reference/5+0',
          }
        )
      );
    } catch (error) {
      if (!(error instanceof MutationError)) throw error;
      code = error.code;
    }
    return { code, statements };
  } finally {
    await db.disconnect();
  }
}
