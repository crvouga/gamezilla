/**
 * Schema-drift fault: remigrate with a new schema makes join throw the
 * public MatchmakingSchemaDriftError.
 */

import { Database } from 'bun:sqlite';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { MatchmakingSchemaDriftError } from '@pkgs/matchmaking/interface';
import {
  RatingAttr,
  registerTestCrashHandler,
} from '@pkgs/matchmaking-harness';
import { MatchmakingImplSql } from '@pkgs/matchmaking-sql';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client-sqlite/impl-bun-sqlite';
import { createHarnessAdapters } from '@pkgs/uuid';

describe('MatchmakingImplSql - schema drift', () => {
  let dispose: () => void;
  beforeAll(() => {
    dispose = registerTestCrashHandler();
  });
  afterAll(() => {
    dispose();
  });

  test('join throws MatchmakingSchemaDriftError after remigrate with new schema', async () => {
    const db = new Database(':memory:');
    const sqlClient = new SqlClientImplBunSqlite(db);
    const harness = createHarnessAdapters({ seed: 1 });
    try {
      const mm = new MatchmakingImplSql({
        sqlClient,
        schema: { partitionKeys: ['mmtest/region'] },
        tuning: { now: harness.clock.now, createId: harness.createId },
      });
      await mm.ready();

      const mm2 = new MatchmakingImplSql({
        sqlClient,
        schema: { partitionKeys: ['mmtest/mode'] },
        tuning: { now: harness.clock.now, createId: harness.createId },
      });
      await mm2.ready();
      await expect(
        mm.join({
          data: { ...RatingAttr(1500) },
          formulas: [{ numeric: [{ tag: RatingAttr, weight: 1 }] }],
        })
      ).rejects.toBeInstanceOf(MatchmakingSchemaDriftError);
    } finally {
      db.close(false);
    }
  });
});
