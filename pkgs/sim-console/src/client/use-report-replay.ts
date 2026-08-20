import { useEffect, useState } from 'react';

import type { PlaygroundSession, SimConsolePorts } from '../shared/ports';
import type { ReportApiClient } from './api-client';
import type { FlatFrame } from './frames';
import {
  checkpointFromReportFrame,
  frameIsHydratable,
} from './report-replay-hydrate';

export type ReportReplayStatus =
  | 'booting'
  | 'hydrating'
  | 'ready'
  | 'unrestorable'
  | 'error';

export type ReportReplay = {
  readonly session: PlaygroundSession | null;
  readonly status: ReportReplayStatus;
  readonly error: string | null;
};

export function useReportReplay(args: {
  readonly ports: SimConsolePorts;
  readonly frame: FlatFrame | null;
  readonly api: ReportApiClient;
  readonly bucketId: string;
  readonly runId: string;
  readonly testId: string;
}): ReportReplay {
  const [session, setSession] = useState<PlaygroundSession | null>(null);
  const [status, setStatus] = useState<ReportReplayStatus>('booting');
  const [error, setError] = useState<string | null>(null);

  useBootReplaySession({
    ports: args.ports,
    setSession,
    setStatus,
    setError,
  });
  useHydrateReplayFrame({
    ports: args.ports,
    session,
    frame: args.frame,
    api: args.api,
    bucketId: args.bucketId,
    runId: args.runId,
    testId: args.testId,
    setStatus,
    setError,
  });

  return { session, status, error };
}

function useBootReplaySession(args: {
  readonly ports: SimConsolePorts;
  readonly setSession: (s: PlaygroundSession | null) => void;
  readonly setStatus: (s: ReportReplayStatus) => void;
  readonly setError: (e: string | null) => void;
}): void {
  const { ports, setSession, setStatus, setError } = args;
  useEffect(() => {
    let cancelled = false;
    let live: PlaygroundSession | null = null;
    void ports
      .bootPlayground({ skipSnapshotLoad: true })
      .then((next) => {
        if (cancelled) {
          void next.dispose();
          return;
        }
        live = next;
        setSession(next);
        setStatus('hydrating');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
        setStatus('error');
      });
    return () => {
      cancelled = true;
      setSession(null);
      if (live !== null) void live.dispose();
    };
  }, [ports, setSession, setStatus, setError]);
}

function useHydrateReplayFrame(args: {
  readonly ports: SimConsolePorts;
  readonly session: PlaygroundSession | null;
  readonly frame: FlatFrame | null;
  readonly api: ReportApiClient;
  readonly bucketId: string;
  readonly runId: string;
  readonly testId: string;
  readonly setStatus: (s: ReportReplayStatus) => void;
  readonly setError: (e: string | null) => void;
}): void {
  const {
    session,
    frame,
    api,
    bucketId,
    runId,
    testId,
    ports,
    setStatus,
    setError,
  } = args;
  useEffect(() => {
    if (session == null) return;
    if (frame == null || !frameIsHydratable(frame)) {
      setStatus('unrestorable');
      return;
    }
    let cancelled = false;
    setStatus('hydrating');
    void hydrateFrame({
      session,
      frame,
      api,
      bucketId,
      runId,
      testId,
      fetch: (input, init) => ports.fetch(input, init),
    })
      .then(() => {
        if (!cancelled) {
          setError(null);
          setStatus('ready');
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [
    session,
    frame,
    api,
    bucketId,
    runId,
    testId,
    ports,
    setStatus,
    setError,
  ]);
}

async function hydrateFrame(args: {
  readonly session: PlaygroundSession;
  readonly frame: FlatFrame;
  readonly api: ReportApiClient;
  readonly bucketId: string;
  readonly runId: string;
  readonly testId: string;
  readonly fetch: SimConsolePorts['fetch'];
}): Promise<void> {
  const checkpoint = await checkpointFromReportFrame(args);
  await args.session.restoreCheckpoint(checkpoint);
}
