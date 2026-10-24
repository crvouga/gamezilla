import { expect, test } from 'bun:test';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import { partitionFanoutRowsByTopic } from '@pkgs/sync-engine-shared-ts/partition-fanout-rows';
import { filterPublishableImages } from '@pkgs/sync-engine-shared-ts/row-image-guard';
import type {
  TopicMap,
  TopicMapCtx,
} from '@pkgs/sync-engine-shared-ts/topic-map';
import { topicsFromWriteCapture } from '@pkgs/sync-engine-shared-ts/topic-map';
import type { QueryRow } from '@pkgs/sync-engine-shared-ts/v2';
import fc from 'fast-check';

const CTX: TopicMapCtx = {
  actorId: 'alice',
  accountId: 'alice',
  deviceId: 'device',
  isAnon: false,
};
const destinations = (row: QueryRow): readonly string[] =>
  row['topics'] as string[];
const arbRow = fc.record({
  id: fc.constantFrom('same', 'other'),
  topics: fc.array(fc.constantFrom('user:alice', 'user:bob', 'room:shared'), {
    maxLength: 4,
  }),
  publish: fc.boolean(),
  deleted_at: fc.option(fc.constant('2026-10-24'), { nil: null }),
});
const arbRows = fc.dictionary(
  fc.constantFrom('notes', 'folders', 'ignored'),
  fc.array(arbRow, { maxLength: 8 })
);

function topicMap(batch: boolean): TopicMap {
  const entry = {
    topics: destinations,
    ...(batch
      ? { topicsByRow: (rows: readonly QueryRow[]) => rows.map(destinations) }
      : {}),
    rowImage: { publish: (row: QueryRow) => row['publish'] === true },
  };
  return { notes: entry, folders: entry };
}

/** Membership in each row's own destinations, independent of batch grouping. */
function oracle(rows: Readonly<Record<string, readonly QueryRow[]>>) {
  const known = Object.entries(rows).filter(([table]) => table !== 'ignored');
  const topics = [
    ...new Set(known.flatMap(([, values]) => values.flatMap(destinations))),
  ].sort();
  return topics.map((topic): [string, Record<string, QueryRow[]>] => [
    topic,
    Object.fromEntries(
      known.flatMap(([table, values]) => {
        const matching = values.filter((row) =>
          destinations(row).includes(topic)
        );
        return matching.length === 0 ? [] : [[table, matching]];
      })
    ),
  ]);
}

test('batch row routing equals individual destinations through vetoes and repeated ids', async () => {
  await assertProperty(
    'batch row images preserve their exact privacy partition',
    fc.asyncProperty(arbRows, fc.boolean(), async (rows, batch) => {
      const map = topicMap(batch);
      const publishable = filterPublishableImages(rows, map, CTX);
      const actual = await partitionFanoutRowsByTopic({
        topicMap: map,
        rows: publishable,
        ctx: CTX,
      });
      expect(
        [...actual].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      ).toEqual(oracle(publishable));
    })
  );
});

test('a batch keeps earlier and later owners of one id on their own channels', async () => {
  // regression: multiplayer-row-fanout-repeats-owner-lookups
  const previous = {
    id: 'same',
    topics: ['user:alice', 'user:alice'],
    publish: true,
    deleted_at: '2026-10-24',
  };
  const next = {
    id: 'same',
    topics: ['user:bob'],
    publish: true,
    deleted_at: null,
  };
  const secret = { id: 'hidden', topics: ['user:carol'], publish: false };
  let batches = 0;
  const map: TopicMap = {
    notes: {
      topics: () => {
        throw new Error('Batch must replace individual database lookups');
      },
      topicsByRow: (rows) => {
        batches++;
        return rows.map(destinations);
      },
      rowImage: { publish: (row) => row['publish'] === true },
    },
  };
  const rows = filterPublishableImages(
    { notes: [previous, next, secret] },
    map,
    CTX
  );
  const actual = await partitionFanoutRowsByTopic({
    topicMap: map,
    rows,
    ctx: CTX,
  });
  expect(actual.get('user:alice')).toEqual({ notes: [previous] });
  expect(actual.get('user:bob')).toEqual({ notes: [next] });
  expect(actual.has('user:carol')).toBe(false);
  expect(batches).toBe(1);
});

test.each([0, 3])(
  'a batch returning %s results for two rows fails closed',
  async (count) => {
    const rows = [{ id: 'same' }, { id: 'same' }];
    const map: TopicMap = {
      notes: {
        topics: () => ['user:alice'],
        topicsByRow: () => Array.from({ length: count }, () => ['user:alice']),
      },
    };
    await expect(
      partitionFanoutRowsByTopic({
        topicMap: map,
        rows: { notes: rows },
        ctx: CTX,
      })
    ).rejects.toThrow('batch destinations must match the row count');
    await expect(
      topicsFromWriteCapture({
        topicMap: map,
        capture: { tables: ['notes'], ids: {}, images: { notes: rows } },
        ctx: CTX,
      })
    ).rejects.toThrow('batch destinations must match the row count');
  }
);
