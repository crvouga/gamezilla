/**
 * Properties of the topic-map projection helpers: wake topics derived from a
 * write capture / held rows are deduped, code-unit sorted, independent of
 * capture order, and equal a straightforward set-union oracle.
 */
import { describe, expect, test } from 'bun:test';
import { assertProperty } from '@pkgs/property-shared/assert-property';
import fc from 'fast-check';
import { defineTopicMap, subscribeTables, topicsFromHeldRows, topicsFromWriteCapture } from '@pkgs/sync-engine-shared/topic-map';
import { filterPublishableImages } from '@pkgs/sync-engine-shared/row-image-guard';
import type { TopicMap, TopicMapCtx, TopicMapEntry } from '@pkgs/sync-engine-shared/topic-map';

type Capture = Parameters<typeof topicsFromWriteCapture>[0]['capture'];
type Row = Record<string, unknown>;

const TABLES = ['notes', 'folders', 'tags', 'spaces', 'extra'] as const;
const TOPIC_POOL = ['a', 'b', 'c', 'room:1', 'room:2', 'user:x', 'Z', '_'];

const CTX: TopicMapCtx = {
  actorId: 'actor',
  deviceId: 'device',
  accountId: null,
  isAnon: false,
};

const arbTopics = fc.array(fc.constantFrom(...TOPIC_POOL), { maxLength: 4 });

/** Rows carry their own topic lists so entries are pure functions of the row. */
const arbRow: fc.Arbitrary<Row> = fc.record({
  id: fc.constantFrom('r1', 'r2', 'r3', 'r4'),
  t: arbTopics,
  s: arbTopics,
  pub: fc.boolean(),
});

const rowTopics = (row: Row, key: 't' | 's'): readonly string[] =>
  row[key] as readonly string[];

type EntrySpec = {
  readonly fallback: readonly string[] | null;
  readonly subscribe: boolean;
  readonly publishGuard: boolean;
};

const arbEntrySpec: fc.Arbitrary<EntrySpec> = fc.record({
  fallback: fc.option(arbTopics, { nil: null }),
  subscribe: fc.boolean(),
  publishGuard: fc.boolean(),
});

const arbSpecs = fc.dictionary(fc.constantFrom(...TABLES), arbEntrySpec, {
  maxKeys: TABLES.length,
});

function buildEntry(spec: EntrySpec): TopicMapEntry {
  return {
    topics: (row) => rowTopics(row, 't'),
    ...(spec.fallback === null
      ? {}
      : { fallbackTopics: () => spec.fallback ?? [] }),
    ...(spec.subscribe
      ? { subscribeTopics: (row: Row) => rowTopics(row, 's') }
      : {}),
    ...(spec.publishGuard
      ? { rowImage: { publish: (row: Row) => row['pub'] === true } }
      : {}),
  };
}

function buildMap(specs: Readonly<Record<string, EntrySpec>>): TopicMap {
  const map: Record<string, TopicMapEntry> = {};
  for (const [table, spec] of Object.entries(specs)) {
    map[table] = buildEntry(spec);
  }
  return defineTopicMap(map);
}

const arbImages = fc.dictionary(
  fc.constantFrom(...TABLES),
  fc.array(arbRow, { maxLength: 4 }),
  { maxKeys: TABLES.length }
);

const arbCapture: fc.Arbitrary<Capture> = fc
  .record({
    tables: fc.uniqueArray(fc.constantFrom(...TABLES), {
      maxLength: TABLES.length,
    }),
    images: arbImages,
  })
  .map(({ tables, images }) => ({ tables, ids: {}, images }));

const codeUnitSorted = (xs: readonly string[]): string[] =>
  [...xs].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

const sortedSet = (xs: Iterable<string>): string[] =>
  codeUnitSorted([...new Set(xs)]);

function captureOracle(
  specs: Readonly<Record<string, EntrySpec>>,
  capture: Capture
): string[] {
  const all: string[] = [];
  for (const table of capture.tables) {
    const spec = specs[table];
    if (spec === undefined) continue;
    const images = capture.images[table] ?? [];
    if (images.length > 0) {
      for (const row of images) all.push(...rowTopics(row, 't'));
    } else if (spec.fallback !== null) {
      all.push(...spec.fallback);
    }
  }
  return sortedSet(all);
}

function reversedCapture(capture: Capture): Capture {
  const images: Record<string, readonly Row[]> = {};
  for (const [table, rows] of Object.entries(capture.images)) {
    images[table] = [...rows].reverse();
  }
  return { tables: [...capture.tables].reverse(), ids: {}, images };
}

describe('topicsFromWriteCapture', () => {
  test('equals the sorted set-union oracle, order-independent and idempotent', async () => {
    await assertProperty(
      'topicsFromWriteCapture oracle',
      fc.asyncProperty(arbSpecs, arbCapture, async (specs, capture) => {
        const topicMap = buildMap(specs);
        const first = await topicsFromWriteCapture({
          topicMap,
          capture,
          ctx: CTX,
        });
        expect(first).toEqual(captureOracle(specs, capture));
        expect(new Set(first).size).toBe(first.length);
        expect(first).toEqual(codeUnitSorted(first));
        const again = await topicsFromWriteCapture({
          topicMap,
          capture,
          ctx: CTX,
        });
        expect(again).toEqual(first);
        const reordered = await topicsFromWriteCapture({
          topicMap,
          capture: reversedCapture(capture),
          ctx: CTX,
        });
        expect(reordered).toEqual(first);
      })
    );
  });
});

describe('topicsFromHeldRows', () => {
  test('entry topics ∪ subscribe projections of opted-in tables, sorted + deduped', () => {
    assertProperty(
      'topicsFromHeldRows oracle',
      fc.property(arbSpecs, arbImages, arbTopics, (specs, held, entry) => {
        const topicMap = buildMap(specs);
        const out = topicsFromHeldRows({
          topicMap,
          liveRowsByTable: held,
          entryTopics: entry,
          ctx: CTX,
        });
        const expected: string[] = [...entry];
        for (const [table, rows] of Object.entries(held)) {
          if (specs[table]?.subscribe !== true) continue;
          for (const row of rows) expected.push(...rowTopics(row, 's'));
        }
        expect(out).toEqual(sortedSet(expected));
        for (const t of entry) expect(out).toContain(t);
      })
    );
  });
});

describe('subscribeTables', () => {
  test('is exactly the tables whose entry defines subscribeTopics', () => {
    assertProperty(
      'subscribeTables oracle',
      fc.property(arbSpecs, (specs) => {
        const got = [...subscribeTables(buildMap(specs))].sort();
        const want = Object.entries(specs)
          .filter(([, spec]) => spec.subscribe)
          .map(([table]) => table)
          .sort();
        expect(got).toEqual(want);
      })
    );
  });
});

function nonEmpty(
  images: Readonly<Record<string, readonly Row[]>>
): Record<string, readonly Row[]> {
  return Object.fromEntries(
    Object.entries(images).filter(([, rows]) => rows.length > 0)
  );
}

describe('filterPublishableImages', () => {
  test('drops vetoed rows (and emptied guarded tables); identity when nothing vetoed', () => {
    assertProperty(
      'filterPublishableImages oracle',
      fc.property(arbSpecs, arbImages, (specs, images) => {
        const topicMap = buildMap(specs);
        const out = filterPublishableImages(images, topicMap, CTX);
        const expected: Record<string, readonly Row[]> = {};
        let vetoed = false;
        for (const [table, rows] of Object.entries(images)) {
          if (specs[table]?.publishGuard !== true) {
            expected[table] = rows;
            continue;
          }
          const kept = rows.filter((row) => row['pub'] === true);
          if (kept.length !== rows.length) vetoed = true;
          if (kept.length > 0) expected[table] = kept;
        }
        // An empty table carries no images, so its presence is not observable.
        expect(nonEmpty(out)).toEqual(nonEmpty(expected));
        if (!vetoed) expect(out).toBe(images);
        expect(filterPublishableImages(images, undefined, CTX)).toBe(images);
        // Filtering is idempotent: a second pass vetoes nothing.
        expect(filterPublishableImages(out, topicMap, CTX)).toBe(out);
      })
    );
  });
});
