// @io-wall-ok — offline gate entry; reads only the product's prepared artifact directory.
import { isAbsolute, join, relative, resolve } from 'node:path';
import { REPORT_READY } from '@libs/harness/report-ready';
import { wallClock } from '@pkgs/clock-shared/wall';
import { readUtf8, writeUtf8 } from '@pkgs/object-store-shared/helpers';
import { createNodeFsObjectStore } from '@pkgs/object-store-node-fs-server/impl-node-fs';
import { wallNodeFs } from '@pkgs/object-store-node-fs-server/wall-node-fs';
import type { CheckerOptions } from '@pkgs/ui-quality-check-shared/ui-quality-check-types';
import { createUIQualityChecker } from '@pkgs/ui-quality-check-server/api';
import config from './ui-quality/config.json';
import { runVisualGate } from './gate';
import type { SnapshotRenderer } from './render';
import { openSnapshotRenderer } from './render';
import {
  failureSummary,
  writeQualityReports,
  writeToolingFailure,
} from './report';
import type { ArtifactManifest } from './types';

const ROOT = resolve(import.meta.dir, '..');
const INPUT = join(ROOT, '.cache/ui-quality-inputs');
const OUTPUT = join(ROOT, '.cache/ui-quality');
const MODEL = resolve(ROOT, '../../.cache/ui-quality-model');
const REPORTS = join(ROOT, '.cache/harness-report/ui-quality');

function store(rootDir: string) {
  return createNodeFsObjectStore({ rootDir, fs: wallNodeFs(), layout: 'tree' });
}

function diagnosticKey(file: string): string {
  const key = relative(OUTPUT, file);
  if (isAbsolute(key) || key.split(/[\\/]/).includes('..'))
    throw new Error(
      `Failure diagnostic is outside its output directory: ${file}`
    );
  return key.split('\\').join('/');
}

export async function checkRecordedUI(signal?: AbortSignal): Promise<number> {
  const output = store(OUTPUT);
  const reports = store(REPORTS);
  await reports.deleteMany(await reports.listKeys());
  await output.deleteMany(await output.listKeys());
  const started = wallClock.now();
  const inputs = store(INPUT);
  const manifest = await readUtf8(inputs, 'manifest.json');
  const css = await readUtf8(inputs, 'frame.css');
  if (manifest === null || css === null)
    throw new Error(
      'UI artifacts are missing. Run @apps/product prepare:ui-quality through Turbo.'
    );
  const checker = await createUIQualityChecker({
    ...(config as CheckerOptions),
    modelDir: MODEL,
    artifactsDir: join(OUTPUT, 'videos'),
    failureClipMs: 1000,
    ...(signal ? { signal } : {}),
  });
  let renderer: SnapshotRenderer | undefined;
  try {
    renderer = openSnapshotRenderer(css, signal);
    const result = await runVisualGate(
      JSON.parse(manifest) as ArtifactManifest,
      {
        inputs,
        output,
        checker,
        renderer,
        threshold: config.threshold,
        batchSize: config.batchSize,
        inputPath: (file) => join(INPUT, file),
        diagnosticKey,
        ...(signal ? { signal } : {}),
      }
    );
    const failures = result.results
      .filter((r) => !r.result.pass)
      .sort((a, b) => a.result.score - b.result.score);
    await writeQualityReports(result, output, reports);
    await writeUtf8(
      output,
      'metrics.json',
      JSON.stringify({
        schemaVersion: 1,
        elapsedMs: wallClock.now() - started,
        inputsAnalyzed: result.inputsAnalyzed,
        uniqueImagesScored: result.uniqueImagesScored,
        snapshotConcurrency: 4,
        peakRssBytes: process.resourceUsage().maxRSS * 1024,
        model: checker.metrics(),
      }),
      'application/json'
    );
    console.log(
      `[ui-quality] ${result.pass ? 'PASS' : 'FAIL'}: ${result.inputsAnalyzed} inputs, ${result.uniqueImagesScored} unique screenshots from ${result.reports} reports; threshold ${result.threshold} (experimental), ${(wallClock.now() - started) / 1000}s.`
    );
    for (const failure of failures.slice(0, 20))
      console.error(failureSummary(failure, result.threshold));
    return result.pass ? 0 : 1;
  } finally {
    try {
      renderer?.dispose();
    } finally {
      await checker.dispose();
    }
  }
}

if (import.meta.main) {
  const controller = new AbortController();
  const stop = () => controller.abort(new Error('UI quality check cancelled.'));
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  try {
    process.exitCode = await checkRecordedUI(controller.signal);
  } catch (error) {
    process.exitCode = 2;
    await writeToolingFailure(store(REPORTS), error);
    await writeUtf8(
      store(OUTPUT),
      'error.json',
      JSON.stringify({
        schemaVersion: 1,
        error: error instanceof Error ? error.message : String(error),
      }),
      'application/json'
    );
    console.error(`[ui-quality] tooling failure: ${String(error)}`);
  } finally {
    try {
      await writeUtf8(
        store(REPORTS),
        'complete.json',
        JSON.stringify({ status: process.exitCode ?? 2 }),
        'application/json'
      );
      console.log(REPORT_READY);
    } finally {
      process.off('SIGINT', stop);
      process.off('SIGTERM', stop);
      Bun.WebView.closeAll();
    }
  }
}
