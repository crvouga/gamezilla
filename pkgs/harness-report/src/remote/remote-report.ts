/**
 * A commit's report, streamed from a reports API into a Solid store the
 * viewer renders as it grows: the test list fills in source by source, and
 * a test's steps and frame files stream in the first time it is opened.
 * Transport and time are injected; nothing here touches a global.
 */

import type { Timers } from '@pkgs/clock';
import type {
  HtmlReportBlob,
  HtmlReportTest,
  ReportTestStatus,
  RunReportMeta,
} from '@pkgs/harness';
import type { HttpClient } from '@pkgs/http-client';
import { type Accessor, batch, createSignal } from 'solid-js';
import { createStore, produce, type SetStoreFunction } from 'solid-js/store';

import type { ReportTestLoader, TestLoad } from '../app/report-context';
import type { ReportData } from '../types';
import { splitViewerTestId, viewerTestId } from './keys';
import {
  type CommitEvent,
  type CommitRecord,
  type SourceRecord,
  SseDecoder,
  type TestEvent,
} from './protocol';

/** Wait before reconnecting a stream that failed. */
const RETRY_MS = 3_000;

export type RemoteReportArgs = {
  readonly http: HttpClient;
  readonly timers: Timers;
  /** The reports API root (`https://api.example.com/api/reports`). */
  readonly apiBase: string;
  readonly sha: string;
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
  return 'passed';
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
  readonly controller: AbortController;
};

const LOADING: TestLoad = { kind: 'loading', frames: 0, framesTotal: null };

function reportUrl(ctx: Ctx, path: string): string {
  return `${ctx.args.apiBase}/${ctx.args.sha}${path}`;
}

function disposed(ctx: Ctx): boolean {
  return ctx.controller.signal.aborted;
}

function addSource(ctx: Ctx, record: SourceRecord): void {
  if (ctx.sources.has(record.source)) return;
  ctx.sources.add(record.source);
  ctx.setStore(
    'data',
    produce((data) => {
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
      await new Promise<void>((resolve) => {
        ctx.args.timers.setTimeout(resolve, RETRY_MS);
      });
    }
  }
}

async function loadFrameCss(ctx: Ctx): Promise<void> {
  try {
    const response = await ctx.args.http.fetch(reportUrl(ctx, '/frame.css'), {
      signal: ctx.controller.signal,
    });
    ctx.setFrameCss(response.ok ? await response.text() : '');
  } catch {
    if (!disposed(ctx)) ctx.setFrameCss('');
  }
}

/**
 * Collects one test's stream and lands it in the store in one batch at the
 * end, so the viewer never paints a test whose frames are still arriving.
 */
function testCollector(ctx: Ctx, id: string): (event: TestEvent) => void {
  const blobs: Record<string, HtmlReportBlob> = {};
  let steps: HtmlReportTest['report']['steps'] | null = null;
  let total: number | null = null;
  return (event) => {
    if (event.type === 'report') {
      steps = event.report.steps;
      total = countFrameFiles(event.report.steps);
    } else if (event.type === 'blob') {
      blobs[event.file] = event.blob;
    }
    if (event.type !== 'end') {
      const frames = Object.keys(blobs).length;
      ctx.setStore('loads', id, {
        kind: 'loading',
        frames,
        framesTotal: total,
      });
      return;
    }
    const loaded = steps;
    if (!event.found || loaded === null) {
      ctx.setStore('loads', id, { kind: 'missing' });
      return;
    }
    batch(() => {
      const index = ctx.store.data.tests.findIndex(
        (t) => t.report.meta.testId === id
      );
      if (index >= 0) {
        ctx.setStore('data', 'tests', index, 'report', 'steps', loaded);
        ctx.setStore('data', 'tests', index, 'blobs', blobs);
      }
      ctx.setStore('loads', id, { kind: 'ready' });
    });
  };
}

async function streamTest(ctx: Ctx, id: string): Promise<void> {
  const parts = splitViewerTestId(id);
  if (parts === null) {
    ctx.setStore('loads', id, { kind: 'missing' });
    return;
  }
  try {
    const path = `/tests/${encodeURIComponent(parts.source)}/${encodeURIComponent(parts.testId)}/events`;
    const response = await ctx.args.http.fetch(reportUrl(ctx, path), {
      signal: ctx.controller.signal,
    });
    await readEventStream<TestEvent>(response, testCollector(ctx, id));
  } catch (error) {
    if (disposed(ctx)) return;
    ctx.setStore('loads', id, {
      kind: 'error',
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

function testLoader(ctx: Ctx): ReportTestLoader {
  return {
    load(id) {
      const current = ctx.store.loads[id];
      if (current !== undefined && current.kind !== 'error') return;
      ctx.setStore('loads', id, LOADING);
      void streamTest(ctx, id);
    },
    state(id) {
      const known = ctx.store.data.tests.some(
        (t) => t.report.meta.testId === id
      );
      if (!known) {
        const settled = ctx.phase() === 'complete' || ctx.phase() === 'missing';
        return settled ? { kind: 'missing' } : LOADING;
      }
      const load = ctx.store.loads[id];
      // Snapshots paint into a shell styled once: wait for the stylesheet.
      if (load?.kind === 'ready' && ctx.frameCss() === undefined)
        return LOADING;
      return load ?? LOADING;
    },
  };
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
      status: 'passed',
      updatedAtMs: 0,
      tests: [],
    },
    loads: {},
  });
  const [commit, setCommit] = createSignal<CommitRecord | null>(null);
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
    controller: new AbortController(),
  };
  void followCommit(ctx);
  void loadFrameCss(ctx);
  return {
    data: store.data,
    commit,
    phase,
    frameCss,
    loader: testLoader(ctx),
    dispose: () => ctx.controller.abort(),
  };
}

function countFrameFiles(steps: HtmlReportTest['report']['steps']): number {
  const files = new Set<string>();
  const walk = (list: HtmlReportTest['report']['steps']): void => {
    for (const step of list) {
      for (const frame of step.frames) {
        for (const blob of frame.snapshots) files.add(blob.file);
      }
      walk(step.steps);
    }
  };
  walk(steps);
  return files.size;
}
