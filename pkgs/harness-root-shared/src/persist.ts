import {
  RUNS_INDEX_KEY,
  runManifestKey,
} from '@crvouga/atlas/reports/recording-keys';
import type {
  ReportStep,
  RunReport,
  RunSummary,
  RunsIndex,
  SuiteManifest,
  SuiteTestSummary,
} from '@crvouga/atlas/reports/report-types';
import { suiteStatus } from '@crvouga/atlas/reports/status';
import { readUtf8, writeUtf8 } from '@pkgs/object-store-root-shared/helpers';
import type { ObjectStore } from '@pkgs/object-store-root-shared/interface';

const JSON_TYPE = 'application/json; charset=utf-8';

export async function readStoreJson<T>(
  store: ObjectStore,
  key: string
): Promise<T | null> {
  const text = await readUtf8(store, key);
  if (text === null) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export function upsertTestSummary(
  tests: readonly SuiteTestSummary[],
  summary: SuiteTestSummary
): SuiteTestSummary[] {
  const next = tests.filter((t) => t.testId !== summary.testId);
  next.push(summary);
  next.sort((a, b) => (a.testId < b.testId ? -1 : a.testId > b.testId ? 1 : 0));
  return next;
}

export function upsertRunSummary(
  runs: readonly RunSummary[],
  summary: RunSummary
): RunSummary[] {
  const next = runs.filter((r) => r.id !== summary.id);
  next.push(summary);
  next.sort((a, b) => b.updatedAtMs - a.updatedAtMs);
  return next;
}

export function countSteps(steps: readonly ReportStep[]): number {
  return steps.reduce((n, s) => n + 1 + countSteps(s.steps), 0);
}

export function countFrames(steps: readonly ReportStep[]): number {
  return steps.reduce((n, s) => n + s.frames.length + countFrames(s.steps), 0);
}

export function summarizeReport(report: RunReport): SuiteTestSummary {
  const { meta } = report;
  return {
    testId: meta.testId,
    title: meta.title,
    seed: meta.seed,
    status: meta.status,
    durationMs: meta.durationMs,
    stepCount: countSteps(report.steps),
    frameCount: countFrames(report.steps),
    system: meta.system,
    runtime: meta.runtime,
    ...(meta.sourceFile !== undefined ? { sourceFile: meta.sourceFile } : {}),
    ...(meta.error !== undefined ? { error: meta.error } : {}),
  };
}

export async function persistReport(args: {
  readonly store: ObjectStore;
  readonly runId: string;
  readonly reportKey: string;
  readonly report: RunReport;
}): Promise<void> {
  const { store, runId, reportKey, report } = args;
  await writeUtf8(store, reportKey, JSON.stringify(report), JSON_TYPE);
  await writeManifestAndIndex(
    store,
    runId,
    summarizeReport(report),
    report.meta.endedAtMs
  );
}

export async function writeManifestAndIndex(
  store: ObjectStore,
  runId: string,
  summary: SuiteTestSummary,
  endedAtMs: number
): Promise<void> {
  const manifest = (await readStoreJson<SuiteManifest>(
    store,
    runManifestKey(runId)
  )) ?? { tests: [], updatedAtMs: 0 };
  const tests = upsertTestSummary(manifest.tests, summary);
  await writeUtf8(
    store,
    runManifestKey(runId),
    JSON.stringify({ tests, updatedAtMs: endedAtMs } satisfies SuiteManifest),
    JSON_TYPE
  );

  const index = (await readStoreJson<RunsIndex>(store, RUNS_INDEX_KEY)) ?? {
    runs: [],
  };
  const runs = upsertRunSummary(index.runs, {
    id: runId,
    updatedAtMs: endedAtMs,
    status: suiteStatus(tests),
    testCount: tests.length,
    frameCount: tests.reduce((n, t) => n + t.frameCount, 0),
  });
  await writeUtf8(
    store,
    RUNS_INDEX_KEY,
    JSON.stringify({ runs } satisfies RunsIndex),
    JSON_TYPE
  );
}
