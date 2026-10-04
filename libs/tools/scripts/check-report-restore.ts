// @io-wall-ok — restore cached reports after the required verdict, without running checks again.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { REPORT_COMPLETION, reportTask } from '@libs/harness/report-ready';
import { restoreReportQueue } from './check-report-queue';
import type { CheckPlan } from './check-shards';
import { artifactUrl } from './turbo-preflight';

export async function restoreReportOutputs(
  ids: readonly string[],
  plan: CheckPlan,
  root: string,
  env: NodeJS.ProcessEnv
): Promise<void> {
  await restoreReportQueue(ids, async (id) => {
    const task = plan.tasks.find((task) => task.taskId === id)!;
    const report = reportTask(id)!;
    if (
      existsSync(
        join(
          root,
          report.packageDir,
          '.cache/harness-report',
          report.bucket,
          REPORT_COMPLETION
        )
      )
    )
      return;
    const response = await fetch(
      artifactUrl(env['TURBO_API']!, env['TURBO_TEAM']!, task.hash),
      {
        headers: { Authorization: `Bearer ${env['TURBO_TOKEN']!}` },
        signal: AbortSignal.timeout(30_000),
      }
    );
    if (!response.ok)
      throw new Error(`Report cache restore ${id}: HTTP ${response.status}`);
    const tar = Bun.zstdDecompressSync(
      new Uint8Array(await response.arrayBuffer())
    );
    const restored = spawnSync('tar', ['-xf', '-', '-C', root], {
      input: tar,
    });
    if (restored.status !== 0)
      throw new Error(`Report cache extraction failed: ${id}`);
  });
}
