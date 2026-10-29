import { expect, test } from 'bun:test';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { removeTree } from '@pkgs/fs-server-ts/remove-tree';
import { preserveInterruptedReports } from './verify-interrupted-reports';
import type { Result } from './verify-shard-results';

function result(taskId: string, interrupted = true): Result {
  return {
    taskId,
    hash: 'b65ff77a9d840001',
    cache: 'MISS',
    passed: false,
    milliseconds: 0,
    exitCode: 124,
    interrupted,
  };
}

test('a killed visual task publishes a failed completion and keeps its partial evidence', () => {
  // regression: verify-timeout-drops-task-evidence — missing completion caused cache HTTP 404 and abandoned report publication in Verification xlnk3h10bl.
  const root = mkdtempSync(join(tmpdir(), 'verify-interrupted-'));
  try {
    const bucket = join(
      root,
      'apps/product-ts/.cache/harness-report/ui-quality'
    );
    const partial = join(bucket, 'runs/latest/tests/observed');
    mkdirSync(partial, { recursive: true });
    writeFileSync(join(partial, 'report.json'), 'partial evidence');
    writeFileSync(join(bucket, 'complete.json'), '{"status":0}');
    preserveInterruptedReports(root, [
      result('@apps/product-ts#verify:ui-quality'),
    ]);
    expect(readFileSync(join(partial, 'report.json'), 'utf8')).toBe(
      'partial evidence'
    );
    expect(
      JSON.parse(readFileSync(join(bucket, 'complete.json'), 'utf8'))
    ).toEqual({ status: 124 });
    const report = JSON.parse(
      readFileSync(
        join(bucket, 'runs/latest/tests/ci-interruption/report.json'),
        'utf8'
      )
    ) as {
      meta: { status: string; error: string; durationMs: number };
      steps: unknown[];
    };
    expect(report.meta.status).toBe('failed');
    expect(report.meta.error).toContain('Verification exited 124');
    expect(report.meta.error).toContain('unfinished or not started');
    expect(report.meta.durationMs).toBe(0);
    expect(report.steps).toEqual([]);
  } finally {
    removeTree(root, { whenLocked: 'leave' });
  }
});

test('completed tasks and tasks without reports produce no interruption evidence', () => {
  const root = mkdtempSync(join(tmpdir(), 'verify-interrupted-'));
  try {
    preserveInterruptedReports(root, [
      result('@libs/chess#test:spec:13', false),
      { ...result('@libs/friends#test:spec:2'), passed: true, exitCode: 0 },
      result('@libs/tools-harness-ts#tc'),
    ]);
    expect(existsSync(join(root, 'libs'))).toBe(false);
  } finally {
    removeTree(root, { whenLocked: 'leave' });
  }
});
