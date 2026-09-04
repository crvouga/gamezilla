import type { Timers } from '@pkgs/clock';

import type { RunReport, RunSummary, SuiteManifest } from '../types';
import { LATEST_RUN_ID } from '../types';
import { runManifestKey, testReportKey } from '../writer/keys';
import {
  loadRunsIndex,
  readGeneration,
  storeGetJson,
} from '../writer/store-io';
import type { BucketSubscription, SseHub } from './sse-hub';
import type { ReportBucket } from './types';

const POLL_MS = 500;

export type BucketWatcher = {
  readonly stop: () => void;
  readonly publishNow: () => Promise<void>;
};

/**
 * Poll object-store generation and push SSE snapshots to subscribers of this
 * bucket. (No wall `fs.watch` — generation is the sole change signal.)
 */
export function startBucketWatcher(
  bucket: ReportBucket,
  hub: SseHub,
  timers: Timers
): BucketWatcher {
  let stopped = false;
  let pollTimer: unknown = null;
  let lastGeneration = -1;

  const publishNow = async () => {
    if (stopped) return;
    try {
      await publishBucketToSubscribers(bucket, hub);
      lastGeneration = await readGeneration(bucket.store);
    } catch {
      /* ignore publish errors */
    }
  };

  pollTimer = timers.setInterval(() => {
    void (async () => {
      if (stopped) return;
      try {
        const gen = await readGeneration(bucket.store);
        if (gen !== lastGeneration) {
          lastGeneration = gen;
          await publishBucketToSubscribers(bucket, hub);
        }
      } catch {
        /* ignore */
      }
    })();
  }, POLL_MS);

  void publishNow();

  return {
    stop: () => {
      stopped = true;
      if (pollTimer != null) timers.clearInterval(pollTimer);
    },
    publishNow,
  };
}

export async function publishBucketToSubscribers(
  bucket: ReportBucket,
  hub: SseHub
): Promise<void> {
  const subs = hub.bucketSubscribers(bucket.id);
  if (subs.length === 0) return;

  const [generation, index] = await Promise.all([
    readGeneration(bucket.store),
    loadRunsIndex(bucket.store),
  ]);
  const runs = index.runs;

  await Promise.all(
    subs.map((sub) => publishToSubscriber(bucket, sub, generation, runs))
  );
}

async function publishToSubscriber(
  bucket: ReportBucket,
  sub: BucketSubscription,
  generation: number,
  runs: readonly RunSummary[]
): Promise<void> {
  sub.send('runs', { generation, runs });

  if (sub.runId == null) return;

  const resolvedRunId = resolveRunId(sub.runId, runs);
  if (resolvedRunId == null) {
    sub.send('manifest', {
      resolvedRunId: null,
      tests: [],
      updatedAtMs: 0,
      missing: true,
    });
    if (sub.testId != null) {
      sub.send('test', { resolvedRunId: null, missing: true, data: null });
    }
    return;
  }

  const manifest =
    (await storeGetJson<SuiteManifest>(
      bucket.store,
      runManifestKey(resolvedRunId)
    )) ?? ({ tests: [], updatedAtMs: 0 } satisfies SuiteManifest);

  sub.send('manifest', {
    resolvedRunId,
    tests: manifest.tests,
    updatedAtMs: manifest.updatedAtMs,
    missing: false,
  });

  if (sub.testId == null) return;

  const data = await storeGetJson<RunReport>(
    bucket.store,
    testReportKey(resolvedRunId, sub.testId)
  );
  if (!data) {
    sub.send('test', {
      resolvedRunId,
      missing: true,
      data: null,
    });
    return;
  }
  sub.send('test', {
    resolvedRunId,
    missing: false,
    data,
  });
}

function resolveRunId(
  runId: string,
  runs: readonly RunSummary[]
): string | null {
  if (runId === LATEST_RUN_ID) {
    return runs[0]?.id ?? null;
  }
  return runs.some((r) => r.id === runId) ? runId : null;
}
