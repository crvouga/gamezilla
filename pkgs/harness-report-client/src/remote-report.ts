/**
 * A commit's report, streamed from a reports API into a Solid store the
 * viewer renders as it grows: the test list fills in source by source, and
 * a test's steps and frame files stream in the first time it is opened.
 * Transport and time are injected; nothing here touches a global.
 */

import type { Timers } from '@pkgs/clock-shared/types';
import {
  splitViewerTestId,
  viewerTestId,
} from '@pkgs/harness-report-shared/keys';
import type {
  CommitEvent,
  CommitRecord,
  SourceRecord,
} from '@pkgs/harness-report-shared/protocol';
import { SseDecoder } from '@pkgs/harness-report-shared/protocol';
import type { ReportData } from '@pkgs/harness-report-shared/types';
import type {
  HtmlReportBlob,
  HtmlReportTest,
} from '@pkgs/harness-root-shared/bundle';
import type {
  ReportTestStatus,
  RunReportMeta,
} from '@pkgs/harness-root-shared/report-types';
import type { HttpClient } from '@pkgs/http-client-shared/types';
import { type Accessor, batch, createSignal } from 'solid-js';
import { createStore, produce, type SetStoreFunction } from 'solid-js/store';
import type { ReportFetcher } from './fetcher';
import type { ReportTestLoader, TestLoad } from './report-context';

/** Wait before reconnecting a stream that failed. */
const RETRY_MS = 3_000;

export type RemoteReportArgs = {
  readonly http: HttpClient;
  readonly timers: Timers;
  /** The reports API root (`https://api.example.com/api/reports`). */
  readonly apiBase: string;
  readonly sha: string;
  /** Cached reads (sources, stylesheet, one test, one frame file). */
  readonly fetcher: ReportFetcher;
};

export type RemoteReportPhase =
  | 'connecting'
  | 'live'
  | 'complete'
  | 'missing'
  | 'error';

export type RemoteReport = {
  readonly data: ReportData;
  readonly commit: Accessor<CommitRecord | null>;
  readonly phase: Accessor<RemoteReportPhase>;
  readonly sources: Accessor<readonly SourceRecord[]>;
  readonly frameCss: Accessor<string | undefined>;
  readonly loader: ReportTestLoader;
  readonly dispose: () => void;
};

/** Read an SSE response body, handing each message to `onEvent`. */
export async function readEventStream<T>(
  response: Response,
  onEvent: (event: T) => void
): Promise<void> {
  if (!response.ok || response.body === null) {
    throw new Error(`reports API answered ${String(response.status)}`);
  }
  const reader = response.body.getReader();
  const text = new TextDecoder();
  const decoder = new SseDecoder<T>();
  for (;;) {
    const { value, done } = await reader.read();
    if (done) return;
    for (const event of decoder.push(text.decode(value, { stream: true }))) {
      onEvent(event);
    }
  }
}

function worstStatus(tests: readonly HtmlReportTest[]): ReportTestStatus {
  const statuses = tests.map((t) => t.report.meta.status);
  if (statuses.includes('failed')) return 'failed';
  if (statuses.length > 0 && statuses.every((s) => s === 'skipped')) {
    return 'skipped';
  }
  return statuses.length === 0 ? 'skipped' : 'passed';
}

function stubTest(source: string, meta: RunReportMeta): StreamedTest {
  return {
    report: {
      meta: { ...meta, testId: viewerTestId(source, meta.testId) },
      steps: [],
    },
    blobs: {},
  };
}

function reportLabel(sha: string, commit: CommitRecord | null): string {
  const short = sha.slice(0, 9);
  return commit === null ? short : `${short} · ${commit.branch}`;
}

/** {@link ReportData}, writable so the store can grow it in place. */
type StreamedTest = {
  report: { meta: RunReportMeta; steps: HtmlReportTest['report']['steps'] };
  blobs: Record<string, HtmlReportBlob>;
};
type StreamedData = {
  title: string;
  runId: string;
  status: ReportTestStatus;
  updatedAtMs: number;
  tests: StreamedTest[];
};
type Store = {
  data: StreamedData;
  loads: Record<string, TestLoad>;
};

/** Everything one open report shares: its store, signals and transport. */
type Ctx = {
  readonly args: RemoteReportArgs;
  readonly store: Store;
  readonly setStore: SetStoreFunction<Store>;
  readonly setCommit: (commit: CommitRecord | null) => void;
  readonly phase: Accessor<RemoteReportPhase>;
  readonly setPhase: (phase: RemoteReportPhase) => void;
  readonly frameCss: Accessor<string | undefined>;
  readonly setFrameCss: (css: string) => void;
  /** Sources already in the store; sent as `?have=` on reconnect. */
  readonly sources: Set<string>;
  readonly records: Map<string, SourceRecord>;
  readonly addRecord: (record: SourceRecord) => void;
  /** Frame files already being fetched, so a scrub does not refetch. */
  readonly inflight: Set<string>;
  readonly controller: AbortController;
};

const LOADING: TestLoad = { kind: 'loading', frames: 0, framesTotal: null };

function reportUrl(ctx: Ctx, path: string): string {
  return `${ctx.args.apiBase}/${ctx.args.sha}${path}`;
}

function disposed(ctx: Ctx): boolean {
  return ctx.controller.signal.aborted;
}

function addSource(ctx: Ctx, record: SourceRecord, authoritative = true): void {
  if (!authoritative && ctx.sources.has(record.source)) return;
  if (authoritative) ctx.sources.add(record.source);
  if (JSON.stringify(ctx.records.get(record.source)) === JSON.stringify(record))
    return;
  ctx.records.set(record.source, record);
  ctx.addRecord(record);
  for (const test of ctx.store.data.tests) {
    if (splitViewerTestId(test.report.meta.testId)?.source === record.source)
      ctx.setStore('loads', test.report.meta.testId, undefined!);
  }
  ctx.setStore(
    'data',
    produce((data) => {
      data.tests = data.tests.filter(
        (test) =>
          splitViewerTestId(test.report.meta.testId)?.source !== record.source
      );
      for (const meta of record.tests) {
        data.tests.push(stubTest(record.source, meta));
      }
      data.status = worstStatus(data.tests);
      data.updatedAtMs = Math.max(data.updatedAtMs, record.updatedAtMs);
    })
  );
}

function onCommitEvent(ctx: Ctx, event: CommitEvent): void {
  if (event.type === 'commit') {
    ctx.setCommit(event.commit);
    ctx.setStore('data', 'runId', reportLabel(ctx.args.sha, event.commit));
    if (event.commit?.endedAtMs != null) {
      ctx.setStore('data', 'updatedAtMs', event.commit.endedAtMs);
    }
    return;
  }
  if (event.type === 'source') {
    ctx.setPhase('live');
    addSource(ctx, event.source);
    return;
  }
  ctx.setPhase(event.state === 'running' ? 'live' : event.state);
}

/** Follow the commit stream, reconnecting until it is complete or missing. */
async function followCommit(ctx: Ctx): Promise<void> {
  while (!disposed(ctx)) {
    const have = [...ctx.sources].join(',');
    const query = have === '' ? '' : `?have=${encodeURIComponent(have)}`;
    let ended = false;
    try {
      const response = await ctx.args.http.fetch(
        reportUrl(ctx, `/events${query}`),
        { signal: ctx.controller.signal }
      );
      await readEventStream<CommitEvent>(response, (event) => {
        if (event.type === 'end') ended = true;
        onCommitEvent(ctx, event);
      });
    } catch {
      ended = false;
    }
    if (disposed(ctx)) return;
    if (ctx.phase() === 'complete' || ctx.phase() === 'missing') return;
    // A stream cut short (no `end`) is a failure: back off, then resume.
    if (!ended) {
      ctx.setPhase('error');
      await waitForReconnect(ctx);
    }
  }
}

function waitForReconnect(ctx: Ctx): Promise<void> {
  return new Promise((resolve) => {
    const signal = ctx.controller.signal;
    const finish = () => {
      ctx.args.timers.clearTimeout(timer);
      signal.removeEventListener('abort', finish);
      resolve();
    };
    const timer = ctx.args.timers.setTimeout(finish, RETRY_MS);
    signal.addEventListener('abort', finish, { once: true });
    if (signal.aborted) finish();
  });
}

function testIndex(ctx: Ctx, id: string): number {
  return ctx.store.data.tests.findIndex((t) => t.report.meta.testId === id);
}

/** The timeline only. Frame files arrive later, one at a time, as they paint. */
async function loadTest(ctx: Ctx, id: string): Promise<void> {
  const parts = splitViewerTestId(id);
  if (parts === null) {
    ctx.setStore('loads', id, { kind: 'missing' });
    return;
  }
  try {
    const report = await ctx.args.fetcher.test(
      ctx.args.sha,
      parts.source,
      parts.testId
    );
    if (disposed(ctx)) return;
    if (report === null) {
      ctx.setStore('loads', id, { kind: 'missing' });
      return;
    }
    batch(() => {
      const index = testIndex(ctx, id);
      if (index >= 0) {
        ctx.setStore('data', 'tests', index, 'report', 'steps', report.steps);
      }
      ctx.setStore('loads', id, { kind: 'ready' });
    });
  } catch (error) {
    if (disposed(ctx)) return;
    ctx.setStore('loads', id, {
      kind: 'error',
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

async function loadBlob(ctx: Ctx, id: string, file: string): Promise<void> {
  const key = `${id}\n${file}`;
  if (ctx.inflight.has(key)) return;
  const index = testIndex(ctx, id);
  if (index < 0 || ctx.store.data.tests[index]?.blobs[file] !== undefined) {
    return;
  }
  const parts = splitViewerTestId(id);
  if (parts === null) return;
  ctx.inflight.add(key);
  try {
    const blob = await ctx.args.fetcher.blob(
      ctx.args.sha,
      parts.source,
      parts.testId,
      file
    );
    if (!disposed(ctx) && blob !== null) {
      const at = testIndex(ctx, id);
      if (at >= 0) ctx.setStore('data', 'tests', at, 'blobs', file, blob);
    }
  } catch {
    // The file can be asked for again. A 404 is not remembered.
  } finally {
    ctx.inflight.delete(key);
  }
}

function testLoader(ctx: Ctx): ReportTestLoader {
  return {
    load(id) {
      const current = ctx.store.loads[id];
      if (current !== undefined && current.kind !== 'error') return;
      ctx.setStore('loads', id, LOADING);
      void loadTest(ctx, id);
    },
    ensureBlob(id, file) {
      void loadBlob(ctx, id, file);
    },
    state(id) {
      const known = ctx.store.data.tests.some(
        (t) => t.report.meta.testId === id
      );
      if (!known) {
        const settled = ctx.phase() === 'complete' || ctx.phase() === 'missing';
        return settled ? { kind: 'missing' } : LOADING;
      }
      return ctx.store.loads[id] ?? LOADING;
    },
  };
}

/** Sources and the snapshot stylesheet, from the query cache when it has them. */
async function loadCached(ctx: Ctx): Promise<void> {
  try {
    const [sources, css] = await Promise.allSettled([
      ctx.args.fetcher.sources(ctx.args.sha),
      ctx.args.fetcher.frameCss(ctx.args.sha),
    ]);
    if (disposed(ctx)) return;
    if (sources.status === 'fulfilled')
      for (const source of sources.value) addSource(ctx, source, false);
    ctx.setFrameCss(css.status === 'fulfilled' ? css.value : '');
    if (
      sources.status === 'fulfilled' &&
      sources.value.length > 0 &&
      ctx.phase() === 'connecting'
    )
      ctx.setPhase('live');
  } catch {
    if (!disposed(ctx) && ctx.frameCss() === undefined) ctx.setFrameCss('');
  }
}

/**
 * Open a commit's report. The commit stream reconnects on its own (sending
 * the sources it already holds) until the commit is complete or missing.
 */
export function createRemoteReport(args: RemoteReportArgs): RemoteReport {
  const [store, setStore] = createStore<Store>({
    data: {
      title: 'Spec report',
      runId: reportLabel(args.sha, null),
      status: 'skipped',
      updatedAtMs: 0,
      tests: [],
    },
    loads: {},
  });
  const [commit, setCommit] = createSignal<CommitRecord | null>(null);
  const [records, setRecords] = createSignal<readonly SourceRecord[]>([]);
  const [phase, setPhase] = createSignal<RemoteReportPhase>('connecting');
  const [frameCss, setFrameCss] = createSignal<string | undefined>();
  const ctx: Ctx = {
    args,
    store,
    setStore,
    setCommit,
    phase,
    setPhase,
    frameCss,
    setFrameCss,
    sources: new Set(),
    records: new Map(),
    addRecord: (record) =>
      setRecords((previous) => [
        ...previous.filter((source) => source.source !== record.source),
        record,
      ]),
    inflight: new Set(),
    controller: new AbortController(),
  };
  void followCommit(ctx);
  void loadCached(ctx);
  return {
    data: store.data,
    commit,
    phase,
    sources: records,
    frameCss,
    loader: testLoader(ctx),
    dispose: () => ctx.controller.abort(),
  };
}
