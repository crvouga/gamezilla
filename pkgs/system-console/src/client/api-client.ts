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

/**
 * Report HTTP/SSE client bound to a mounted console app. All URLs are prefixed
 * with `basePath`; REST calls go through the injected `fetch`.
 */
export function createReportApiClient(
  options: CreateReportApiClientOptions
): ReportApiClient {
  const { basePath, fetch } = options;

  const testFrameUrl: ReportApiClient['testFrameUrl'] = (
    bucketId,
    runId,
    testId,
    frameFile
  ) => {
    const parts = `tests/${testId}/${frameFile}`
      .split('/')
      .filter(Boolean)
      .map(encodeURIComponent)
      .join('/');
    return `${basePath}/api/buckets/${encodeURIComponent(bucketId)}/runs/${encodeURIComponent(runId)}/data/${parts}`;
  };

  async function fetchTestJson<T>(
    bucketId: string,
    runId: string,
    testId: string,
    file: string,
    onMissing: T
  ): Promise<T> {
    const res = await fetch(testFrameUrl(bucketId, runId, testId, file));
    if (res.status === 404) return onMissing;
    if (!res.ok) throw new Error(`${file} ${res.status}`);
    return (await res.json()) as T;
  }

  return {
    basePath,
    testFrameUrl,

    openBucketsEvents(args) {
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
    },

    openBucketEvents(args) {
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
    },

    async deleteRunApi(bucketId, runId) {
      const res = await fetch(
        `${basePath}/api/buckets/${encodeURIComponent(bucketId)}/runs/${encodeURIComponent(runId)}`,
        { method: 'DELETE' }
      );
      if (!res.ok) throw new Error(`delete run ${res.status}`);
    },

    async pruneBucket(bucketId, body) {
      const res = await fetch(
        `${basePath}/api/buckets/${encodeURIComponent(bucketId)}/prune`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        }
      );
      if (!res.ok) throw new Error(`prune ${res.status}`);
      const data = (await res.json()) as { deleted: string[] };
      return data.deleted;
    },

    fetchTestTopology(bucketId, runId, testId) {
      return fetchTestJson<SimulationReportTopology | null>(
        bucketId,
        runId,
        testId,
        'topology.json',
        null
      );
    },

    fetchTestEvents(bucketId, runId, testId) {
      return fetchTestJson<readonly SimulationReportEvent[]>(
        bucketId,
        runId,
        testId,
        'events.json',
        []
      );
    },
  };
}

export type { RunSummary, SuiteTestSummary };
