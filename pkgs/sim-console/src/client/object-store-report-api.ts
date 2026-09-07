/**
 * ReportApiClient backed by a read-only ObjectStore (static `public/reports`).
 * Polls instead of SSE so the console needs no report server.
 */

import type { Timers } from '@pkgs/clock';
import type { ObjectStore } from '@pkgs/object-store/interface';

import type {
  RunSummary,
  SimulationReportData,
  SimulationReportEvent,
  SimulationReportTopology,
  SuiteManifest,
} from '../types';
import { LATEST_RUN_ID } from '../types';
import { runManifestKey, testReportKey } from '../writer/keys';
import {
  loadRunsIndex,
  readGeneration,
  storeGetJson,
} from '../writer/store-io';
import type {
  BucketInfo,
  EventSourceHandle,
  ReportApiClient,
} from './api-client';

const LOCAL_BUCKET: BucketInfo = { id: 'local', label: 'Local' };
const POLL_MS = 1_500;

export type CreateObjectStoreReportApiClientOptions = {
  readonly store: ObjectStore;
  /** Public URL base for frame assets, e.g. `/reports` (no trailing slash). */
  readonly publicBaseUrl: string;
  readonly fetch: ReportApiClient['fetch'];
  readonly timers: Timers;
};

function resolveRunId(
  runId: string,
  runs: readonly RunSummary[]
): string | null {
  if (runId === LATEST_RUN_ID) {
    return runs[0]?.id ?? null;
  }
  return runs.some((r) => r.id === runId) ? runId : null;
}

function framePublicUrl(args: {
  readonly publicBaseUrl: string;
  readonly runId: string;
  readonly testId: string;
  readonly frameFile: string;
}): string {
  const parts = `runs/${args.runId}/tests/${args.testId}/${args.frameFile}`
    .split('/')
    .filter(Boolean)
    .map(encodeURIComponent)
    .join('/');
  return `${args.publicBaseUrl}/${parts}`;
}

async function publishBucketSnapshot(args: {
  readonly store: ObjectStore;
  readonly runId: string | null;
  readonly testId: string | null;
  readonly handlers: Parameters<
    ReportApiClient['openBucketEvents']
  >[0]['handlers'];
}): Promise<void> {
  const [generation, index] = await Promise.all([
    readGeneration(args.store),
    loadRunsIndex(args.store),
  ]);
  const runs = index.runs;
  args.handlers.onRuns?.({ generation, runs });
  if (args.runId == null) return;

  const resolvedRunId = resolveRunId(args.runId, runs);
  if (resolvedRunId == null) {
    args.handlers.onManifest?.({
      resolvedRunId: null,
      tests: [],
      updatedAtMs: 0,
      missing: true,
    });
    if (args.testId != null) {
      args.handlers.onTest?.({
        resolvedRunId: null,
        missing: true,
        data: null,
      });
    }
    return;
  }

  await publishManifestAndTest({
    store: args.store,
    resolvedRunId,
    testId: args.testId,
    handlers: args.handlers,
  });
}

async function publishManifestAndTest(args: {
  readonly store: ObjectStore;
  readonly resolvedRunId: string;
  readonly testId: string | null;
  readonly handlers: Parameters<
    ReportApiClient['openBucketEvents']
  >[0]['handlers'];
}): Promise<void> {
  const manifest =
    (await storeGetJson<SuiteManifest>(
      args.store,
      runManifestKey(args.resolvedRunId)
    )) ?? ({ tests: [], updatedAtMs: 0 } satisfies SuiteManifest);

  args.handlers.onManifest?.({
    resolvedRunId: args.resolvedRunId,
    tests: manifest.tests,
    updatedAtMs: manifest.updatedAtMs,
    missing: false,
  });

  if (args.testId == null) return;

  const data = await storeGetJson<SimulationReportData>(
    args.store,
    testReportKey(args.resolvedRunId, args.testId)
  );
  args.handlers.onTest?.({
    resolvedRunId: args.resolvedRunId,
    missing: !data,
    data,
  });
}

function openStoreBucketEvents(args: {
  readonly store: ObjectStore;
  readonly timers: Timers;
  readonly runId: string | null;
  readonly testId: string | null;
  readonly handlers: Parameters<
    ReportApiClient['openBucketEvents']
  >[0]['handlers'];
}): EventSourceHandle {
  let stopped = false;
  let timer: unknown = null;

  const publish = async () => {
    if (stopped) return;
    try {
      await publishBucketSnapshot({
        store: args.store,
        runId: args.runId,
        testId: args.testId,
        handlers: args.handlers,
      });
    } catch {
      args.handlers.onError?.(new Event('error'));
    }
  };

  void publish();
  timer = args.timers.setInterval(() => {
    void publish();
  }, POLL_MS);

  return {
    close: () => {
      stopped = true;
      if (timer != null) args.timers.clearInterval(timer);
    },
  };
}

/**
 * ObjectStore-backed report client for the pure client-side sim console.
 */
export function createObjectStoreReportApiClient(
  options: CreateObjectStoreReportApiClientOptions
): ReportApiClient {
  const { store, publicBaseUrl, fetch, timers } = options;

  return {
    basePath: publicBaseUrl,
    fetch,
    testFrameUrl: (_bucketId, runId, testId, frameFile) =>
      framePublicUrl({ publicBaseUrl, runId, testId, frameFile }),
    openBucketsEvents(args) {
      args.onBuckets([LOCAL_BUCKET]);
      return { close: () => undefined };
    },
    openBucketEvents(args) {
      return openStoreBucketEvents({
        store,
        timers,
        handlers: args.handlers,
        runId: args.runId ?? null,
        testId: args.testId ?? null,
      });
    },
    async deleteRunApi() {
      // Static bundle — delete is a no-op (re-run tests to overwrite).
    },
    async pruneBucket() {
      return [];
    },
    fetchTestTopology(bucketId, runId, testId) {
      void bucketId;
      return storeGetJson<SimulationReportTopology>(
        store,
        `runs/${runId}/tests/${testId}/topology.json`
      );
    },
    async fetchTestEvents(bucketId, runId, testId) {
      void bucketId;
      return (
        (await storeGetJson<readonly SimulationReportEvent[]>(
          store,
          `runs/${runId}/tests/${testId}/events.json`
        )) ?? []
      );
    },
  };
}
