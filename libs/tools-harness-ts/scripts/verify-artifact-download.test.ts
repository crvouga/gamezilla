import { expect, test } from 'bun:test';
import { mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { removeTree } from '@pkgs/fs-server-ts/remove-tree';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';
import type { ArtifactsApi } from './ci-artifacts';
import { fakeArtifactsApi } from './ci-artifacts-fake';
import { downloadEvidence, transferRunId } from './verify-artifact-download';

// regression: github-artifact-download-missing-runtime-token
test('shell transfers need only the run and the artifacts API, and take only the named prefix', async () => {
  const api = fakeArtifactsApi([
    {
      runId: '37512663922',
      id: 1,
      name: 'verify-evidence-16',
      files: { 'evidence-16.tar.gz': 'e16' },
    },
    {
      runId: '37512663922',
      id: 2,
      name: 'verify-plan',
      files: { 'plan.payload': 'plan' },
    },
    {
      runId: '99',
      id: 3,
      name: 'verify-evidence-3',
      files: { 'evidence-3.tar.gz': 'other run' },
    },
  ]);
  const directory = mkdtempSync(join(tmpdir(), 'verify-transfer-'));
  const seen: string[][] = [];
  try {
    await downloadEvidence({
      prefix: 'verify-evidence-',
      directory,
      runId: transferRunId({ GITHUB_RUN_ID: '37512663922' }),
      api,
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
  const api: ArtifactsApi = {
    list: async () => names.map((name, id) => ({ id, name, expired: false })),
    download: async (id) => {
      current = id;
      attempted.push(current);
      peak = Math.max(peak, ++resident);
      if (fails[current] === 2)
        throw new Error(`partial download: ${String(current)}`);
    },
    remove: async () => {
      throw new Error('not used by a transfer');
    },
  };
  const directory = mkdtempSync(join(tmpdir(), 'verify-bounded-'));
  let verdict: unknown;
  try {
    await downloadEvidence({
      prefix: 'verify-evidence-',
      directory,
      runId: '1',
      api,
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
