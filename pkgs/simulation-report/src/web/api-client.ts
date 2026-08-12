import type {
  RunSummary,
  RunsIndex,
  SimulationReportData,
  SuiteManifest,
  SuiteTestSummary,
} from '../types';
import { reportFetch } from './wall';

export type BucketInfo = {
  readonly id: string;
  readonly label: string;
};

export async function fetchBuckets(): Promise<readonly BucketInfo[]> {
  const res = await reportFetch('/api/buckets');
  if (!res.ok) throw new Error(`buckets ${res.status}`);
  return res.json() as Promise<readonly BucketInfo[]>;
}

export async function fetchRuns(bucketId: string): Promise<RunsIndex> {
  const res = await reportFetch(
    `/api/buckets/${encodeURIComponent(bucketId)}/runs`
  );
  if (!res.ok) throw new Error(`runs ${res.status}`);
  return res.json() as Promise<RunsIndex>;
}

export async function fetchGeneration(bucketId: string): Promise<number> {
  const res = await reportFetch(
    `/api/buckets/${encodeURIComponent(bucketId)}/generation`
  );
  if (!res.ok) throw new Error(`generation ${res.status}`);
  const data = (await res.json()) as { generation: number };
  return data.generation;
}

export async function fetchManifest(
  bucketId: string,
  runId: string
): Promise<SuiteManifest> {
  const res = await reportFetch(
    `/api/buckets/${encodeURIComponent(bucketId)}/runs/${encodeURIComponent(runId)}/manifest`
  );
  if (!res.ok) throw new Error(`manifest ${res.status}`);
  return res.json() as Promise<SuiteManifest>;
}

export async function fetchTest(
  bucketId: string,
  runId: string,
  testId: string
): Promise<SimulationReportData> {
  const res = await reportFetch(
    `/api/buckets/${encodeURIComponent(bucketId)}/runs/${encodeURIComponent(runId)}/tests/${encodeURIComponent(testId)}`
  );
  if (!res.ok) throw new Error(`test ${testId} ${res.status}`);
  return res.json() as Promise<SimulationReportData>;
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

export type { RunSummary, SuiteTestSummary };
