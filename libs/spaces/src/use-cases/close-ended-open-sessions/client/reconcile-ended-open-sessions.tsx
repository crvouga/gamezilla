import { useMutationClient } from '@libs/auth/public/mutation-client-provider';
import { useDeviceId } from '@libs/auth/public/use-device-id';
import { useTimers } from '@pkgs/clock';
import { sql } from '@pkgs/sql';
import { useQuery, useSyncEngine } from '@pkgs/sync-engine/client';
import { type ReactNode, useEffect, useMemo, useRef } from 'react';

import { closeEndedOpenSessionsMutation } from '../shared/close-ended-open-sessions-mutation';

type EndedSessionRow = {
  readonly space_id: string;
};

/**
 * When sync delivers `ended_at` for a still-open session, delete the
 * session row so rooms/miniplayer drop.
 */
export function ReconcileEndedOpenSessions(): ReactNode {
  const { paintReady } = useSyncEngine();
  const deviceId = useDeviceId();
  const mutationClient = useMutationClient();
  const timers = useTimers();
  const runningRef = useRef(false);
  const query = useMemo(
    () =>
      paintReady
        ? sql<EndedSessionRow>`
            SELECT o.space_id
            FROM spaces_open_sessions AS o
            INNER JOIN spaces AS s ON s.id = o.space_id
            WHERE o.deleted_at IS NULL
              AND o.device_id = ${deviceId}
              AND s.ended_at IS NOT NULL
          `
        : sql<EndedSessionRow>`
            SELECT space_id FROM spaces_open_sessions WHERE false
          `,
    [paintReady, deviceId]
  );
  const { rows } = useQuery(query);

  useEffect(() => {
    if (!paintReady || rows.length === 0 || runningRef.current) return;
    runningRef.current = true;
    let cancelled = false;
    const timeoutId = timers.setTimeout(() => {
      if (cancelled) return;
      void mutationClient
        .mutate(closeEndedOpenSessionsMutation, {})
        .finally(() => {
          if (!cancelled) runningRef.current = false;
        });
    }, 0);
    return () => {
      cancelled = true;
      timers.clearTimeout(timeoutId);
      runningRef.current = false;
    };
  }, [paintReady, rows, mutationClient, timers]);

  return null;
}
