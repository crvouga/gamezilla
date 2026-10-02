// @io-wall-ok — CI report publication over a local bucket and injected remote store.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sourceId } from '@pkgs/harness-report';
import { publishSource } from '@pkgs/harness-report/remote/publish';
import { readUtf8, writeUtf8 } from '@pkgs/object-store/helpers';
import type { ObjectStore } from '@pkgs/object-store/interface';
import { createNodeFsObjectStore } from '@pkgs/object-store-node-fs/impl-node-fs';
import { wallNodeFs } from '@pkgs/object-store-node-fs/wall-node-fs';
import {
  REPORT_COMPLETION,
  type ReportTask,
  reportTask,
} from '../src/ci/report-ready';

function receiptKey(sha: string, task: ReportTask): string {
  return `commits/${sha}/publications/${sourceId(task.packageDir, task.bucket)}.json`;
}

export async function publishReportTask(args: {
  readonly store: ObjectStore;
  readonly repoRoot: string;
  readonly sha: string;
  readonly runId: string;
  readonly taskId: string;
}): Promise<void> {
  const task = reportTask(args.taskId);
  if (task === null) throw new Error(`Invalid report task: ${args.taskId}`);
  const rootDir = join(
    args.repoRoot,
    task.packageDir,
    '.cache/harness-report',
    task.bucket
  );
  if (!existsSync(join(rootDir, REPORT_COMPLETION)))
    throw new Error(`Missing report output: ${args.taskId}`);
  const completion = JSON.parse(
    readFileSync(join(rootDir, REPORT_COMPLETION), 'utf8')
  ) as { status: number };
  if (!Number.isInteger(completion.status) || completion.status < 0)
    throw new Error(`Invalid report completion: ${args.taskId}`);
  const local = createNodeFsObjectStore({
    rootDir,
    fs: wallNodeFs(),
    layout: 'tree',
  });
  const record = await publishSource(args.store, {
    ...task,
    sha: args.sha,
    local,
  });
  // Empty parts and suites without timelines still acknowledge completion.
  // The run id prevents an earlier attempt's receipt satisfying this run.
  await writeUtf8(
    args.store,
    receiptKey(args.sha, task),
    JSON.stringify({
      taskId: args.taskId,
      runId: args.runId,
    }),
    'application/json'
  );
  console.log(
    `[report-publish] ${args.taskId}: ${String(record?.tests.length ?? 0)} test(s)`
  );
}

export async function verifyPublications(args: {
  readonly store: ObjectStore;
  readonly sha: string;
  readonly runId: string;
  readonly taskIds: readonly string[];
}): Promise<void> {
  const reports = args.taskIds.flatMap((id) => reportTask(id) ?? []);
  await Promise.all(
    reports.map(async (task) => {
      const value = await readUtf8(args.store, receiptKey(args.sha, task));
      const receipt =
        value === null
          ? null
          : (JSON.parse(value) as { runId: string; taskId: string });
      if (receipt?.runId !== args.runId || receipt.taskId !== task.taskId) {
        throw new Error(`Report not published by this run: ${task.taskId}`);
      }
    })
  );
}
