/**
 * SQL-adapter-only fault / schema tests. Not part of the interface contract.
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { PGlite } from '@electric-sql/pglite';
import { sql } from '@pkgs/sql';
import { createPgliteSqlClient } from '@pkgs/sql-client/postgres/impl-pglite';
import { MatchmakingSchemaDriftError } from '../interface/errors';
import {
  defaultTestTuning,
  RatingAttr,
  RegionAttr,
  registerTestCrashHandler,
} from '../testing/fixtures';
import { MatchmakingImplSql } from './matchmaking';

let disposeTestCrashHandler: () => void;
beforeAll(() => {
  disposeTestCrashHandler = registerTestCrashHandler();
});
afterAll(() => {
  disposeTestCrashHandler();
});

describe('MatchmakingImplSql - construction', () => {
  test('rejects missing sqlClient', () => {
    expect(
      () =>
        new MatchmakingImplSql({
          sqlClient: undefined as never,
          schema: {},
          tuning: defaultTestTuning(),
        })
    ).toThrow();
  });
});

describe('MatchmakingImplSql - schema drift', () => {
  test('throws MatchmakingSchemaDriftError when fingerprint mismatches', async () => {
    const db = await PGlite.create();
    const sqlClient = createPgliteSqlClient(db);
    const mm = new MatchmakingImplSql({
      sqlClient,
      schema: { partitionKeys: ['mmtest/region'] },
      tuning: defaultTestTuning(),
    });
    await mm.ready();
    const mm2 = new MatchmakingImplSql({
      sqlClient,
      schema: { partitionKeys: ['mmtest/region'] },
      tuning: defaultTestTuning(),
    });
    await mm2.ready();
    await sqlClient.run(
      sql<void>`
        UPDATE matchmaking_schema_state
           SET schema_fingerprint = ${'{"corrupted":true}'}
         WHERE id = 1`
    );
    await expect(
      mm2.join({
        data: { ...RatingAttr(1000), ...RegionAttr('us-east') },
        formulas: [{ numeric: [{ tag: RatingAttr, weight: 1 }] }],
      })
    ).rejects.toBeInstanceOf(MatchmakingSchemaDriftError);
    await db.close();
  });
});

describe('MatchmakingImplSql - active partitions table', () => {
  test('tracks (signature, groupSize) pairs separately', async () => {
    const db = await PGlite.create();
    const sqlClient = createPgliteSqlClient(db);
    const mm = new MatchmakingImplSql({
      sqlClient,
      schema: { partitionKeys: ['mmtest/region'] },
      tuning: defaultTestTuning(),
    });
    await mm.ready();
    const formula = {
      numeric: [{ tag: RatingAttr, weight: 1 as const }],
    };
    await mm.join({
      data: { ...RatingAttr(1000), ...RegionAttr('us-east') },
      formulas: [formula],
      groupSize: 2,
    });
    await mm.join({
      data: { ...RatingAttr(1010), ...RegionAttr('us-east') },
      formulas: [formula],
      groupSize: 3,
    });
    const rows = await sqlClient.query(
      sql<{
        partition_signature: string;
        group_size: number | string;
      }>`
        SELECT partition_signature, group_size
          FROM matchmaking_active_partitions
         ORDER BY group_size`
    );
    expect(rows).toHaveLength(2);
    await db.close();
  });
});
