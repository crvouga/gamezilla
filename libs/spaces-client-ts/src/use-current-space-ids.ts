import { useMyId } from '@libs/auth-client-ts/use-current-user';
import { useDeviceId } from '@libs/auth-client-ts/use-device-id';
import type { Sql } from '@pkgs/sql-root-shared-ts/sql';
import sql from '@pkgs/sql-root-shared-ts/sql';

import {
  createQuery,
  useSyncEngine,
} from '@pkgs/sync-engine-client-ts/sync-engine-context';
import { useMutationFeedback } from '@pkgs/sync-engine-client-ts/use-mutation-feedback';
import { type Accessor, createMemo, mapArray } from 'solid-js';
import type {
  CurrentSpaceEntry,
  CurrentSpaceRow,
} from './build-current-space-entries';
import { buildCurrentSpaceEntries } from './build-current-space-entries';

type SpaceRow = CurrentSpaceRow;

function currentSpacesSql(
  enabled: boolean,
  deviceId: string,
  memberId: string
): Sql<SpaceRow> {
  if (!enabled) {
    return sql<SpaceRow>`
      SELECT s.id, s.host_member_id, s.host_account_id, s.ended_at
      FROM spaces AS s
      WHERE false
    `;
  }
  return sql<SpaceRow>`
    SELECT s.id, s.host_member_id, s.host_account_id, s.ended_at
    FROM spaces AS s
    INNER JOIN spaces_open_sessions AS o
      ON o.space_id = s.id
      AND o.deleted_at IS NULL
      AND o.device_id = ${deviceId}
      AND o.participation_revision = (
        SELECT u.participation_revision FROM spaces_users AS u
        WHERE u.space_id = s.id AND u.user_id = ${memberId}
          AND u.deleted_at IS NULL AND u.joined = ${true}
      )
    WHERE s.ended_at IS NULL
      AND (
        s.host_member_id = ${memberId}
        OR s.host_account_id = ${memberId}
        OR EXISTS (
          SELECT 1 FROM spaces_users AS u
          WHERE u.space_id = s.id
            AND u.user_id = ${memberId}
            AND u.deleted_at IS NULL
            AND u.joined = ${true}
        )
      )
    ORDER BY o.opened_at DESC
  `;
}

/**
 * This install's locally-open live spaces (miniplayer).
 * Visibility is the SQL join of this device's open sessions × live spaces.
 */
export function useCurrentSpaceIds(): {
  readonly entries: Accessor<readonly CurrentSpaceEntry[]>;
  readonly isLoading: Accessor<boolean>;
} {
  const myId = useMyId();
  const deviceId = useDeviceId();
  const { paintReady } = useSyncEngine();
  const enabled = createMemo(
    () => paintReady() && myId().length > 0 && deviceId().length > 0
  );
  const query = createQuery(() =>
    currentSpacesSql(enabled(), deviceId(), myId())
  );
  const candidates = createMemo(() => {
    if (!paintReady()) return [];
    return buildCurrentSpaceEntries(query.rows(), myId());
  });
  const confirmations = mapArray(
    () => candidates().map((entry) => entry.spaceId),
    (spaceId) => ({
      spaceId,
      feedback: useMutationFeedback('joinSpace', () => ({ spaceId })),
    })
  );
  const entries = createMemo(() => {
    const known = new Set(
      confirmations()
        .filter(
          (entry) =>
            entry.feedback() === null ||
            entry.feedback()?.status === 'confirmed'
        )
        .map((entry) => entry.spaceId)
    );
    return candidates().filter(
      (entry) => entry.role === 'host' || known.has(entry.spaceId)
    );
  });
  const loading = createMemo(() => {
    if (!paintReady()) return true;
    return entries().length === 0 && query.isLoading();
  });

  return { entries, isLoading: loading };
}

/** User ids used for space host/guest checks. */
export function useReplicationIdentityIds(): Accessor<readonly string[]> {
  const myId = useMyId();
  return createMemo(() => (myId().length > 0 ? [myId()] : []));
}

export function isReplicationHost(
  hostId: string | null,
  identityIds: readonly string[]
): boolean {
  if (hostId === null || hostId.length === 0) return false;
  return identityIds.includes(hostId);
}
