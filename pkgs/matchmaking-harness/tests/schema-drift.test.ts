/**
 * Schema-drift contract: once the example app is remigrated under another
 * schema version, a replica still on the old one refuses to join with the
 * public MatchmakingSchemaDriftError.
 */

import { Database } from 'bun:sqlite';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import {
  type MatchmakingSchema,
  MatchmakingSchemaDriftError,
} from '@pkgs/matchmaking/interface';
import {
  exampleAppSchema,
  RatingAttr,
  ratingWithin,
  registerTestCrashHandler,
} from '@pkgs/matchmaking-harness';
import { MatchmakingImplSql } from '@pkgs/matchmaking-sql';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client-sqlite/impl-bun-sqlite';
import { createHarnessAdapters } from '@pkgs/uuid';

async function bootExampleApp(
  sqlClient: SqlClient,
  schema: MatchmakingSchema
): Promise<MatchmakingImplSql> {
  const adapters = createHarnessAdapters({ seed: 1 });
  const mm = new MatchmakingImplSql({
    sqlClient,
    schema,
    tuning: { now: adapters.clock.now, createId: adapters.createId },
  });
  await mm.ready();
  return mm;
}

describe('MatchmakingImplSql - schema drift', () => {
  let dispose: () => void;
  beforeAll(() => {
    dispose = registerTestCrashHandler();
  });
  afterAll(() => {
    dispose();
  });

  // regression: matchmaking-schema-change-loses-accepted-wait
  test('a conflicting schema refuses to replace accepted waiting state', async () => {
    const db = new Database(':memory:');
    const sqlClient = new SqlClientImplBunSqlite(db);
    try {
      const original = await bootExampleApp(
        sqlClient,
        exampleAppSchema({ partitionBy: 'region' })
      );
      const result = await original.join({
        ownerId: 'alice',
        requestId: 'begin-1',
        data: { ...RatingAttr(1500) },
        formulas: [ratingWithin(50)],
      });
      await expect(
        bootExampleApp(sqlClient, exampleAppSchema({ partitionBy: 'mode' }))
      ).rejects.toBeInstanceOf(MatchmakingSchemaDriftError);
      expect(
        (await original.status('alice', result.participantId!))?.status
      ).toBe('waiting');
    } finally {
      db.close(false);
    }
  });

  test('join throws MatchmakingSchemaDriftError after remigrate with new schema', async () => {
    const db = new Database(':memory:');
    const sqlClient = new SqlClientImplBunSqlite(db);
    try {
      const byRegion = await bootExampleApp(
        sqlClient,
        exampleAppSchema({ partitionBy: 'region' })
      );
      await bootExampleApp(
        sqlClient,
        exampleAppSchema({ partitionBy: 'mode' })
      );
      await expect(
        byRegion.join({
          ownerId: 'alice',
          requestId: 'begin-1',
          data: { ...RatingAttr(1500) },
          formulas: [ratingWithin(50)],
        })
      ).rejects.toBeInstanceOf(MatchmakingSchemaDriftError);
      // regression: matchmaking-schema-drift-second-attempt
      await expect(
        byRegion.join({
          ownerId: 'alice',
          requestId: 'begin-1',
          data: { ...RatingAttr(1500) },
          formulas: [ratingWithin(50)],
        })
      ).rejects.toBeInstanceOf(MatchmakingSchemaDriftError);
    } finally {
      db.close(false);
    }
  });
});
