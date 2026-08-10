import { useMyAccountId } from '@libs/auth/client/use-current-user';
import { useDeviceId } from '@libs/auth/client/use-device-id';
import { type Sql, sql } from '@pkgs/sql';

import { useQuery, useSyncEngine } from '@pkgs/sync-engine/client';
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

function presenceSql(
  spaceId: string,
  enabled: boolean,
  deviceId: string
): Sql<PresenceRow> {
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
      CASE WHEN o.space_id IS NOT NULL THEN 1 ELSE 0 END AS is_open
    FROM spaces AS s
    LEFT JOIN spaces_open_sessions AS o
      ON o.space_id = s.id
      AND o.deleted_at IS NULL
      AND o.device_id = ${deviceId}
    WHERE s.id = ${spaceId}
  `;
}

/**
 * Resolves whether this install has `spaceId` open.
 * One SQL watch joins `spaces` + this device's `spaces_open_sessions`.
 */
export function useSpacePresence(spaceId: string): SpacePresence {
  const accountId = useMyAccountId();
  const deviceId = useDeviceId();
  const { paintReady } = useSyncEngine();
  const spaceEnabled = paintReady && spaceId.length > 0;
  const query = useMemo(
    () => presenceSql(spaceId, spaceEnabled, deviceId),
    [spaceId, spaceEnabled, deviceId]
  );
  const { rows, isLoading } = useQuery(query);
  const row = rows[0] ?? null;
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
