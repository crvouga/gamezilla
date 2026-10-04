import { useDeviceId } from '@libs/auth-client/use-device-id';
import { useMutationClient } from '@pkgs/sync-engine-client/mutation-client-context';
import { useTimers } from '@pkgs/clock-client/solid';
import sql from '@pkgs/sql-shared/sql';
import { createQuery, useSyncEngine } from '@pkgs/sync-engine-client/sync-engine-context';
import { createEffect, onCleanup } from 'solid-js';

import { closeEndedOpenSessionsMutation } from '@libs/spaces-shared/close-ended-open-sessions-mutation';

type EndedSessionRow = {
  readonly space_id: string;
};

/**
 * When sync delivers `ended_at` for a still-open session, delete the
 * session row so rooms/miniplayer drop.
 */
export function ReconcileEndedOpenSessions(): null {
  const { paintReady } = useSyncEngine();
  const deviceId = useDeviceId();
  const mutationClient = useMutationClient();
  const timers = useTimers();
  const runningRef = { current: false };
  const query = createQuery(() =>
    paintReady()
      ? sql<EndedSessionRow>`
          SELECT o.space_id
          FROM spaces_open_sessions AS o
          INNER JOIN spaces AS s ON s.id = o.space_id
          WHERE o.deleted_at IS NULL
            AND o.device_id = ${deviceId()}
            AND s.ended_at IS NOT NULL
        `
      : sql<EndedSessionRow>`
          SELECT space_id FROM spaces_open_sessions WHERE false
        `
  );

  createEffect(() => {
    const rows = query.rows();
    if (!paintReady() || rows.length === 0 || runningRef.current) return;
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
    onCleanup(() => {
      cancelled = true;
      timers.clearTimeout(timeoutId);
      runningRef.current = false;
    });
  });

  return null;
}
