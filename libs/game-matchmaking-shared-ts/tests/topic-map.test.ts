import { expect, test } from 'bun:test';
import { MULTIPLAYER_TOPIC_MAP } from '@libs/game-matchmaking-shared-ts/topic-map';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client-sqlite-root-server-ts/impl-bun-sqlite';
import sql from '@pkgs/sql-root-shared-ts/sql';
import type { TopicMapCtx } from '@pkgs/sync-engine-shared-ts/topic-map';
import { topicsFromWriteCapture } from '@pkgs/sync-engine-shared-ts/topic-map';
import fc from 'fast-check';

const CTX: TopicMapCtx = {
  actorId: 'alice',
  accountId: 'alice',
  deviceId: 'device',
  isAnon: false,
};

const arbOwner = fc.constantFrom('alice', 'bob', 'carol', 'dave', '', null);
const arbRows = fc.array(
  fc.record({
    id: fc.constantFrom('same-row', 'other-row'),
    owner_id: arbOwner,
    white_id: arbOwner,
    black_id: arbOwner,
    red_id: arbOwner,
    blue_id: arbOwner,
  }),
  { maxLength: 8 }
);
const TABLES = [
  'chess_multiplayer_games',
  'chess_multiplayer_players',
  'chess_opponent_searches',
] as const;

test('batched multiplayer routing preserves every row destination and filters closed spaces', async () => {
  const db = SqlClientImplBunSqlite.openMemory();
  try {
    await db.run(sql`CREATE TABLE spaces (
      id TEXT PRIMARY KEY, host_member_id TEXT, ended_at TEXT, deleted_at TEXT)`);
    await db.run(sql`INSERT INTO spaces VALUES
      ('alice-room', 'alice', NULL, NULL),
      ('bob-room', 'bob', NULL, NULL),
      ('carol-room', 'carol', NULL, NULL),
      ('dave-room', 'dave', NULL, NULL),
      ('ended-room', 'bob', '2026-10-01', NULL),
      ('deleted-room', 'carol', NULL, '2026-10-01')`);
    await assertProperty(
      'multiplayer batch routing equals the complete per-row topic union',
      fc.asyncProperty(
        fc.constantFrom(...TABLES),
        arbRows,
        fc.boolean(),
        async (table, rows, online) => {
          const source = online ? db : undefined;
          const expected = new Set<string>();
          for (const row of rows)
            for (const topic of await MULTIPLAYER_TOPIC_MAP[table].topics(
              row,
              CTX,
              source
            ))
              expected.add(topic);
          const actual = await topicsFromWriteCapture({
            topicMap: MULTIPLAYER_TOPIC_MAP,
            capture: { tables: [table], ids: {}, images: { [table]: rows } },
            ctx: CTX,
            ...(source === undefined ? {} : { db: source }),
          });
          expect(actual).toEqual([...expected].sort());
          expect(actual).not.toContain('room:ended-room');
          expect(actual).not.toContain('room:deleted-room');
        }
      )
    );
  } finally {
    await db.disconnect();
  }
});
