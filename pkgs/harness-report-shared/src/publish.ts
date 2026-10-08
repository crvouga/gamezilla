import { performancePart } from './performance-part';
/**
 * Write side of the shared reports store: what CI runs after a spec suite.
 * Pure over two injected {@link ObjectStore}s — the local report bucket a
 * `bun test` run wrote (`runs/<runId>/tests/<testId>/…`) and the shared
 * store — so it runs the same against R2, Mockingbird S3 or memory.
 */

import type { HtmlReportTest } from '@pkgs/harness-root-shared/bundle';
import {
  applyJunitOutcomes,
  parseJunit,
} from '@pkgs/harness-root-shared/junit';
import {
  testFrameKey,
  testPrefix,
  testReportKey,
} from '@pkgs/harness-root-shared/keys';
import { suiteStatus } from '@pkgs/harness-root-shared/persist';
import type {
  ReportStep,
  ReportTestStatus,
  RunReport,
} from '@pkgs/harness-root-shared/report-types';
import { readUtf8, writeUtf8 } from '@pkgs/object-store-root-shared/helpers';
import type { ObjectStore } from '@pkgs/object-store-root-shared/interface';

import { bundleIndexKey, publishBundle } from './bundle';
import { eachLimited } from './completion-order';
import type { ReportPartOutput } from './explorer-types';
import {
  commitIndexKey,
  commitKey,
  frameCssKey,
  sourceId,
  sourceKey,
  sourceOfKey,
  sourcesPrefix,
} from './keys';
import type { CommitRecord, SourceRecord } from './protocol';
import { publicationStore } from './publication';
import { readCommit } from './read';
import { validatePart } from './report-parts';
import { publishSnapshotBundle } from './snapshot-bundle';
import type { SourceIdentity } from './source-content';
import {
  attachSource,
  readStoredSource,
  sourceContentPrefix,
} from './source-content';
import { sourceEntries } from './source-entries';

/** The run id every spec suite writes its bucket under. */
export const SPEC_RUN_ID = 'latest';
/** Parallel uploads per source. */
const WRITE_WIDTH = 32;
const JSON_TYPE = 'application/json; charset=utf-8';

export type OpenCommitArgs = {
  readonly sha: string;
  readonly branch: string;
  readonly runUrl: string | null;
  readonly startedAtMs: number;
  /** Stylesheet the commit's HTML snapshots render with. */
  readonly frameCss: string;
  /** Concurrent CI attempts own independent commit-local files. */
  readonly publicationId?: string;
};

/**
 * Mark a commit's run as started and list it (newest first). Its snapshot
 * stylesheet goes up first, so a test is viewable the moment it lands.
 */
export async function openCommit(
  store: ObjectStore,
  args: OpenCommitArgs
): Promise<CommitRecord> {
  const { frameCss, publicationId, ...fields } = args;
  const target =
    publicationId === undefined
      ? store
      : publicationStore(store, publicationId);
  await writeUtf8(
    target,
    frameCssKey(args.sha),
    frameCss,
    'text/css; charset=utf-8'
  );
  const commit: CommitRecord = {
    ...fields,
    state: 'running',
    endedAtMs: null,
    status: null,
  };
  await writeUtf8(
    target,
    commitKey(args.sha),
    JSON.stringify(commit),
    JSON_TYPE
  );
  await writeUtf8(
    store,
    commitIndexKey(args.sha, args.startedAtMs),
    JSON.stringify({ sha: args.sha }),
    JSON_TYPE
  );
  if (publicationId !== undefined)
    await writeUtf8(
      store,
      commitKey(args.sha),
      JSON.stringify({ publicationId }),
      JSON_TYPE
    );
  return commit;
}

/** `runs/<runId>/tests/<testId>/report.json` → `<testId>`, else null. */
function reportTestId(runId: string, key: string): string | null {
  const head = testPrefix(runId, '');
  const tail = '/report.json';
  if (!key.startsWith(head) || !key.endsWith(tail)) return null;
  const testId = key.slice(head.length, key.length - tail.length);
  return testId.length > 0 && !testId.includes('/') ? testId : null;
}

async function readTests(
  bucket: ObjectStore,
  runId: string
): Promise<HtmlReportTest[]> {
  const ids = (await bucket.listKeys(testPrefix(runId, '')))
    .map((key) => reportTestId(runId, key))
    .filter((id): id is string => id !== null);
  const tests: HtmlReportTest[] = [];
  for (const id of ids) {
    const text = await readUtf8(bucket, testReportKey(runId, id));
    if (text === null) continue;
    tests.push({ report: JSON.parse(text) as RunReport, blobs: {} });
  }
  const junit = await readUtf8(bucket, 'junit.xml');
  if (junit === null) return tests;
  return [
    ...applyJunitOutcomes(
      { runId, status: 'passed', updatedAtMs: 0, tests },
      parseJunit(junit)
    ).tests,
  ];
}

function frameFiles(steps: readonly ReportStep[], out: Set<string>): void {
  for (const step of steps) {
    for (const frame of step.frames) {
      for (const blob of frame.snapshots) out.add(blob.file);
    }
    frameFiles(step.steps, out);
  }
}

export type PublishSourceArgs = {
  readonly sha: string;
  readonly packageDir: string;
  readonly bucket: string;
  /** The package's local report bucket (`.cache/harness-report/<bucket>`). */
  readonly local: ObjectStore;
  readonly runId?: string;
  /** Only a passing execution is reusable under its exact task hash. */
  readonly identity?: SourceIdentity;
  readonly status?: ReportTestStatus;
};

async function publishSnapshots(
  store: ObjectStore,
  args: PublishSourceArgs,
  tests: readonly HtmlReportTest[],
  contentPrefix: string
): Promise<void> {
  const runId = args.runId ?? SPEC_RUN_ID;
  await eachLimited(tests, 8, async ({ report }) => {
    const files = new Set<string>();
    frameFiles(report.steps, files);
    await publishSnapshotBundle({
      local: args.local,
      remote: store,
      localPrefix: testFrameKey(runId, report.meta.testId, ''),
      remotePrefix: `${contentPrefix}${report.meta.testId}/`,
      files: [...files],
    });
  });
}

/**
 * Copy one package bucket into the store: every test (runner outcomes
 * applied) and its frame files, then the source record, last, so a reader
 * that sees the record can read every test it names. Null when the bucket
 * recorded no test.
 */
export async function publishSource(
  store: ObjectStore,
  args: PublishSourceArgs
): Promise<SourceRecord | null> {
  const runId = args.runId ?? SPEC_RUN_ID;
  const source = sourceId(args.packageDir, args.bucket);
  const tests = await readTests(args.local, runId);
  if (
    tests.length === 0 &&
    args.identity === undefined &&
    args.status === undefined
  )
    return null;
  const metas = tests
    .map((t) => t.report.meta)
    .sort((a, b) => (a.testId < b.testId ? -1 : a.testId > b.testId ? 1 : 0));
  const status = args.status === 'failed' ? 'failed' : suiteStatus(metas);
  const contentPrefix =
    args.identity !== undefined && status === 'passed'
      ? sourceContentPrefix(args.identity, source)
      : null;
  if (contentPrefix === null) {
    await publishBundle(
      store,
      bundleIndexKey(args.sha, source),
      sourceEntries(args, source, tests, runId)
    );
  } else {
    await publishSnapshots(store, args, tests, contentPrefix);
    await eachLimited(tests, WRITE_WIDTH, async ({ report }) => {
      await writeUtf8(
        store,
        `${contentPrefix}${report.meta.testId}/report.json`,
        JSON.stringify(report),
        JSON_TYPE
      );
    });
  }
  const record: SourceRecord = {
    source,
    packageDir: args.packageDir,
    bucket: args.bucket,
    status,
    updatedAtMs: metas.reduce(
      (latest, meta) => Math.max(latest, meta.endedAtMs),
      0
    ),
    tests: metas,
    ...(await sourceEvidence(args.local, args.sha, source, tests)),
  };
  if (contentPrefix !== null) {
    await writeUtf8(
      store,
      `${contentPrefix}complete.json`,
      JSON.stringify(record),
      JSON_TYPE
    );
    await attachSource(store, { sha: args.sha, record, contentPrefix });
  } else {
    await writeUtf8(
      store,
      sourceKey(args.sha, source),
      JSON.stringify(record),
      JSON_TYPE
    );
  }
  return record;
}

async function sourceEvidence(
  local: ObjectStore,
  sha: string,
  source: string,
  tests: readonly HtmlReportTest[]
) {
  const raw = await readUtf8(local, 'part.json');
  const evidence: ReportPartOutput[] =
    raw === null ? [] : [JSON.parse(raw) as ReportPartOutput];
  if (
    !evidence.some(
      (part) => part.kind === 'ui-quality' || part.kind === 'performance'
    )
  ) {
    const { kind, title, checks } = performancePart({
      sha,
      recordedAtMs: 0,
      allowanceMs: 50,
      reports: tests.map((test) => test.report),
    });
    evidence.push({ kind, title, checks });
  }
  for (const part of evidence)
    validatePart({ ...part, sha, id: source, recordedAtMs: 0 });
  return { evidence };
}

export type CloseCommitArgs = {
  readonly sha: string;
  readonly endedAtMs: number;
  readonly publicationId?: string;
  readonly status?: ReportTestStatus;
};

/** Mark a commit's run complete, with the worst status of its sources. */
export async function closeCommit(
  store: ObjectStore,
  args: CloseCommitArgs
): Promise<CommitRecord> {
  if (args.publicationId !== undefined)
    store = publicationStore(store, args.publicationId);
  const open = await readCommit(store, args.sha);
  if (open === null) {
    throw new Error(`no open report for ${args.sha}; openCommit runs first`);
  }
  const sources = (await store.listKeys(sourcesPrefix(args.sha)))
    .map((key) => sourceOfKey(args.sha, key))
    .filter((s): s is string => s !== null);
  const statuses: SourceRecord[] = [];
  for (const s of sources) {
    const stored = await readStoredSource(store, args.sha, s);
    if (stored !== null) statuses.push(stored.record);
  }
  const closed: CommitRecord = {
    ...open,
    state: 'complete',
    endedAtMs: args.endedAtMs,
    status:
      args.status === 'failed'
        ? 'failed'
        : statuses.length === 0
          ? 'skipped'
          : suiteStatus(statuses),
  };
  await writeUtf8(
    store,
    commitKey(args.sha),
    JSON.stringify(closed),
    JSON_TYPE
  );
  return closed;
}
