import { expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { assertProperty } from '@pkgs/property-shared/assert-property';
import fc from 'fast-check';
import { archiveEntries, extractEvidence } from './verify-evidence-archive';
import { evidencePaths } from './verify-evidence-selection';
import type { VerifyPlan } from './verify-shards';

const hash = '0123456789abcdef';
const otherHash = 'fedcba9876543210';
const plan = {
  tasks: [{ taskId: 'producer', hash, dependencies: [] }],
  shards: [
    {
      stage: 'consumers',
      tasks: [{ taskId: 'consumer', dependencies: ['producer'] }],
    },
  ],
} as unknown as VerifyPlan;
const result = '.cache/verify-ci/results/shard-0.json';
const needed = `.turbo/cache/${hash}.tar.zst`;
const irrelevant = `.turbo/cache/${otherHash}.tar.zst`;
const report =
  '.cache/verify-ci/failed-reports/apps/product/.cache/harness-report/part-0/complete.json';

// regression: reports-ci-aggregation-disk
test('verdict and consumer extraction omit failed report payloads and unrelated caches', () => {
  const fixture = mkdtempSync(join(tmpdir(), 'evidence-'));
  const source = join(fixture, 'source');
  const entries = [result, needed, irrelevant, report];
  try {
    for (const entry of entries) {
      mkdirSync(dirname(join(source, entry)), { recursive: true });
      writeFileSync(join(source, entry), '{}');
    }
    const archive = join(fixture, 'evidence.tar');
    expect(
      spawnSync('tar', ['-cf', archive, '-C', source, ...entries]).status
    ).toBe(0);
    const listed = archiveEntries(archive);
    for (const mode of ['verdict', 'consumers']) {
      const destination = join(fixture, mode);
      mkdirSync(destination);
      extractEvidence(archive, evidencePaths(listed, mode, plan), destination);
      expect(existsSync(join(destination, result))).toBe(true);
      expect(existsSync(join(destination, report))).toBe(false);
      expect(existsSync(join(destination, irrelevant))).toBe(false);
      expect(existsSync(join(destination, needed))).toBe(mode === 'consumers');
    }
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test('evidence selection never expands to another producer or arbitrary archive path', () => {
  assertProperty(
    'ci-evidence-selection',
    fc.property(fc.array(fc.string(), { maxLength: 80 }), (extra) => {
      const entries = [result, needed, irrelevant, report, ...extra];
      expect(evidencePaths(entries, 'verdict', null)).toEqual(
        entries.filter(
          (entry) =>
            /^\.cache\/verify-ci\/results\/shard-\d+\.json$/.test(entry) ||
            entry === '.cache/verify-ci/plan.payload'
        )
      );
      expect(evidencePaths(entries, 'consumers', plan)).not.toContain(report);
      expect(evidencePaths(entries, 'consumers', plan)).not.toContain(
        irrelevant
      );
    })
  );
});
