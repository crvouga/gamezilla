import type { HttpFetch } from '@pkgs/http-client';

import type {
  RunSummary,
  SimulationReportData,
  SimulationReportEvent,
  SimulationReportTopology,
  SuiteTestSummary,
} from '../types';

export type BucketInfo = {
  readonly id: string;
  readonly label: string;
};

export type RunsEvent = {
  readonly generation: number;
  readonly runs: readonly RunSummary[];
};

export type ManifestEvent = {
  readonly resolvedRunId: string | null;
  readonly tests: readonly SuiteTestSummary[];
  readonly updatedAtMs: number;
  readonly missing: boolean;
};

export type TestEvent = {
  readonly resolvedRunId: string | null;
  readonly missing: boolean;
  readonly data: SimulationReportData | null;
};

export type BucketEventsHandlers = {
  readonly onRuns?: (event: RunsEvent) => void;
  readonly onManifest?: (event: ManifestEvent) => void;
  readonly onTest?: (event: TestEvent) => void;
  readonly onError?: (err: Event) => void;
};

export type EventSourceHandle = {
  readonly close: () => void;
};

export type CreateReportApiClientOptions = {
  /** Mounted console Hono base path (no trailing slash), e.g. `/system-console`. */
  readonly basePath: string;
  /** Injected fetch (from `io.http.fetch`); never a bare global. */
  readonly fetch: HttpFetch;
};

export type ReportApiClient = {
  readonly basePath: string;
  openBucketsEvents(args: {
    readonly onBuckets: (buckets: readonly BucketInfo[]) => void;
    readonly onError?: (err: Event) => void;
  }): EventSourceHandle;
  openBucketEvents(args: {
    readonly bucketId: string;
    readonly runId?: string | null;
    readonly testId?: string | null;
    readonly handlers: BucketEventsHandlers;
  }): EventSourceHandle;
  deleteRunApi(bucketId: string, runId: string): Promise<void>;
  pruneBucket(
    bucketId: string,
    body: { keepLast?: number; olderThanMs?: number }
  ): Promise<readonly string[]>;
  testFrameUrl(
    bucketId: string,
    runId: string,
    testId: string,
    frameFile: string
  ): string;
  fetchTestTopology(
    bucketId: string,
    runId: string,
    testId: string
  ): Promise<SimulationReportTopology | null>;
  fetchTestEvents(
    bucketId: string,
    runId: string,
    testId: string
  ): Promise<readonly SimulationReportEvent[]>;
};

function parse<T>(ev: Event): T {
  return JSON.parse((ev as MessageEvent).data) as T;
}

function testFrameUrl(args: {
  readonly basePath: string;
  readonly bucketId: string;
  readonly runId: string;
  readonly testId: string;
  readonly frameFile: string;
}): string {
  const parts = `tests/${args.testId}/${args.frameFile}`
    .split('/')
    .filter(Boolean)
    .map(encodeURIComponent)
    .join('/');
  return `${args.basePath}/api/buckets/${encodeURIComponent(args.bucketId)}/runs/${encodeURIComponent(args.runId)}/data/${parts}`;
}

async function fetchTestJson<T>(args: {
  readonly fetch: HttpFetch;
  readonly url: string;
  readonly file: string;
  readonly onMissing: T;
}): Promise<T> {
  const res = await args.fetch(args.url);
  if (res.status === 404) return args.onMissing;
  if (!res.ok) throw new Error(`${args.file} ${res.status}`);
  return (await res.json()) as T;
}

function openBucketsEvents(
  basePath: string,
  args: {
    readonly onBuckets: (buckets: readonly BucketInfo[]) => void;
    readonly onError?: (err: Event) => void;
  }
): EventSourceHandle {
  const es = new EventSource(`${basePath}/api/events`);
  es.addEventListener('buckets', (ev) => {
    try {
      args.onBuckets(parse<BucketInfo[]>(ev));
    } catch {
      /* ignore bad payload */
    }
  });
  es.onerror = (err) => args.onError?.(err);
  return { close: () => es.close() };
}

function openBucketEvents(
  basePath: string,
  args: {
    readonly bucketId: string;
    readonly runId?: string | null;
    readonly testId?: string | null;
    readonly handlers: BucketEventsHandlers;
  }
): EventSourceHandle {
  const params = new URLSearchParams();
  if (args.runId) params.set('run', args.runId);
  if (args.testId) params.set('test', args.testId);
  const qs = params.toString();
  const url = `${basePath}/api/buckets/${encodeURIComponent(args.bucketId)}/events${
    qs ? `?${qs}` : ''
  }`;
  const es = new EventSource(url);
  const { handlers } = args;
  es.addEventListener('runs', (ev) => {
    try {
      handlers.onRuns?.(parse<RunsEvent>(ev));
    } catch {
      /* ignore */
    }
  });
  es.addEventListener('manifest', (ev) => {
    try {
      handlers.onManifest?.(parse<ManifestEvent>(ev));
    } catch {
      /* ignore */
    }
  });
  es.addEventListener('test', (ev) => {
    try {
      handlers.onTest?.(parse<TestEvent>(ev));
    } catch {
      /* ignore */
    }
  });
  es.onerror = (err) => handlers.onError?.(err);
  return { close: () => es.close() };
}

async function deleteRunApi(args: {
  readonly fetch: HttpFetch;
  readonly basePath: string;
  readonly bucketId: string;
  readonly runId: string;
}): Promise<void> {
  const res = await args.fetch(
    `${args.basePath}/api/buckets/${encodeURIComponent(args.bucketId)}/runs/${encodeURIComponent(args.runId)}`,
    { method: 'DELETE' }
  );
  if (!res.ok) throw new Error(`delete run ${res.status}`);
}

async function pruneBucket(args: {
  readonly fetch: HttpFetch;
  readonly basePath: string;
  readonly bucketId: string;
  readonly body: { keepLast?: number; olderThanMs?: number };
}): Promise<readonly string[]> {
  const res = await args.fetch(
    `${args.basePath}/api/buckets/${encodeURIComponent(args.bucketId)}/prune`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(args.body),
    }
  );
  if (!res.ok) throw new Error(`prune ${res.status}`);
  const data = (await res.json()) as { deleted: string[] };
  return data.deleted;
}

/**
 * Report HTTP/SSE client bound to a mounted console app. All URLs are prefixed
 * with `basePath`; REST calls go through the injected `fetch`.
 */
export function createReportApiClient(
  options: CreateReportApiClientOptions
): ReportApiClient {
  const { basePath, fetch } = options;

  return {
    basePath,
    testFrameUrl: (bucketId, runId, testId, frameFile) =>
      testFrameUrl({ basePath, bucketId, runId, testId, frameFile }),
    openBucketsEvents: (args) => openBucketsEvents(basePath, args),
    openBucketEvents: (args) => openBucketEvents(basePath, args),
    deleteRunApi: (bucketId, runId) =>
      deleteRunApi({ fetch, basePath, bucketId, runId }),
    pruneBucket: (bucketId, body) =>
      pruneBucket({ fetch, basePath, bucketId, body }),
    fetchTestTopology(bucketId, runId, testId) {
      return fetchTestJson<SimulationReportTopology | null>({
        fetch,
        url: testFrameUrl({
          basePath,
          bucketId,
          runId,
          testId,
          frameFile: 'topology.json',
        }),
        file: 'topology.json',
        onMissing: null,
      });
    },
    fetchTestEvents(bucketId, runId, testId) {
      return fetchTestJson<readonly SimulationReportEvent[]>({
        fetch,
        url: testFrameUrl({
          basePath,
          bucketId,
          runId,
          testId,
          frameFile: 'events.json',
        }),
        file: 'events.json',
        onMissing: [],
      });
    },
  };
}

export type { RunSummary, SuiteTestSummary };
