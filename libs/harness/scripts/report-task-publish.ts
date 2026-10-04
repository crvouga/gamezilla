// @io-wall-ok — CI report publication over a local bucket and injected remote store.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ReportTask } from '@libs/harness/report-ready';
import { REPORT_COMPLETION, reportTask } from '@libs/harness/report-ready';
import { sourceId } from '@pkgs/harness-report-shared/keys';
import { publicationStore } from '@pkgs/harness-report-shared/publication';
import { publishSource } from '@pkgs/harness-report-shared/publish';
import type { SourceIdentity } from '@pkgs/harness-report-shared/source-content';
import { reuseSource } from '@pkgs/harness-report-shared/source-content';
import { createNodeFsObjectStore } from '@pkgs/object-store-node-fs-server/impl-node-fs';
import { wallNodeFs } from '@pkgs/object-store-node-fs-server/wall-node-fs';
import { readUtf8, writeUtf8 } from '@pkgs/object-store-shared/helpers';
import type { ObjectStore } from '@pkgs/object-store-shared/interface';

function receiptKey(sha: string, runId: string, task: ReportTask): string {
  return `commits/${sha}/publications/${encodeURIComponent(runId)}/${sourceId(task.packageDir, task.bucket)}.json`;
}

export async function publishReportTask(args: {
  readonly store: ObjectStore;
  readonly repoRoot: string;
  readonly sha: string;
  readonly runId: string;
  readonly taskId: string;
  readonly identity: SourceIdentity;
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
  const store = publicationStore(args.store, args.runId);
  const hasTimelines =
    [
      ...new Bun.Glob('runs/latest/tests/*/report.json').scanSync({
        cwd: rootDir,
      }),
    ].length > 0;
  const record = hasTimelines
    ? await publishSource(store, {
        ...task,
        sha: args.sha,
        local,
        identity: args.identity,
        status: completion.status === 0 ? 'passed' : 'failed',
      })
    : null;
  // Empty parts and suites without timelines still acknowledge completion.
  // The run id prevents an earlier attempt's receipt satisfying this run.
  await writeUtf8(
    store,
    receiptKey(args.sha, args.runId, task),
    JSON.stringify({
      taskId: args.taskId,
      runId: args.runId,
      taskHash: args.identity.taskHash,
    }),
    'application/json'
  );
  if (record && record.tests.length > 0)
    console.log(
      `[report-publish] ${args.taskId}: ${String(record.tests.length)} timeline(s)`
    );
}

export async function reuseReportTask(args: {
  readonly store: ObjectStore;
  readonly sha: string;
  readonly runId: string;
  readonly taskId: string;
  readonly identity: SourceIdentity;
}): Promise<boolean> {
  const task = reportTask(args.taskId);
  if (task === null) throw new Error(`Invalid report task: ${args.taskId}`);
  const store = publicationStore(args.store, args.runId);
  const record = await reuseSource(store, {
    ...task,
    sha: args.sha,
    identity: args.identity,
  });
  if (record === null) return false;
  await writeUtf8(
    store,
    receiptKey(args.sha, args.runId, task),
    JSON.stringify({
      taskId: args.taskId,
      runId: args.runId,
      taskHash: args.identity.taskHash,
    }),
    'application/json'
  );
  return true;
}

export async function verifyPublications(args: {
  readonly store: ObjectStore;
  readonly sha: string;
  readonly runId: string;
  readonly tasks: readonly { readonly taskId: string; readonly hash: string }[];
}): Promise<void> {
  const store = publicationStore(args.store, args.runId);
  const reports = args.tasks.flatMap((task) => {
    const report = reportTask(task.taskId);
    return report === null ? [] : [{ ...report, hash: task.hash }];
  });
  await Promise.all(
    reports.map(async (task) => {
      const value = await readUtf8(
        store,
        receiptKey(args.sha, args.runId, task)
      );
      const receipt =
        value === null
          ? null
          : (JSON.parse(value) as {
              runId: string;
              taskId: string;
              taskHash: string;
            });
      if (
        receipt?.runId !== args.runId ||
        receipt.taskId !== task.taskId ||
        receipt.taskHash !== task.hash
      ) {
        throw new Error(`Report not published by this run: ${task.taskId}`);
      }
    })
  );
}
