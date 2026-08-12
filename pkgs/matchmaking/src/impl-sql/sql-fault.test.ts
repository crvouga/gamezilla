/**
 * Construction / schema-drift faults against portable SQL backends.
 */

import { Database } from 'bun:sqlite';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { wallIo } from '@pkgs/io';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client/sqlite/impl-bun-sqlite';
import { MatchmakingSchemaDriftError } from '../interface/errors';
import { RatingAttr, registerTestCrashHandler } from '../testing/fixtures';
import { MatchmakingImplSql } from './matchmaking';

function openSqlite() {
  const db = new Database(':memory:');
  return {
    sqlClient: new SqlClientImplBunSqlite(db),
    close: () => {
      db.close(false);
    },
  };
}

describe('MatchmakingImplSql - construction', () => {
  let dispose: () => void;
  beforeAll(() => {
    dispose = registerTestCrashHandler();
  });
  afterAll(() => {
    dispose();
  });

  test('requires sqlClient / schema / tuning', () => {
    const { sqlClient, close } = openSqlite();
    try {
      expect(() => {
        // @ts-expect-error missing required fields
        new MatchmakingImplSql({ sqlClient });
      }).toThrow();
    } finally {
      close();
    }
  });
});

describe('MatchmakingImplSql - schema drift', () => {
  let dispose: () => void;
  beforeAll(() => {
    dispose = registerTestCrashHandler();
  });
  afterAll(() => {
    dispose();
  });

  test('join throws MatchmakingSchemaDriftError after remigrate with new schema', async () => {
    const { sqlClient, close } = openSqlite();
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
      close();
    }
  });
});
