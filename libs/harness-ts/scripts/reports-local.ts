// @io-wall-ok — local evidence assembly, never a remote publication or a gate.
import { join, resolve } from 'node:path';
import { eachLimited } from '@crvouga/atlas/reports/completion-order';
import type { ReportPart } from '@crvouga/atlas/reports/explorer-types';
import { viewerTestId } from '@crvouga/atlas/reports/keys';
import {
  catalogEntries,
  catalogLayers,
} from '@crvouga/atlas/reports/layer-catalog';
import { distinctLayers } from '@crvouga/atlas/reports/layer-merge';
import { readLayerFile } from '@crvouga/atlas/reports/layer-store';
import type { LayerSummary } from '@crvouga/atlas/reports/layer-types';
import { performancePart } from '@crvouga/atlas/reports/performance-part';
import {
  closeCommit,
  openCommit,
  publishSource,
} from '@crvouga/atlas/reports/publish';
import { readTestReport } from '@crvouga/atlas/reports/read';
import { publishPart } from '@crvouga/atlas/reports/report-parts';
import type { RunReport } from '@crvouga/atlas/reports/report-types';
import { compileFrameCss } from '@libs/harness-ts/wall-frame-css';
import { wallClock } from '@pkgs/clock-shared-ts/wall';
import { createNodeFsObjectStore } from '@pkgs/object-store-node-fs-server-ts/impl-node-fs';
import { wallNodeFs } from '@pkgs/object-store-node-fs-server-ts/wall-node-fs';
import { readUtf8 } from '@pkgs/object-store-root-shared-ts/helpers';
import { publishCheckoutInventory } from './report-inventory';
import { type ReportOrigin, reportBranch, reportOrigin } from './report-origin';
import { reportsStore } from './report-store';

const ROOT = resolve(import.meta.dirname, '../../..');
function store(rootDir: string) {
  return createNodeFsObjectStore({ rootDir, fs: wallNodeFs(), layout: 'tree' });
}

async function collect(): Promise<void> {
  const packageDirArg = process.argv.indexOf('--package-dir');
  const requestedPackageDir =
    packageDirArg < 0 ? null : process.argv[packageDirArg + 1];
  const attemptIdArg = process.argv.indexOf('--attempt-id');
  const attemptId = attemptIdArg < 0 ? null : process.argv[attemptIdArg + 1];
  if (
    packageDirArg >= 0 &&
    !/^(apps|libs|pkgs)\/[a-z0-9-]+$/.test(requestedPackageDir ?? '')
  )
    throw new Error(
      '--package-dir must name an apps/, libs/, or pkgs/ package'
    );
  if (attemptIdArg >= 0 && !attemptId)
    throw new Error('--attempt-id needs a completed-run identifier');
  const origin = reportOrigin(ROOT);
  // Atlas combines and filters layers by branch; a detached checkout is `local`.
  const branch = reportBranch(ROOT) ?? 'local';
  const target = store(join(ROOT, '.cache/local-reports'));
  const opened = new Set<string>();
  const frameCss = compileFrameCss(ROOT);
  let count = 0;
  for (const completion of new Bun.Glob(
    '{apps,libs,pkgs}/*/.cache/harness-report/*/complete.json'
  ).scanSync({ cwd: ROOT, onlyFiles: true })) {
    const packageDir = completion.split('/').slice(0, 2).join('/');
    if (packageDirArg >= 0 && packageDir !== requestedPackageDir) continue;
    const bucket = completion.split('/')[4]!;
    const local = store(
      join(ROOT, packageDir, '.cache/harness-report', bucket)
    );
    const finished = JSON.parse((await readUtf8(local, 'complete.json'))!) as {
      status: number;
      completedAtMs?: number;
      attemptId?: string;
    };
    if (attemptIdArg >= 0 && finished.attemptId !== attemptId) continue;
    const raw = await readUtf8(local, 'origin.json');
    const produced = raw === null ? null : (JSON.parse(raw) as ReportOrigin);
    const sha = produced?.sha ?? origin.sha;
    if (!opened.has(sha)) {
      if (produced?.clean) await publishCheckoutInventory(target, ROOT, sha);
      await openCommit(target, {
        sha,
        branch,
        runUrl: null,
        startedAtMs: 0,
        frameCss,
      });
      opened.add(sha);
    }
    const source = await publishSource(target, {
      sha,
      ...(finished.completedAtMs === undefined
        ? {}
        : { recordedAtMs: finished.completedAtMs }),
      ...(produced === null
        ? { freshness: 'unknown' as const }
        : produced.clean
          ? {}
          : { freshness: 'modified' as const }),
      packageDir,
      bucket,
      local,
      status: finished.status === 0 ? 'passed' : 'failed',
    });
    if (source === null) continue;
    count += 1;
  }
  for (const sha of opened)
    await closeCommit(target, { sha, endedAtMs: wallClock.now() });
  console.log(
    `Collected ${count} report layers across ${opened.size} recorded revisions. Modified and unknown origins remain visible with freshness warnings.`
  );
}

async function performance(): Promise<void> {
  const local = store(join(ROOT, '.cache/local-reports'));
  const layers: LayerSummary[] = [];
  await eachLimited(await catalogEntries(local), 8, async (entry) => {
    layers.push(...(await catalogLayers(local, entry)));
  });
  const allowanceMs = Number(process.argv[3] ?? 50);
  let count = 0;
  for (const layer of distinctLayers(layers)) {
    if (!layer.source || !layer.sha || layer.source.bucket === 'ui-quality')
      continue;
    const reports: RunReport[] = [];
    for (const test of layer.source.tests) {
      const file =
        layer.recording?.type === 'layer'
          ? await readLayerFile(
              local,
              layer.id,
              `tests/${test.testId}/report.json`
            )
          : null;
      const report: RunReport | null =
        layer.recording?.type === 'layer'
          ? file
            ? (JSON.parse(new TextDecoder().decode(file.bytes)) as RunReport)
            : null
          : await readTestReport(local, {
              sha: layer.sha,
              source: layer.source.source,
              testId: test.testId,
            });
      if (report)
        reports.push({
          ...report,
          meta: {
            ...report.meta,
            testId: viewerTestId(layer.source.source, test.testId),
          },
        });
    }
    if (!reports.length) continue;
    await publishPart(local, {
      ...performancePart({
        sha: layer.sha,
        recordedAtMs: layer.recordedAtMs,
        allowanceMs,
        reports,
      }),
      ...(layer.freshness ? { freshness: layer.freshness } : {}),
      parameters: { ...layer.parameters, allowanceMs: String(allowanceMs) },
    });
    count += reports.length;
  }
  if (!count)
    throw new Error(
      'No recorded timelines. Run specs, then bun reports:collect first.'
    );
  console.log(
    `Recorded performance evidence from ${count} retained timelines (${allowanceMs} ms diagnostic allowance).`
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
  console.log('Report part recorded. Refresh layers in Atlas.');
}

if (import.meta.main) {
  const command = process.argv[2];
  if (command === 'collect') await collect();
  else if (command === 'performance') await performance();
  else if (command === 'part') await part();
  else throw new Error('Expected collect, performance, or part');
}
