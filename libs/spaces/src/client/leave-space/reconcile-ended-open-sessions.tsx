import { sql } from '@pkgs/sql';
import {
  useSyncEngine,
  useWatchQuery,
} from '@pkgs/sync-engine/client/sync-engine-context';
import { useSyncEnginePaintReady } from '@pkgs/sync-engine/client/sync-engine-paint-gate';
import { useEffect, useMemo, type ReactNode } from 'react';

import { closeEndedSpaceSessions } from '../../shared/open-space/space-open-session-write';

type EndedSessionRow = {
  readonly id: string;
};

/**
 * When sync delivers `ended_at` for a still-open local session, delete the
 * session row so rooms/miniplayer drop without a Kv dual-write.
 */
export function ReconcileEndedOpenSessions(): ReactNode {
  const paintReady = useSyncEnginePaintReady();
  const engine = useSyncEngine();
  const query = useMemo(
    () =>
      paintReady
        ? sql<EndedSessionRow>`
            SELECT o.id
            FROM local_space_open_sessions AS o
            INNER JOIN spaces AS s ON s.id = o.id
            WHERE s.ended_at IS NOT NULL
          `
        : sql<EndedSessionRow>`
            SELECT id FROM local_space_open_sessions WHERE false
          `,
    [paintReady]
  );
  const { rows } = useWatchQuery(query);

  useEffect(() => {
    if (!paintReady || rows.length === 0) return;
    void engine.db.transaction(async (tx) => {
      await closeEndedSpaceSessions(tx);
    });
  }, [paintReady, rows, engine]);

  return null;
}
