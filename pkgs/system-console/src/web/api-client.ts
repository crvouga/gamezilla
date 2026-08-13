import type {
  RunSummary,
  SimulationReportData,
  SimulationReportEvent,
  SimulationReportTopology,
  SuiteTestSummary,
} from '../types';
import { reportFetch } from './wall';

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

/** Global SSE: bucket registry. */
export function openBucketsEvents(args: {
  readonly onBuckets: (buckets: readonly BucketInfo[]) => void;
  readonly onError?: (err: Event) => void;
}): EventSourceHandle {
  const es = new EventSource('/api/events');
  es.addEventListener('buckets', (ev) => {
    try {
      const data = JSON.parse((ev as MessageEvent).data) as BucketInfo[];
      args.onBuckets(data);
    } catch {
      /* ignore bad payload */
    }
  });
  es.onerror = (err) => args.onError?.(err);
  return { close: () => es.close() };
}

/** Per-bucket SSE: runs (+ optional manifest/test). */
export function openBucketEvents(args: {
  readonly bucketId: string;
  readonly runId?: string | null;
  readonly testId?: string | null;
  readonly handlers: BucketEventsHandlers;
}): EventSourceHandle {
  const params = new URLSearchParams();
  if (args.runId) params.set('run', args.runId);
  if (args.testId) params.set('test', args.testId);
  const qs = params.toString();
  const url = `/api/buckets/${encodeURIComponent(args.bucketId)}/events${
    qs ? `?${qs}` : ''
  }`;
  const es = new EventSource(url);
  const { handlers } = args;

  es.addEventListener('runs', (ev) => {
    try {
      handlers.onRuns?.(JSON.parse((ev as MessageEvent).data) as RunsEvent);
    } catch {
      /* ignore */
    }
  });
  es.addEventListener('manifest', (ev) => {
    try {
      handlers.onManifest?.(
        JSON.parse((ev as MessageEvent).data) as ManifestEvent
      );
    } catch {
      /* ignore */
    }
  });
  es.addEventListener('test', (ev) => {
    try {
      handlers.onTest?.(JSON.parse((ev as MessageEvent).data) as TestEvent);
    } catch {
      /* ignore */
    }
  });
  es.onerror = (err) => handlers.onError?.(err);
  return { close: () => es.close() };
}

export async function deleteRunApi(
  bucketId: string,
  runId: string
): Promise<void> {
  const res = await reportFetch(
    `/api/buckets/${encodeURIComponent(bucketId)}/runs/${encodeURIComponent(runId)}`,
    { method: 'DELETE' }
  );
  if (!res.ok) throw new Error(`delete run ${res.status}`);
}

export async function pruneBucket(
  bucketId: string,
  body: { keepLast?: number; olderThanMs?: number }
): Promise<readonly string[]> {
  const res = await reportFetch(
    `/api/buckets/${encodeURIComponent(bucketId)}/prune`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) throw new Error(`prune ${res.status}`);
  const data = (await res.json()) as { deleted: string[] };
  return data.deleted;
}

export function testFrameUrl(
  bucketId: string,
  runId: string,
  testId: string,
  frameFile: string
): string {
  const parts = `tests/${testId}/${frameFile}`
    .split('/')
    .filter(Boolean)
    .map(encodeURIComponent)
    .join('/');
  return `/api/buckets/${encodeURIComponent(bucketId)}/runs/${encodeURIComponent(runId)}/data/${parts}`;
}

function testDataUrl(
  bucketId: string,
  runId: string,
  testId: string,
  file: string
): string {
  return testFrameUrl(bucketId, runId, testId, file);
}

export async function fetchTestTopology(
  bucketId: string,
  runId: string,
  testId: string
): Promise<SimulationReportTopology | null> {
  const res = await reportFetch(
    testDataUrl(bucketId, runId, testId, 'topology.json')
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`topology ${res.status}`);
  return (await res.json()) as SimulationReportTopology;
}

export async function fetchTestEvents(
  bucketId: string,
  runId: string,
  testId: string
): Promise<readonly SimulationReportEvent[]> {
  const res = await reportFetch(
    testDataUrl(bucketId, runId, testId, 'events.json')
  );
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`events ${res.status}`);
  return (await res.json()) as SimulationReportEvent[];
}

export type { RunSummary, SuiteTestSummary };
