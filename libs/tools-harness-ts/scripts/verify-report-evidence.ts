// @io-wall-ok — publish failed producer buckets directly from one retained GitHub archive.
import {
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { reportTask } from '@libs/harness-ts/report-ready';
import { extractEvidence } from './verify-evidence-archive';
import { reportCommand } from './verify-report-command';
import { processReportQueue } from './verify-report-queue';

export function reportOutputPath(id: string): string {
  const task = reportTask(id);
  if (!task) throw new Error(`Invalid report task: ${id}`);
  return join(task.packageDir, '.cache/harness-report', task.bucket);
}

export function missingReports(env: NodeJS.ProcessEnv): string[] {
  const path = env['VERIFY_REPORT_PLAN_PATH'];
  if (!path) throw new Error('VERIFY_REPORT_PLAN_PATH is required');
  return JSON.parse(readFileSync(`${path}.missing.json`, 'utf8')) as string[];
}

export async function consumeReportEvidence(
  archive: string,
  entries: readonly string[],
  root: string
): Promise<void> {
  const missing = new Set(missingReports(process.env));
  const ids = [...missing].filter((id) =>
    entries.includes(
      `.cache/verify-ci/failed-reports/${reportOutputPath(id)}/complete.json`
    )
  );
  try {
    await processReportQueue(ids, async (id) => {
      const relative = reportOutputPath(id);
      const archived = `.cache/verify-ci/failed-reports/${relative}`;
      try {
        extractEvidence(
          archive,
          entries.filter((entry) => entry.startsWith(`${archived}/`)),
          root
        );
        const destination = join(root, relative);
        mkdirSync(dirname(destination), { recursive: true });
        renameSync(join(root, archived), destination);
        await reportCommand(root, process.env, ['task', id]);
        missing.delete(id);
      } finally {
        rmSync(join(root, relative), { recursive: true, force: true });
        rmSync(join(root, archived), { recursive: true, force: true });
      }
    });
  } finally {
    writeFileSync(
      `${process.env['VERIFY_REPORT_PLAN_PATH']}.missing.json`,
      JSON.stringify([...missing])
    );
  }
}
