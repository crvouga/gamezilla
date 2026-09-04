import { writeUtf8 } from '@pkgs/object-store/helpers';
import type { ObjectStore } from '@pkgs/object-store/interface';

import { GENERATION_KEY, RUNS_INDEX_KEY, runManifestKey } from './keys';
import type {
  RunReport,
  RunSummary,
  RunsIndex,
  SuiteManifest,
  SuiteTestSummary,
} from './types';

export async function readStoreText(
  store: ObjectStore,
  key: string
): Promise<string | null> {
  const obj = await store.get(key);
  if (obj === null) return null;
  const reader = obj.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    if (value !== undefined) {
      chunks.push(value);
      total += value.byteLength;
    }
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(out);
}

export async function readStoreJson<T>(
  store: ObjectStore,
  key: string
): Promise<T | null> {
  const text = await readStoreText(store, key);
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
  next.sort((a, b) => a.testId.localeCompare(b.testId));
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

export async function persistReport(args: {
  readonly store: ObjectStore;
  readonly runId: string;
  readonly testId: string;
  readonly reportKey: string;
  readonly report: RunReport;
}): Promise<void> {
  const { store, runId, testId, reportKey, report } = args;
  const endedAtMs = report.meta.endedAtMs;
  await writeUtf8(
    store,
    reportKey,
    JSON.stringify(report),
    'application/json; charset=utf-8'
  );

  const frameCount = report.steps.reduce((n, s) => n + s.frames.length, 0);
  const summary: SuiteTestSummary = {
    testId,
    seed: report.meta.seed,
    status: report.meta.status,
    durationMs: report.meta.durationMs,
    stepCount: report.steps.length,
    frameCount,
    path: `/t/${testId}`,
    system: report.meta.system,
    runtime: report.meta.runtime,
  };

  await writeManifestAndIndex(store, runId, summary, endedAtMs);
}

async function writeManifestAndIndex(
  store: ObjectStore,
  runId: string,
  summary: SuiteTestSummary,
  endedAtMs: number
): Promise<void> {
  const manifest = (await readStoreJson<SuiteManifest>(
    store,
    runManifestKey(runId)
  )) ?? {
    tests: [],
    updatedAtMs: 0,
  };
  const tests = upsertTestSummary(manifest.tests, summary);
  await writeUtf8(
    store,
    runManifestKey(runId),
    JSON.stringify({ tests, updatedAtMs: endedAtMs }),
    'application/json; charset=utf-8'
  );

  const index = (await readStoreJson<RunsIndex>(store, RUNS_INDEX_KEY)) ?? {
    runs: [],
  };
  const nextRuns = upsertRunSummary(index.runs, {
    id: runId,
    updatedAtMs: endedAtMs,
    status: tests.some((t) => t.status === 'failed') ? 'failed' : 'passed',
    testCount: tests.length,
    frameCount: tests.reduce((n, t) => n + t.frameCount, 0),
  });
  await writeUtf8(
    store,
    RUNS_INDEX_KEY,
    JSON.stringify({ runs: nextRuns }),
    'application/json; charset=utf-8'
  );

  const genRaw = await readStoreText(store, GENERATION_KEY);
  const next = (genRaw !== null ? Number(genRaw) || 0 : 0) + 1;
  await writeUtf8(
    store,
    GENERATION_KEY,
    String(next),
    'text/plain; charset=utf-8'
  );
}
