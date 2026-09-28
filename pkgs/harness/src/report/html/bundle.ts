/**
 * Everything the standalone HTML report needs, read out of one run bucket.
 * Pure over an ObjectStore — no filesystem access here.
 */

import { readObjectBytes } from '@pkgs/object-store/helpers';
import type { ObjectStore } from '@pkgs/object-store/interface';

import {
  runManifestKey,
  testFrameKey,
  testPrefix,
  testReportKey,
} from '../keys';
import { readStoreJson, suiteStatus } from '../persist';
import type {
  ReportStep,
  ReportTestStatus,
  RunReport,
  SuiteManifest,
} from '../types';

/** One embedded frame file: text media inline, binary media as base64. */
export type HtmlReportBlob = {
  readonly contentType: string;
  readonly text?: string;
  readonly base64?: string;
};

export type HtmlReportTest = {
  readonly report: RunReport;
  /** Keyed by the blob's `file` (relative to the test dir). */
  readonly blobs: Readonly<Record<string, HtmlReportBlob>>;
};

export type HtmlReportBundle = {
  readonly runId: string;
  readonly status: ReportTestStatus;
  readonly updatedAtMs: number;
  readonly tests: readonly HtmlReportTest[];
};

const TEXT_MEDIA = new Set(['html', 'json', 'text']);

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

function collectBlobFiles(
  steps: readonly ReportStep[],
  out: Map<string, string>
): void {
  for (const step of steps) {
    for (const frame of step.frames) {
      for (const blob of frame.snapshots) out.set(blob.file, blob.media);
    }
    collectBlobFiles(step.steps, out);
  }
}

async function readTestBlobs(
  store: ObjectStore,
  runId: string,
  report: RunReport
): Promise<Record<string, HtmlReportBlob>> {
  const files = new Map<string, string>();
  collectBlobFiles(report.steps, files);
  const blobs: Record<string, HtmlReportBlob> = {};
  for (const [file, media] of files) {
    const key = testFrameKey(runId, report.meta.testId, file);
    const obj = await store.get(key);
    if (obj === null) continue;
    const bytes = await readObjectBytes(store, key);
    if (bytes === null) continue;
    blobs[file] = TEXT_MEDIA.has(media)
      ? { contentType: obj.contentType, text: new TextDecoder().decode(bytes) }
      : { contentType: obj.contentType, base64: bytesToBase64(bytes) };
  }
  return blobs;
}

/** `runs/<runId>/tests/<testId>/report.json` → `<testId>`, else null. */
function reportTestId(runId: string, key: string): string | null {
  const head = `${testPrefix(runId, '')}`;
  const tail = '/report.json';
  if (!key.startsWith(head) || !key.endsWith(tail)) return null;
  const testId = key.slice(head.length, key.length - tail.length);
  return testId.length > 0 && !testId.includes('/') ? testId : null;
}

/**
 * Read one run (`runs/<runId>/…`) into an in-memory bundle. The tests are the
 * `report.json` files under the run, not the manifest's list: `bun test
 * --parallel` workers each read-modify-write the manifest, so it can lose a
 * test another worker wrote at the same moment; a report file cannot.
 */
export async function readRunBundle(
  store: ObjectStore,
  runId: string
): Promise<HtmlReportBundle> {
  const manifest = await readStoreJson<SuiteManifest>(
    store,
    runManifestKey(runId)
  );
  const testIds = (await store.listKeys(testPrefix(runId, '')))
    .map((key) => reportTestId(runId, key))
    .filter((id): id is string => id !== null);
  const tests: HtmlReportTest[] = [];
  for (const testId of testIds) {
    const report = await readStoreJson<RunReport>(
      store,
      testReportKey(runId, testId)
    );
    if (report === null) continue;
    tests.push({ report, blobs: await readTestBlobs(store, runId, report) });
  }
  return {
    runId,
    status: suiteStatus(tests.map((t) => t.report.meta)),
    updatedAtMs: Math.max(
      manifest?.updatedAtMs ?? 0,
      ...tests.map((t) => t.report.meta.endedAtMs)
    ),
    tests,
  };
}

/**
 * Fold several runs into one bundle — one report over every package's e2e
 * suite. Each test id is prefixed with its run's label (`libs/chess`), since
 * two packages may both name a test `monkey`.
 */
export function mergeRunBundles(
  runId: string,
  runs: readonly { readonly label: string; readonly bundle: HtmlReportBundle }[]
): HtmlReportBundle {
  const tests = runs.flatMap(({ label, bundle }) =>
    bundle.tests.map((test) => ({
      ...test,
      report: {
        ...test.report,
        meta: {
          ...test.report.meta,
          testId: `${label}/${test.report.meta.testId}`,
        },
      },
    }))
  );
  return {
    runId,
    status: suiteStatus(tests.map((t) => t.report.meta)),
    updatedAtMs: Math.max(0, ...runs.map((r) => r.bundle.updatedAtMs)),
    tests,
  };
}
