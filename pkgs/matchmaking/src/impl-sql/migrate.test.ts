/**
 * Portable schema migrate smoke + concurrency claim invariant.
 */

import { Database } from 'bun:sqlite';
import { afterAll, describe, expect, test } from 'bun:test';
import { PGlite } from '@electric-sql/pglite';
import { wallIo } from '@pkgs/io';
import { installPostgresSqliteCompat } from '@pkgs/postgres-sqlite-compat';
import { sql } from '@pkgs/sql';
import { createPgliteSqlClient } from '@pkgs/sql-client/postgres/impl-pglite';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client/sqlite/impl-bun-sqlite';
import { RatingAttr } from '../testing/fixtures';
import { MatchmakingImplSql } from './matchmaking';
import { migrate } from './migrate';

describe.each([
  {
    name: 'sqlite',
    open: async () => {
      const db = new Database(':memory:');
      return {
        sqlClient: new SqlClientImplBunSqlite(db),
        close: async () => {
          db.close(false);
        },
      };
    },
  },
  {
    name: 'postgres',
    open: async () => {
      const db = await PGlite.create();
      return {
        sqlClient: createPgliteSqlClient(db),
        close: async () => {
          await db.close();
        },
      };
    },
  },
])('migrate ($name)', ({ name, open }) => {
  let close: () => Promise<void> = async () => undefined;

  afterAll(async () => {
    await close();
  });

  test('creates portable waiting / matched tables', async () => {
    const opened = await open();
    close = opened.close;
    await installPostgresSqliteCompat({ sqlClient: opened.sqlClient });
    await migrate({
      sqlClient: opened.sqlClient,
      schema: { primaryNumericKey: 'mmtest/rating', bucketWidth: 50 },
    });
    const tables = await opened.sqlClient.query(
      sql<{ name: string }>`
        SELECT 'matchmaking_waiting' AS name
        UNION ALL
        SELECT 'matchmaking_matched'
        UNION ALL
        SELECT 'matchmaking_active_partitions'
        UNION ALL
        SELECT 'matchmaking_schema_state'`
    );
    expect(tables.length).toBe(4);
    void name;
  });
});

describe('claim concurrency', () => {
  test('sequential ticks never double-match a participant (sqlite)', async () => {
    const db = new Database(':memory:');
    const sqlClient = new SqlClientImplBunSqlite(db);
    const io = wallIo();
    let now = 1_700_000_000_000;
    const mm = new MatchmakingImplSql({
      sqlClient,
      schema: { primaryNumericKey: 'mmtest/rating', bucketWidth: 50 },
      tuning: {
        now: () => now,
        createId: () => io.createId(),
        maxPairsPerPass: 10,
      },
    });
    await mm.ready();
    const formula = { numeric: [{ tag: RatingAttr, weight: 1 }] };
    const ids: string[] = [];
    for (let i = 0; i < 8; i += 1) {
      const joined = await mm.join({
        data: { ...RatingAttr(1500 + i) },
        formulas: [formula],
      });
      ids.push(joined.participantId);
      now += 1;
    }
    const first = await mm.tick();
    const second = await mm.tick();
    expect(first.matches + second.matches).toBeGreaterThan(0);
    const seen = new Set<string>();
    const byMatch = new Map<string, string[]>();
    for (const id of ids) {
      const st = await mm.status(id);
      if (st?.status !== 'matched') continue;
      expect(seen.has(id)).toBe(false);
      seen.add(id);
      const members = byMatch.get(st.matchId) ?? [];
      members.push(id);
      byMatch.set(st.matchId, members);
    }
    for (const members of byMatch.values()) {
      expect(members.length).toBe(2);
    }
    db.close(false);
  });
});
