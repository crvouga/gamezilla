// @io-wall-ok — restore cached reports after the required verdict, without running checks again.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { reportTask, REPORT_COMPLETION } from '@libs/harness/ci/report-ready';
import type { CheckPlan } from './check-shards';
import { artifactUrl } from './turbo-preflight';

export async function restoreReportOutputs(
  ids: readonly string[],
  plan: CheckPlan,
  root: string,
  env: NodeJS.ProcessEnv
): Promise<void> {
  let next = 0;
  async function worker(): Promise<void> {
    for (let index = next++; index < ids.length; index = next++) {
      const id = ids[index]!;
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
        continue;
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
    }
  }
  await Promise.all(Array.from({ length: Math.min(16, ids.length) }, worker));
}
