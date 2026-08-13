import { type FSWatcher, watch } from 'node:fs';

import type { Timers } from '@pkgs/clock';

import type { RunSummary, SimulationReportData, SuiteManifest } from '../types';
import { LATEST_RUN_ID } from '../types';
import { runManifestKey, testStepsKey } from '../writer/keys';
import {
  loadRunsIndex,
  readGeneration,
  storeGetJson,
} from '../writer/store-io';
import type { BucketSubscription, SseHub } from './sse-hub';
import type { ReportBucket } from './types';

const FS_DEBOUNCE_MS = 50;
const S3_POLL_MS = 500;

export type BucketWatcher = {
  readonly stop: () => void;
  readonly publishNow: () => Promise<void>;
};

/**
 * Watch local FS (or poll generation for remote stores) and push SSE snapshots
 * to subscribers of this bucket.
 */
export function startBucketWatcher(
  bucket: ReportBucket,
  hub: SseHub,
  timers: Timers
): BucketWatcher {
  let stopped = false;
  let debounceTimer: unknown = null;
  let pollTimer: unknown = null;
  let fsWatcher: FSWatcher | null = null;
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

  const schedulePublish = () => {
    if (stopped) return;
    if (debounceTimer != null) timers.clearTimeout(debounceTimer);
    debounceTimer = timers.setTimeout(() => {
      debounceTimer = null;
      void publishNow();
    }, FS_DEBOUNCE_MS);
  };

  if (bucket.watchRoot) {
    try {
      fsWatcher = watch(bucket.watchRoot, { recursive: true }, () =>
        schedulePublish()
      );
      fsWatcher.on('error', () => {
        /* fall through — polling below still runs as backup for remote-like */
      });
    } catch {
      fsWatcher = null;
    }
  }

  // Always poll generation as a safety net (S3 primary; local backup).
  pollTimer = timers.setInterval(
    () => {
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
    },
    bucket.watchRoot ? Math.max(S3_POLL_MS * 4, 2000) : S3_POLL_MS
  );

  void publishNow();

  return {
    stop: () => {
      stopped = true;
      if (debounceTimer != null) timers.clearTimeout(debounceTimer);
      if (pollTimer != null) timers.clearInterval(pollTimer);
      fsWatcher?.close();
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

  const data = await storeGetJson<SimulationReportData>(
    bucket.store,
    testStepsKey(resolvedRunId, sub.testId)
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

export function resolveRunId(
  runId: string,
  runs: readonly RunSummary[]
): string | null {
  if (runId === LATEST_RUN_ID) {
    return runs[0]?.id ?? null;
  }
  return runs.some((r) => r.id === runId) ? runId : null;
}
