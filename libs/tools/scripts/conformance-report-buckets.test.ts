import { expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { reportBuckets } from './conformance-report-buckets';

test('conformance discovers live objective evidence beside feature and gate evidence', () => {
  // regression: conformance-live-objectives-undiscovered
  const root = mkdtempSync(join(tmpdir(), 'conformance-objectives-'));
  const buckets = [
    'apps/product/.cache/health-objectives-report',
    'apps/product/.cache/health-report',
    'libs/chess-root-harness/.cache/harness-report/part-0',
    'libs/chess-root-harness/.cache/harness-report/models',
  ];
  try {
    for (const bucket of [
      ...buckets,
      'libs/chess-root-harness/.cache/harness-report/all',
      'apps/product/.cache/other-report',
    ]) {
      mkdirSync(join(root, bucket, 'evidence'), { recursive: true });
    }
    expect([...reportBuckets(root)].sort()).toEqual(
      buckets.map((bucket) => join(root, bucket)).sort()
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
