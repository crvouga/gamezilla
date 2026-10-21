// @io-wall-ok — restore cached reports after the required verdict, without running verifications again.
import { spawnSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { REPORT_COMPLETION, reportTask } from '@libs/harness-ts/report-ready';
import { artifactUrl } from './turbo-preflight';
import { reportOutputPath } from './verify-report-evidence';
import { processReportQueue } from './verify-report-queue';
import type { VerifyPlan } from './verify-shards';

export async function restoreReportOutputs(args: {
  readonly ids: readonly string[];
  readonly plan: {
    readonly tasks: readonly Pick<
      VerifyPlan['tasks'][number],
      'taskId' | 'hash'
    >[];
  };
  readonly root: string;
  readonly env: NodeJS.ProcessEnv;
  readonly request: (url: string, init: RequestInit) => Promise<Response>;
  readonly publish: (id: string) => Promise<void>;
}): Promise<void> {
  const { ids, plan, root, env, request, publish } = args;
  await processReportQueue(ids, async (id) => {
    try {
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
      ) {
        await publish(id);
        return;
      }
      const response = await request(
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
      const restored = spawnSync(
        'tar',
        ['-xf', '-', '-C', root, '--', reportOutputPath(id)],
        {
          input: tar,
        }
      );
      if (restored.status !== 0)
        throw new Error(`Report cache extraction failed: ${id}`);
      await publish(id);
    } finally {
      rmSync(join(root, reportOutputPath(id)), {
        recursive: true,
        force: true,
      });
    }
  });
}
