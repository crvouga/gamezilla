import { expect, test } from 'bun:test';
import { MULTIPLAYER_TOPIC_MAP } from '@libs/game-matchmaking-shared-ts/topic-map';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client-sqlite-root-server-ts/impl-bun-sqlite';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { partitionFanoutRowsByTopic } from '@pkgs/sync-engine-shared-ts/partition-fanout-rows';
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
          const perRow: (readonly string[])[] = [];
          for (const row of rows) {
            const topics = await MULTIPLAYER_TOPIC_MAP[table].topics(
              row,
              CTX,
              source
            );
            perRow.push(topics);
            for (const topic of topics) expected.add(topic);
          }
          const actual = await topicsFromWriteCapture({
            topicMap: MULTIPLAYER_TOPIC_MAP,
            capture: { tables: [table], ids: {}, images: { [table]: rows } },
            ctx: CTX,
            ...(source === undefined ? {} : { db: source }),
          });
          expect(actual).toEqual([...expected].sort());
          expect(actual).not.toContain('room:ended-room');
          expect(actual).not.toContain('room:deleted-room');
          const partition = await partitionFanoutRowsByTopic({
            topicMap: MULTIPLAYER_TOPIC_MAP,
            rows: { [table]: rows },
            ctx: CTX,
            ...(source === undefined ? {} : { db: source }),
          });
          expect([...partition.keys()].sort()).toEqual([...expected].sort());
          for (const topic of expected)
            expect(partition.get(topic)).toEqual({
              [table]: rows.filter((_row, index) =>
                perRow[index]!.includes(topic)
              ),
            });
        }
      )
    );
  } finally {
    await db.disconnect();
  }
});

test('hosted-space routing reads fresh ownership and closure state on every call', async () => {
  // regression: multiplayer-row-fanout-repeats-owner-lookups
  const db = SqlClientImplBunSqlite.openMemory();
  try {
    await db.run(sql`CREATE TABLE spaces (
      id TEXT PRIMARY KEY, host_member_id TEXT, ended_at TEXT, deleted_at TEXT)`);
    await db.run(sql`INSERT INTO spaces VALUES ('room', 'alice', NULL, NULL)`);
    const rows = {
      chess_multiplayer_players: [
        { id: 'same', owner_id: 'alice' },
        { id: 'same', owner_id: 'bob', deleted_at: '2026-10-24' },
      ],
    };
    const before = await partitionFanoutRowsByTopic({
      topicMap: MULTIPLAYER_TOPIC_MAP,
      rows,
      ctx: CTX,
      db,
    });
    expect(before.get('room:room')).toEqual({
      chess_multiplayer_players: [rows.chess_multiplayer_players[0]!],
    });
    await db.run(
      sql`UPDATE spaces SET host_member_id = 'bob' WHERE id = 'room'`
    );
    const moved = await partitionFanoutRowsByTopic({
      topicMap: MULTIPLAYER_TOPIC_MAP,
      rows,
      ctx: CTX,
      db,
    });
    expect(moved.get('room:room')).toEqual({
      chess_multiplayer_players: [rows.chess_multiplayer_players[1]!],
    });
    await db.run(
      sql`UPDATE spaces SET ended_at = '2026-10-24' WHERE id = 'room'`
    );
    const ended = await partitionFanoutRowsByTopic({
      topicMap: MULTIPLAYER_TOPIC_MAP,
      rows,
      ctx: CTX,
      db,
    });
    expect(ended.has('room:room')).toBe(false);
  } finally {
    await db.disconnect();
  }
});
