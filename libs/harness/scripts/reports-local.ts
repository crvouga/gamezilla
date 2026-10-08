// @io-wall-ok — local evidence assembly, never a remote publication or a gate.
import { join, resolve } from 'node:path';
import { compileFrameCss } from '@libs/harness/wall-frame-css';
import { wallClock } from '@pkgs/clock-shared/wall';
import type { ReportPart } from '@pkgs/harness-report-shared/explorer-types';
import { viewerTestId } from '@pkgs/harness-report-shared/keys';
import { performancePart } from '@pkgs/harness-report-shared/performance-part';
import {
  closeCommit,
  openCommit,
  publishSource,
} from '@pkgs/harness-report-shared/publish';
import {
  listSourceRecords,
  readTestReport,
} from '@pkgs/harness-report-shared/read';
import { publishPart } from '@pkgs/harness-report-shared/report-parts';
import { createNodeFsObjectStore } from '@pkgs/object-store-node-fs-server/impl-node-fs';
import { wallNodeFs } from '@pkgs/object-store-node-fs-server/wall-node-fs';
import { readUtf8 } from '@pkgs/object-store-root-shared/helpers';
import { publishCheckoutInventory } from './report-inventory';
import { type ReportOrigin, reportOrigin } from './report-origin';
import { publishPartOutput } from './report-part-output';
import { reportsStore } from './report-store';

const ROOT = resolve(import.meta.dirname, '../../..');
function store(rootDir: string) {
  return createNodeFsObjectStore({ rootDir, fs: wallNodeFs(), layout: 'tree' });
}

async function collect(): Promise<void> {
  const origin = reportOrigin(ROOT);
  if (!origin.clean)
    throw new Error(
      'Commit the current changes before collecting evidence under a commit hash.'
    );
  const target = store(join(ROOT, '.cache/local-reports'));
  const now = wallClock.now();
  await publishCheckoutInventory(target, ROOT, origin.sha);
  await openCommit(target, {
    sha: origin.sha,
    branch: 'local',
    runUrl: null,
    startedAtMs: now,
    frameCss: compileFrameCss(ROOT),
  });
  let count = 0;
  for (const completion of new Bun.Glob(
    '{apps,libs,pkgs}/*/.cache/harness-report/*/complete.json'
  ).scanSync({ cwd: ROOT, onlyFiles: true })) {
    const packageDir = completion.split('/').slice(0, 2).join('/');
    const bucket = completion.split('/')[4]!;
    const local = store(
      join(ROOT, packageDir, '.cache/harness-report', bucket)
    );
    const raw = await readUtf8(local, 'origin.json');
    if (raw === null) continue;
    const produced = JSON.parse(raw) as ReportOrigin;
    if (produced.sha !== origin.sha || !produced.clean) continue;
    const finished = JSON.parse((await readUtf8(local, 'complete.json'))!) as {
      status: number;
    };
    const source = await publishSource(target, {
      sha: origin.sha,
      packageDir,
      bucket,
      local,
      status: finished.status === 0 ? 'passed' : 'failed',
    });
    if (source === null) continue;
    await publishPartOutput({
      store: target,
      sha: origin.sha,
      source,
      recordedAtMs: now,
    });
    count += 1;
  }
  await closeCommit(target, { sha: origin.sha, endedAtMs: wallClock.now() });
  console.log(
    `Collected ${count} report parts for ${origin.sha}. Sources without matching clean revision evidence were excluded.`
  );
}

async function performance(): Promise<void> {
  const sha = reportOrigin(ROOT).sha;
  const local = store(join(ROOT, '.cache/local-reports'));
  const sources = await listSourceRecords(local, sha);
  const reports = [];
  for (const source of sources.filter(
    (source) => source.bucket !== 'ui-quality'
  ))
    for (const test of source.tests) {
      const report = await readTestReport(local, {
        sha,
        source: source.source,
        testId: test.testId,
      });
      if (report !== null)
        reports.push({
          ...report,
          meta: {
            ...report.meta,
            testId: viewerTestId(source.source, test.testId),
          },
        });
    }
  if (reports.length === 0)
    throw new Error(
      'No commit-matched timelines. Run specs, then bun reports:collect first.'
    );
  const allowanceMs = Number(process.argv[3] ?? 50);
  const part = performancePart({
    sha,
    recordedAtMs: wallClock.now(),
    allowanceMs,
    reports,
  });
  await publishPart(local, part);
  console.log(
    `Recorded performance evidence from ${reports.length} timelines (${allowanceMs} ms diagnostic allowance).`
  );
}

async function part(): Promise<void> {
  const path = process.argv[3];
  if (!path)
    throw new Error('Usage: bun reports:part <report-part.json> [--publish]');
  const input = store(ROOT);
  const raw = await readUtf8(input, path);
  if (raw === null) throw new Error('Report part not found');
  await publishPart(
    store(join(ROOT, '.cache/local-reports')),
    JSON.parse(raw) as ReportPart
  );
  if (process.argv.includes('--publish'))
    await publishPart(reportsStore(), JSON.parse(raw) as ReportPart);
  console.log('Report part recorded. Refresh the selected commit in Reports.');
}

if (import.meta.main) {
  const command = process.argv[2];
  if (command === 'collect') await collect();
  else if (command === 'performance') await performance();
  else if (command === 'part') await part();
  else throw new Error('Expected collect, performance, or part');
}
