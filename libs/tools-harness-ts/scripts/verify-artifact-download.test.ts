import { expect, test } from 'bun:test';
import { mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ObjectStoreImplInMemory } from '@pkgs/object-store-root-shared-ts/impl-in-memory';
import type { ObjectStore } from '@pkgs/object-store-root-shared-ts/interface';
import { removeTree } from '@pkgs/os-server-ts/remove-tree';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';
import { downloadEvidence, transferRunId } from './verify-artifact-download';

const bytes = (text: string) => new TextEncoder().encode(text);

// regression: github-artifact-download-missing-runtime-token
test('shell transfers need only the run and the bucket, and take only the named prefix', async () => {
  const store = new ObjectStoreImplInMemory();
  await store.put(
    '37512663922/verify-evidence-16/evidence-16.tar.gz',
    bytes('e16'),
    'application/gzip'
  );
  await store.put(
    '37512663922/verify-plan/plan.payload',
    bytes('plan'),
    'application/octet-stream'
  );
  await store.put(
    '99/verify-evidence-3/evidence-3.tar.gz',
    bytes('other run'),
    'application/gzip'
  );
  const directory = mkdtempSync(join(tmpdir(), 'verify-transfer-'));
  const seen: string[][] = [];
  try {
    await downloadEvidence({
      prefix: 'verify-evidence-',
      directory,
      runId: transferRunId({ GITHUB_RUN_ID: '37512663922' }),
      store,
      consumer: {
        consume: async (dir) => {
          seen.push(readdirSync(dir).sort());
          expect(readFileSync(join(dir, 'evidence-16.tar.gz'), 'utf8')).toBe(
            'e16'
          );
        },
        release: async (dir) => removeTree(dir, { whenLocked: 'leave' }),
      },
    });
  } finally {
    removeTree(directory, { whenLocked: 'leave' });
  }
  expect(seen).toEqual([['evidence-16.tar.gz']]);
});

// regression: reports-ci-aggregation-disk
test('the 32-shard evidence set is consumed before the next archive is downloaded', async () => {
  await boundedTransfer(Array.from({ length: 32 }, () => 0));
});

test('bounded transfers preserve independent artifacts after consumption failures', async () => {
  await assertProperty(
    'evidence-transfer-bounded-storage',
    fc.asyncProperty(
      fc.array(fc.constantFrom(0, 1, 2), { minLength: 1, maxLength: 80 }),
      boundedTransfer
    )
  );
});

async function boundedTransfer(fails: number[]): Promise<void> {
  let resident = 0;
  let peak = 0;
  let current = -1;
  const attempted: number[] = [];
  const names = fails.map((_, id) => `verify-evidence-${String(id)}`);
  const keys = names.map(
    (name, id) => `1/${name}/evidence-${String(id)}.tar.gz`
  );
  const unused = async (): Promise<never> => {
    throw new Error('not used by a transfer');
  };
  const store: ObjectStore = {
    listKeys: async (prefix = '') =>
      keys.filter((key) => key.startsWith(prefix)).sort(),
    get: async (key) => {
      current = keys.indexOf(key);
      attempted.push(current);
      peak = Math.max(peak, ++resident);
      if (fails[current] === 2)
        throw new Error(`partial download: ${String(current)}`);
      return { body: new Response('').body!, contentType: '', size: 0 };
    },
    put: unused,
    head: unused,
    delete: unused,
    deleteMany: unused,
    getUri: unused,
    withPrefix: () => store,
  };
  const directory = mkdtempSync(join(tmpdir(), 'verify-bounded-'));
  let verdict: unknown;
  try {
    await downloadEvidence({
      prefix: 'verify-evidence-',
      directory,
      runId: '1',
      store,
      consumer: {
        consume: async () => {
          await Promise.resolve();
          if (fails[current] === 1) throw new Error(String(current));
        },
        release: async () => {
          resident--;
        },
      },
    });
  } catch (error) {
    verdict = error;
  } finally {
    removeTree(directory, { whenLocked: 'leave' });
  }
  expect([...attempted].sort((a, b) => a - b)).toEqual(
    fails.map((_, id) => id)
  );
  expect(peak).toBe(1);
  expect(resident).toBe(0);
  if (fails.some(Boolean)) {
    expect(verdict).toBeInstanceOf(AggregateError);
    expect((verdict as AggregateError).errors).toHaveLength(
      fails.filter(Boolean).length
    );
  } else expect(verdict).toBeUndefined();
}

test('a transfer is scoped to a valid run ID', () => {
  assertProperty(
    'transfer-run-id',
    fc.property(fc.integer({ min: 1, max: 1_000_000_000_000 }), (run) => {
      expect(transferRunId({ GITHUB_RUN_ID: String(run) })).toBe(String(run));
    })
  );
  for (const runId of ['', '-1', '0', '12/34', '1e3'])
    expect(() => transferRunId({ GITHUB_RUN_ID: runId })).toThrow(
      'Artifact transfer requires'
    );
});
