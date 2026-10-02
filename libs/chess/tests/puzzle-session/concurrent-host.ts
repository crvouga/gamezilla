import { BILLING_TABLES } from '@libs/billing/public/schema';
import { CHESS_TABLES } from '@libs/chess/public/schema';
import { ratePuzzleAttemptMutation } from '@libs/chess/root/mutations';
import { uniqueTables } from '@libs/permissions/root/conformance/world';
import { registerTables } from '@pkgs/db-schema';
import { reconcilePostgresSchema } from '@pkgs/db-schema-postgres';
import { sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';
import {
  createSyncApp,
  syncEngineServerSchema,
} from '@pkgs/sync-engine/server';
import {
  mutationRegistry,
  SYNC_PROTOCOL_HEADER,
  SYNC_PROTOCOL_VERSION,
} from '@pkgs/sync-engine/shared';
import {
  type ConcurrentDriver,
  openConcurrentPostgres,
} from './concurrent-postgres';

const AT = '2026-10-01T12:00:00.000Z';

/** Force both real transactions to read a profile before either can write it. */
function overlapProfileReads(db: SqlClient): SqlClient {
  let reads = 0;
  let release: () => void = () => undefined;
  const bothRead = new Promise<void>((resolve) => {
    release = resolve;
  });
  return {
    connect: () => db.connect(),
    disconnect: () => db.disconnect(),
    query: (q) => db.query(q),
    run: (q) => db.run(q),
    prepare: (q) => db.prepare(q),
    transaction: (body) =>
      db.transaction((tx) =>
        body({
          connect: () => tx.connect(),
          disconnect: () => Promise.resolve(),
          prepare: (q) => tx.prepare(q),
          run: (q) => tx.run(q),
          transaction: (nested) => nested(tx),
          query: async (q) => {
            const rows = await tx.query(q);
            if (
              reads < 2 &&
              /SELECT rating, rating_deviation, volatility_micros/.test(q.sql)
            ) {
              reads++;
              if (reads === 2) release();
              await bothRead;
            }
            return rows;
          },
        })
      ),
  };
}

export async function openConcurrentHost(driver: ConcurrentDriver) {
  const postgres = await openConcurrentPostgres(driver);
  try {
    const { db, admin, dbScope } = postgres;
    await reconcilePostgresSchema(admin, syncEngineServerSchema, dbScope);
    await reconcilePostgresSchema(
      admin,
      registerTables(uniqueTables([...BILLING_TABLES, ...CHESS_TABLES])),
      dbScope
    );
    await db.run(sql`
    INSERT INTO chess_puzzle_profiles (id, owner_id, rating, rating_deviation,
      volatility_micros, created_at, updated_at, deleted_at)
    VALUES (${'alice'}, ${'alice'}, ${1500}, ${350}, ${60000}, ${AT}, ${AT}, ${null})
  `);
    let id = 0;
    const app = createSyncApp({
      resolveAuth: async () => ({
        actorId: 'alice',
        deviceId: 'phone',
        accountId: 'alice',
        isAnon: false,
      }),
      getSql: () => overlap,
      queries: {},
      mutations: mutationRegistry([ratePuzzleAttemptMutation]),
      now: () => Date.parse(AT),
      createId: () => `server-${++id}`,
    });
    const overlap = overlapProfileReads(db);
    const send = (puzzle: string) =>
      app.request('http://test/mutations', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          [SYNC_PROTOCOL_HEADER]: String(SYNC_PROTOCOL_VERSION),
        },
        body: JSON.stringify({
          mutations: [
            {
              id: `finish-${puzzle}`,
              name: 'ratePuzzleAttempt',
              clientId: `device-${puzzle}`,
              seq: 1,
              createdAt: AT,
              originTraceparent: null,
              args: JSON.stringify({
                ownerId: 'alice',
                attemptKey: `attempt-${puzzle}`,
                solveIdx: 1,
                puzzleId: puzzle,
                puzzleRating: 1500,
                puzzleRatingDeviation: 80,
                outcome: 'solved',
                scorePermille: 1000,
              }),
            },
          ],
        }),
      });
    return {
      db,
      send,
      async [Symbol.asyncDispose]() {
        await postgres[Symbol.asyncDispose]();
      },
    };
  } catch (error) {
    await postgres[Symbol.asyncDispose]();
    throw error;
  }
}
