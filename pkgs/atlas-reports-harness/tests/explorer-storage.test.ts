import { expect, test } from 'bun:test';
import type { ReportPart } from '@crvouga/atlas/reports/explorer-types';
import { listExplorerVersions } from '@crvouga/atlas/reports/explorer-versions';
import { closeCommit, openCommit } from '@crvouga/atlas/reports/publish';
import {
  latestParts,
  partStatus,
  publishPart,
  readParts,
} from '@crvouga/atlas/reports/report-parts';
import { sourcePart } from '@crvouga/atlas/reports/source-part';
import {
  publishInventory,
  readInventory,
  readSpecDocument,
} from '@crvouga/atlas/reports/spec-inventory';
import { ObjectStoreImplInMemory } from '@pkgs/object-store-root-shared/impl-in-memory';
import { assertProperty } from '@pkgs/property-shared/assert-property';
import fc from 'fast-check';

const SHA = '1'.repeat(40);
const OTHER = '2'.repeat(40);

test('producer failure dominates any collection of recorded check outcomes', async () => {
  await assertProperty(
    'failed producer preserves a failed part',
    fc.property(
      fc.array(fc.constantFrom('passed', 'failed', 'running', 'not-run'), {
        maxLength: 20,
      }),
      (statuses) => {
        const result = sourcePart(SHA, {
          source: 'quality--all',
          packageDir: 'pkgs/counter',
          bucket: 'ui-quality',
          status: 'failed',
          updatedAtMs: 10,
          tests: [],
          evidence: [
            {
              kind: 'ui-quality',
              title: 'Quality',
              checks: statuses.map((status, index) => ({
                id: String(index),
                title: 'Recorded check',
                status,
                detail: '',
                measurements: [],
              })),
            },
          ],
        });
        expect(partStatus(result)).toBe('failed');
        expect(
          result.checks.slice(0, statuses.length).map((check) => check.status)
        ).toEqual(statuses);
      }
    )
  );
});

test('a failed producer cannot become passing evidence from its completed checks', () => {
  // regression: report-failed-producer-pass
  const result = sourcePart(SHA, {
    source: 'quality--all',
    packageDir: 'pkgs/counter',
    bucket: 'ui-quality',
    status: 'failed',
    updatedAtMs: 10,
    tests: [],
    evidence: [
      {
        kind: 'ui-quality',
        title: 'Quality',
        checks: [
          {
            id: 'completed',
            title: 'Completed check',
            status: 'passed',
            detail: '',
            measurements: [{ name: 'Quality', value: 8.5, unit: 'score' }],
          },
        ],
      },
    ],
  });
  expect(partStatus(result)).toBe('failed');
  expect(result.checks[0]?.measurements[0]?.value).toBe(8.5);
  expect(result.checks.some((check) => check.status === 'passed')).toBe(true);
});
function part(
  id: string,
  time: number,
  status: 'passed' | 'failed'
): ReportPart {
  return {
    sha: SHA,
    id,
    kind: 'ui-quality',
    title: id,
    recordedAtMs: time,
    checks: [
      {
        id: 'quality',
        title: 'Quality',
        detail: '',
        status,
        measurements: [{ name: 'Quality', value: 8, unit: 'score' }],
      },
    ],
  };
}

test('every indexed spec retains its literal content and commit', async () => {
  await assertProperty(
    'spec contents round trip',
    fc.asyncProperty(fc.string(), async (content) => {
      const store = new ObjectStoreImplInMemory();
      await publishInventory(store, {
        sha: SHA,
        documents: [
          { path: 'specs/counter/INVARIANTS.md', content },
          { path: 'specs/counter/safety.qnt', content: 'module safety {}' },
        ],
      });
      expect((await readInventory(store, SHA))?.entries).toHaveLength(2);
      expect(
        await readSpecDocument(store, SHA, 'specs/counter/INVARIANTS.md')
      ).toBe(content);
      expect(
        await readSpecDocument(store, OTHER, 'specs/counter/INVARIANTS.md')
      ).toBeNull();
      expect(
        await readSpecDocument(store, SHA, 'specs/counter/../../secret')
      ).toBeNull();
    })
  );
});

test('independent parts aggregate by producer and never across versions', async () => {
  const store = new ObjectStoreImplInMemory();
  await Promise.all([
    publishPart(store, part('quality', 10, 'passed')),
    publishPart(store, {
      ...part('performance', 12, 'failed'),
      kind: 'performance',
    }),
    publishPart(store, { ...part('quality', 20, 'failed'), sha: OTHER }),
  ]);
  expect((await readParts(store, SHA)).map((part) => part.id)).toEqual([
    'performance',
    'quality',
  ]);
  expect((await readParts(store, OTHER))[0]?.checks[0]?.status).toBe('failed');
  expect(await listExplorerVersions(store)).toEqual([SHA, OTHER]);
});

// regression: report-part-concurrent-overwrite
test('same-millisecond producers cannot overwrite a failed result with a pass', async () => {
  const store = new ObjectStoreImplInMemory();
  const failed = part('quality', 12, 'failed');
  const passed = part('quality', 12, 'passed');
  await publishPart(store, failed);
  await publishPart(store, passed);
  expect((await readParts(store, SHA))[0]).toEqual(failed);
  expect(latestParts([passed, failed])).toEqual(latestParts([failed, passed]));
  expect((await store.listKeys(`commits/${SHA}/parts/`)).length).toBe(2);
});

test('aggregation is independent of producer arrival order', () => {
  assertProperty(
    'arrival order does not change latest evidence',
    fc.property(
      fc.array(
        fc.record({
          time: fc.integer({ min: 0, max: 99 }),
          failed: fc.boolean(),
        }),
        { minLength: 1, maxLength: 30 }
      ),
      (inputs) => {
        const parts = inputs.map((input) =>
          part('quality', input.time, input.failed ? 'failed' : 'passed')
        );
        expect(latestParts(parts)).toEqual(latestParts([...parts].reverse()));
        expect(latestParts(parts)[0]?.recordedAtMs).toBe(
          Math.max(...inputs.map((input) => input.time))
        );
      }
    )
  );
});

// regression: report-empty-success
test('an empty completed run and an empty part carry no passing evidence', async () => {
  const store = new ObjectStoreImplInMemory();
  await openCommit(store, {
    sha: SHA,
    branch: 'example',
    runUrl: null,
    startedAtMs: 0,
    frameCss: '',
  });
  expect((await closeCommit(store, { sha: SHA, endedAtMs: 1 })).status).toBe(
    'skipped'
  );
  expect(partStatus({ ...part('quality', 1, 'passed'), checks: [] })).toBe(
    'not-run'
  );
});
