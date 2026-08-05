import { useMyAccountId } from '@libs/auth/client/use-current-user';
import { sql, type Sql } from '@pkgs/sql';

import { useWatchOne } from '@pkgs/sync-engine/client/sync-engine-context';
import { useSyncEnginePaintReady } from '@pkgs/sync-engine/client/sync-engine-paint-gate';
import { useMemo } from 'react';

import {
  resolveSpacePresence,
  type SpacePresence,
} from '../shared/resolve-space-presence';

export type { SpacePresence };

type PresenceRow = {
  readonly host_member_id: string | null;
  readonly host_account_id: string | null;
  readonly ended_at: string | null;
  readonly is_open: number | null;
};

function presenceSql(spaceId: string, enabled: boolean): Sql<PresenceRow> {
  if (!enabled) {
    return sql<PresenceRow>`
      SELECT
        CAST(NULL AS TEXT) AS host_member_id,
        CAST(NULL AS TEXT) AS host_account_id,
        CAST(NULL AS TEXT) AS ended_at,
        CAST(NULL AS INTEGER) AS is_open
      WHERE false
    `;
  }
  return sql<PresenceRow>`
    SELECT
      s.host_member_id,
      s.host_account_id,
      s.ended_at,
      CASE WHEN o.id IS NOT NULL THEN 1 ELSE 0 END AS is_open
    FROM spaces AS s
    LEFT JOIN local_space_open_sessions AS o ON o.id = s.id
    WHERE s.id = ${spaceId}
  `;
}

/**
 * Resolves whether this account has `spaceId` open locally.
 * One SQL watch joins `spaces` + `local_space_open_sessions`.
 */
export function useSpacePresence(spaceId: string): SpacePresence {
  const accountId = useMyAccountId();
  const paintReady = useSyncEnginePaintReady();
  const spaceEnabled = paintReady && spaceId.length > 0;
  const query = useMemo(
    () => presenceSql(spaceId, spaceEnabled),
    [spaceId, spaceEnabled]
  );
  const { row, isLoading } = useWatchOne(query);
  if (!paintReady) {
    return { status: 'loading' };
  }
  return resolveSpacePresence({
    spaceEnabled: spaceId.length > 0,
    spaceLoading: isLoading,
    spaceRow:
      row === null
        ? null
        : {
            host_member_id: row.host_member_id,
            host_account_id: row.host_account_id,
            ended_at: row.ended_at,
          },
    isOpenLocally: row?.is_open === 1,
    myId: accountId ?? '',
  });
}
