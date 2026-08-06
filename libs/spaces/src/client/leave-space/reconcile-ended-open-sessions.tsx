import { useMutationClient } from '@libs/auth/client/mutation-client-provider';
import { sql } from '@pkgs/sql';
import { useQuery } from '@pkgs/sync-engine/client/sync-engine-context';
import { useSyncEnginePaintReady } from '@pkgs/sync-engine/client/sync-engine-paint-gate';
import { useEffect, useMemo, useRef, type ReactNode } from 'react';

import { closeEndedOpenSessionsMutation } from '../../shared/mutations/space-mutations';

type EndedSessionRow = {
  readonly space_id: string;
};

/**
 * When sync delivers `ended_at` for a still-open session, delete the
 * session row so rooms/miniplayer drop.
 */
export function ReconcileEndedOpenSessions(): ReactNode {
  const paintReady = useSyncEnginePaintReady();
  const mutationClient = useMutationClient();
  const runningRef = useRef(false);
  const query = useMemo(
    () =>
      paintReady
        ? sql<EndedSessionRow>`
            SELECT o.space_id
            FROM space_open_sessions AS o
            INNER JOIN spaces AS s ON s.id = o.space_id
            WHERE s.ended_at IS NOT NULL
          `
        : sql<EndedSessionRow>`
            SELECT space_id FROM space_open_sessions WHERE false
          `,
    [paintReady]
  );
  const { rows } = useQuery(query);

  useEffect(() => {
    if (!paintReady || rows.length === 0 || runningRef.current) return;
    runningRef.current = true;
    void mutationClient
      .mutate(closeEndedOpenSessionsMutation, {})
      .finally(() => {
        runningRef.current = false;
      });
  }, [paintReady, rows, mutationClient]);

  return null;
}
