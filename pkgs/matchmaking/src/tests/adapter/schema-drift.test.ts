/**
 * Schema-drift fault: remigrate with a new schema makes join throw the
 * public MatchmakingSchemaDriftError.
 */

import { Database } from 'bun:sqlite';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { wallIo } from '@pkgs/io';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client/sqlite/impl-bun-sqlite';
import { MatchmakingImplSql } from '../../impl-sql';
import { MatchmakingSchemaDriftError } from '../../interface/errors';
import { RatingAttr, registerTestCrashHandler } from '../fixtures';

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
    try {
      const io = wallIo();
      const mm = new MatchmakingImplSql({
        sqlClient,
        schema: { partitionKeys: ['mmtest/region'] },
        tuning: { now: () => io.clock.now(), createId: () => io.createId() },
      });
      await mm.ready();

      const mm2 = new MatchmakingImplSql({
        sqlClient,
        schema: { partitionKeys: ['mmtest/mode'] },
        tuning: { now: () => io.clock.now(), createId: () => io.createId() },
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
