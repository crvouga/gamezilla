import { expect, test } from 'bun:test';
import { publishSource, SPEC_RUN_ID } from '@crvouga/atlas-reports/publish';
import {
  listSourceRecords,
  readFrameBody,
  readTestReport,
  testEvents,
} from '@crvouga/atlas-reports/read';
import type { HtmlReportBlob } from '@crvouga/atlas-reports/recording-bundle';
import {
  reportGeneration,
  reuseSource,
  sourceContentPrefix,
} from '@crvouga/atlas-reports/source-content';
import { sourcePart } from '@crvouga/atlas-reports/source-part';
import { writeUtf8 } from '@pkgs/object-store-root-shared/helpers';
import { ObjectStoreImplInMemory } from '@pkgs/object-store-root-shared/impl-in-memory';
import { assertProperty } from '@pkgs/property-shared/assert-property';
import fc from 'fast-check';
import { exampleApp, put } from './example-app';

const SHA = 'a'.repeat(40);
const NEXT_SHA = 'b'.repeat(40);
const identity = { taskHash: '0123456789abcdef', generation: 12 };
const source = 'libs-example--part-0';
const args = {
  sha: SHA,
  packageDir: 'libs/example',
  bucket: 'part-0',
  identity,
};

test('reused producer evidence preserves quality measurements for the next commit', async () => {
  const remote = new ObjectStoreImplInMemory();
  const local = await localBucket();
  await writeUtf8(
    local,
    'part.json',
    JSON.stringify({
      kind: 'ui-quality',
      title: 'Quality',
      checks: [
        {
          id: 'put',
          title: 'Counter UI',
          status: 'passed',
          detail: 'Readable',
          measurements: [
            { name: 'Quality', value: 8.5, unit: 'score', limit: 7 },
          ],
        },
      ],
    })
  );
  await publishSource(remote, { ...args, local });
  const reused = await reuseSource(remote, { ...args, sha: NEXT_SHA });
  expect(reused).not.toBeNull();
  const part = sourcePart(NEXT_SHA, reused!);
  expect(part.sha).toBe(NEXT_SHA);
  expect(part.checks[0]?.measurements[0]?.value).toBe(8.5);
  expect(part.checks[0]?.id).toBe(`${source}/put`);
});

class TrackingStore extends ObjectStoreImplInMemory {
  readonly writes: string[] = [];
  readonly reads: string[] = [];
  override get(key: string) {
    this.reads.push(key);
    return super.get(key);
  }
  override async put(
    key: string,
    bytes: Uint8Array,
    contentType: string
  ): Promise<void> {
    this.writes.push(key);
    await super.put(key, bytes, contentType);
  }
}

async function localBucket(value = 'hello'): Promise<ObjectStoreImplInMemory> {
  const local = new ObjectStoreImplInMemory();
  await using session = await exampleApp().run({
    seed: 3,
    report: {
      store: local,
      runId: SPEC_RUN_ID,
      testId: 'put',
      title: 'puts a value',
      now: () => 5000,
    },
  });
  await session.apply(put, 'x', value);
  return local;
}

test('an exact hash reuses every snapshot with one metadata write', async () => {
  const remote = new TrackingStore();
  const record = await publishSource(remote, {
    ...args,
    local: await localBucket(),
  });
  const before = remote.writes.length;
  expect(await reuseSource(remote, { ...args, sha: NEXT_SHA })).toEqual(record);
  expect(remote.writes.slice(before)).toEqual([
    `commits/${NEXT_SHA}/sources/${source}.json`,
  ]);
  for (const key of await remote.listKeys(`commits/${SHA}/`))
    await remote.delete(key);
  const ref = { sha: NEXT_SHA, source, testId: 'put' };
  expect((await readTestReport(remote, ref))?.meta.title).toBe('puts a value');
  expect(await listSourceRecords(remote, NEXT_SHA)).toEqual([record!]);
  const events = [];
  for await (const event of testEvents(remote, ref)) events.push(event);
  const html = events.find(
    (event) => event.type === 'blob' && event.file.endsWith('.html')
  );
  expect(html?.type === 'blob' ? html.blob.text : null).toContain('hello');
  const frame = events.find((event) => event.type === 'blob');
  expect(frame?.type).toBe('blob');
  const body = await readFrameBody(remote, {
    ...ref,
    file: frame?.type === 'blob' ? frame.file : '',
  });
  expect(body?.bytes.byteLength).toBeGreaterThan(0);
});

test('bundled streaming preserves all media while reading each chunk once', async () => {
  const remote = new TrackingStore();
  const local = await localBucket('λ'.repeat(400_000));
  const originals = (await local.listKeys()).filter((key) =>
    key.includes('/frames/')
  );
  await publishSource(remote, { ...args, local });
  const chunks = remote.writes.filter((key) => key.endsWith('.json.gz'));
  expect(chunks.length).toBeGreaterThan(1);
  expect(chunks.length).toBeLessThan(originals.length);
  const before = remote.reads.length;
  const blobs = new Map<string, HtmlReportBlob>();
  for await (const event of testEvents(remote, {
    sha: SHA,
    source,
    testId: 'put',
  }))
    if (event.type === 'blob') blobs.set(event.file, event.blob);
  const reads = remote.reads
    .slice(before)
    .filter((key) => key.endsWith('.json.gz'));
  expect(reads.sort()).toEqual([...chunks].sort());
  for (const key of originals) {
    const original = await local.get(key);
    const bytes = new Uint8Array(
      await new Response(original!.body).arrayBuffer()
    );
    const file = key.split('/tests/put/')[1]!;
    const blob = blobs.get(file)!;
    expect(blob.contentType).toBe(original!.contentType);
    const decoded =
      blob.text !== undefined
        ? new TextEncoder().encode(blob.text)
        : Uint8Array.from(atob(blob.base64!), (c) => c.charCodeAt(0));
    expect(decoded).toEqual(bytes);
  }
});

test('changed hashes and retention generations cannot reuse a source', async () => {
  const remote = new TrackingStore();
  await publishSource(remote, { ...args, local: await localBucket() });
  const before = remote.writes.length;
  expect(
    await reuseSource(remote, {
      ...args,
      sha: NEXT_SHA,
      identity: { ...identity, taskHash: 'fedcba9876543210' },
    })
  ).toBeNull();
  expect(
    await reuseSource(remote, {
      ...args,
      sha: NEXT_SHA,
      identity: { ...identity, generation: 13 },
    })
  ).toBeNull();
  expect(remote.writes.length).toBe(before);
});

test('failed runner outcomes are visible but never reusable', async () => {
  const remote = new TrackingStore();
  const record = await publishSource(remote, {
    ...args,
    local: await localBucket(),
    status: 'failed',
  });
  expect(record?.status).toBe('failed');
  expect(await reuseSource(remote, { ...args, sha: NEXT_SHA })).toBeNull();
  expect(
    (await readTestReport(remote, { sha: SHA, source, testId: 'put' }))?.meta
      .testId
  ).toBe('put');
});

test('an empty successful part has a reusable completion record', async () => {
  const remote = new TrackingStore();
  const record = await publishSource(remote, {
    ...args,
    local: new ObjectStoreImplInMemory(),
    status: 'passed',
  });
  expect(record?.tests).toEqual([]);
  expect(record?.status).toBe('passed');
  expect(await reuseSource(remote, { ...args, sha: NEXT_SHA })).toEqual(record);
});

// regression: report-missing-snapshot-published-complete
// regression: report-catalog-fixture-missing-snapshots
test('a missing snapshot cannot leave a reusable complete marker', async () => {
  const remote = new TrackingStore();
  const local = await localBucket();
  const file = (await local.listKeys()).find((key) => key.endsWith('.html'))!;
  await local.delete(file);
  await expect(publishSource(remote, { ...args, local })).rejects.toThrow(
    'Missing report snapshot'
  );
  expect(
    await remote.head(`${sourceContentPrefix(identity, source)}complete.json`)
  ).toBe(false);
  expect(await reuseSource(remote, { ...args, sha: NEXT_SHA })).toBeNull();
  expect(await listSourceRecords(remote, SHA)).toEqual([]);
});

test('generation lifetimes cover commits published at the last instant of a generation', () => {
  assertProperty(
    'content survives every reference for its complete retention period',
    fc.property(
      fc.integer({ min: 1, max: 90 }),
      fc.nat({ max: 100 }),
      fc.nat({ max: 86_399_999 }),
      (days, generation, offset) => {
        const retention = days * 86_400_000;
        const start = generation * retention;
        const created = start + offset;
        const reused = start + retention - 1;
        expect(reportGeneration(created, days)).toBe(generation);
        expect(reportGeneration(reused, days)).toBe(generation);
        expect(reportGeneration(reused + 1, days)).toBe(generation + 1);
        expect(created + 2 * retention + 86_400_000).toBeGreaterThan(
          reused + retention
        );
      }
    )
  );
});

test('report identities reject paths, invalid hashes and invalid generations', () => {
  expect(() =>
    sourceContentPrefix({ ...identity, taskHash: '../oops' }, source)
  ).toThrow();
  expect(() =>
    sourceContentPrefix({ ...identity, generation: -1 }, source)
  ).toThrow();
  expect(() => reportGeneration(0, 0)).toThrow();
  expect(() => reportGeneration(-1, 30)).toThrow();
});
