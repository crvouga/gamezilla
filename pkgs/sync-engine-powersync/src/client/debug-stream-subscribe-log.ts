import type { PowerSyncDatabasePort } from './powersync-database-port';

const DEBUG_ENDPOINT =
  'http://127.0.0.1:7505/ingest/04ddb12b-5950-419d-86ab-fa995e703320';

function postDebugLog(payload: Record<string, unknown>): void {
  fetch(DEBUG_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Debug-Session-Id': 'c605ca',
    },
    body: JSON.stringify({
      sessionId: 'c605ca',
      runId: 'post-fix',
      timestamp: Date.now(),
      ...payload,
    }),
  }).catch(() => {});
}

function readStreamDebug(
  db: PowerSyncDatabasePort,
  streamName: string,
  parameters: Readonly<Record<string, string | number>>
) {
  const status = db.currentStatus as {
    readonly syncStreams?: readonly {
      readonly subscription: {
        readonly name: string;
        readonly parameters: unknown;
        readonly hasSynced: boolean;
        readonly active: boolean;
      };
      readonly progress?: {
        readonly totalOperations: number;
        readonly downloadedOperations: number;
        readonly downloadedFraction: number;
      } | null;
    }[];
    readonly dataFlowStatus?: {
      readonly downloadError?: unknown;
      readonly downloading?: boolean;
    };
    readonly downloadProgress?: {
      readonly downloadedOperations?: number;
      readonly totalOperations?: number;
    } | null;
  };
  const downloadError = status.dataFlowStatus?.downloadError;
  const allStreams = (status.syncStreams ?? []).map((s) => ({
    name: s.subscription.name,
    parameters: s.subscription.parameters,
    hasSynced: s.subscription.hasSynced,
    active: s.subscription.active,
    progress: s.progress ?? null,
  }));
  return {
    streamName,
    parameters,
    // H-X: full stream list shows whether non-puzzle streams finish while
    // chess stays at 0/N (replication of full chess_puzzles wedging downloads).
    streamSummary: allStreams.map((s) => ({
      name: s.name,
      hasSynced: s.hasSynced,
      active: s.active,
      total: s.progress?.totalOperations ?? null,
      downloaded: s.progress?.downloadedOperations ?? null,
    })),
    chessStreams: allStreams.filter((s) => s.name === 'chess_puzzles'),
    downloadError:
      downloadError === undefined || downloadError === null
        ? null
        : String(downloadError),
    downloading: status.dataFlowStatus?.downloading ?? null,
    downloadProgress: status.downloadProgress ?? null,
  };
}

/** Temporary debug instrumentation for chess puzzle stream stalls. */
export function attachStreamWaitDebugLogs(args: {
  readonly db: PowerSyncDatabasePort;
  readonly streamName: string;
  readonly parameters: Readonly<Record<string, string | number>>;
  readonly waitForFirstSync: (abort?: AbortSignal) => Promise<void>;
}): (abort?: AbortSignal) => Promise<void> {
  const { db, streamName, parameters, waitForFirstSync } = args;
  postDebugLog({
    hypothesisId: 'H-M',
    location: 'debug-stream-subscribe-log.ts:subscribe',
    message: 'powersync stream subscribed',
    data: readStreamDebug(db, streamName, parameters),
  });
  return async (abort?: AbortSignal) => {
    const startedAt = Date.now();
    const timer = setInterval(() => {
      postDebugLog({
        hypothesisId: 'H-M/H-X',
        location: 'debug-stream-subscribe-log.ts:wait-progress',
        message: 'stream wait progress',
        data: {
          ...readStreamDebug(db, streamName, parameters),
          waitedMs: Date.now() - startedAt,
          aborted: abort?.aborted ?? false,
        },
      });
    }, 3000);
    try {
      await waitForFirstSync(abort);
      postDebugLog({
        hypothesisId: 'H-M',
        location: 'debug-stream-subscribe-log.ts:wait-done',
        message: 'stream wait finished',
        data: {
          ...readStreamDebug(db, streamName, parameters),
          waitedMs: Date.now() - startedAt,
          aborted: abort?.aborted ?? false,
        },
      });
    } finally {
      clearInterval(timer);
    }
  };
}
