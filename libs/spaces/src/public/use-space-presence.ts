import { useMyId } from '@libs/auth/public/use-current-user';
import { useDeviceId } from '@libs/auth/public/use-device-id';
import { type Sql, sql } from '@pkgs/sql';

import { createQuery, useSyncEngine } from '@pkgs/sync-engine/solid';
import { type Accessor, createMemo } from 'solid-js';

import {
  resolveSpacePresence,
  type SpacePresence,
} from '../shared/space/resolve-space-presence';

export type { SpacePresence };

type PresenceRow = {
  readonly host_member_id: string | null;
  readonly host_account_id: string | null;
  readonly ended_at: string | null;
  readonly is_open: number | null;
  readonly is_member: number | null;
};

function presenceSql(
  spaceId: string,
  enabled: boolean,
  deviceId: string,
  memberId: string
): Sql<PresenceRow> {
  if (!enabled) {
    return sql<PresenceRow>`
      SELECT
        CAST(NULL AS TEXT) AS host_member_id,
        CAST(NULL AS TEXT) AS host_account_id,
        CAST(NULL AS TEXT) AS ended_at,
        CAST(NULL AS INTEGER) AS is_open,
        CAST(NULL AS INTEGER) AS is_member
      WHERE false
    `;
  }
  return sql<PresenceRow>`
    SELECT
      s.host_member_id,
      s.host_account_id,
      s.ended_at,
      CASE WHEN o.space_id IS NOT NULL THEN 1 ELSE 0 END AS is_open,
      CASE
        WHEN s.host_member_id = ${memberId}
          OR s.host_account_id = ${memberId}
          OR EXISTS (
            SELECT 1 FROM spaces_users AS u
            WHERE u.space_id = s.id
              AND u.user_id = ${memberId}
              AND u.deleted_at IS NULL
          )
        THEN 1
        ELSE 0
      END AS is_member
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
export function useSpacePresence(
  spaceId: string | Accessor<string>
): Accessor<SpacePresence> {
  const memberId = useMyId();
  const deviceId = useDeviceId();
  const { paintReady } = useSyncEngine();
  const resolveId = (): string =>
    typeof spaceId === 'string' ? spaceId : spaceId();
  const spaceEnabled = createMemo(() => paintReady() && resolveId().length > 0);
  const query = createQuery(() =>
    presenceSql(resolveId(), spaceEnabled(), deviceId(), memberId())
  );
  const row = createMemo(() => query.rows()[0] ?? null);
  return createMemo<SpacePresence>(() => {
    if (!paintReady()) {
      return { status: 'loading' };
    }
    const current = row();
    return resolveSpacePresence({
      spaceEnabled: resolveId().length > 0,
      spaceLoading: query.isLoading(),
      spaceRow:
        current === null
          ? null
          : {
              host_member_id: current.host_member_id,
              host_account_id: current.host_account_id,
              ended_at: current.ended_at,
            },
      isOpenLocally: current?.is_open === 1,
      isMember: current?.is_member === 1,
      myId: memberId(),
    });
  });
}
