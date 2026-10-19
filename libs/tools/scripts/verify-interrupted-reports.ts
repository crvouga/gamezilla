// @io-wall-ok — shard exit adapter: retain an explicit failure when the producer was killed.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPORT_COMPLETION, reportTask } from '@libs/harness/report-ready';
import type { Result } from './verify-shard-results';

export function preserveInterruptedReports(
  root: string,
  results: readonly Result[]
): void {
  for (const result of results) {
    const task = reportTask(result.taskId);
    if (!task || !result.interrupted || result.passed) continue;
    const bucket = join(
      root,
      task.packageDir,
      '.cache/harness-report',
      task.bucket
    );
    const message = `Verification exited ${result.exitCode} before receiving a verdict for ${result.taskId}. The task may be unfinished or not started; no passing result or execution duration is available.`;
    const directory = join(bucket, 'runs/latest/tests/ci-interruption');
    mkdirSync(directory, { recursive: true });
    writeFileSync(
      join(directory, 'report.json'),
      JSON.stringify({
        meta: {
          system: 'verify',
          runtime: 'local',
          seed: '0',
          startedAtMs: 0,
          endedAtMs: 0,
          durationMs: 0,
          status: 'failed',
          runId: 'latest',
          testId: 'ci-interruption',
          title: `Verification interrupted: ${result.taskId}`,
          actorIds: [],
          error: message,
        },
        steps: [],
      })
    );
    // A producer's partial timelines remain, but their completion cannot imply a pass.
    writeFileSync(
      join(bucket, REPORT_COMPLETION),
      JSON.stringify({ status: result.exitCode || 1 })
    );
  }
}
