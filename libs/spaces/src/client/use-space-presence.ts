import { useMyDeviceId } from '@libs/auth/client/use-current-user';
import { useWatchOne } from '@pkgs/sync-engine/client/sync-engine-context';

import { spaceDeviceMembershipEntityId } from '../shared/membership-key';
import {
  SpaceCol,
  SpaceMembershipCol,
  SPACES_TABLE,
  SPACE_MEMBERSHIPS_TABLE,
} from '@libs/db/shared/space-tables';
import {
  latchStaleSpacePresence,
  resolveSpacePresence,
  type SpacePresence,
} from '../shared/resolve-space-presence';
import {
  readSpacePresenceLatch,
  writeSpacePresenceLatch,
} from '../shared/space-presence-latch-store';

export type { SpacePresence };

type SpaceRow = {
  readonly host_id: string | null;
  readonly ended_at: string | null;
};

type GuestMembershipRow = {
  readonly id: string;
};

const SPACE_SELECT = `SELECT ${SpaceCol.hostId} AS host_id, ${SpaceCol.endedAt} AS ended_at
         FROM ${SPACES_TABLE.tableName}`;

const GUEST_SELECT = `SELECT ${SpaceMembershipCol.id} AS id
           FROM ${SPACE_MEMBERSHIPS_TABLE.tableName}`;

function applyPresenceLatch(
  spaceId: string,
  resolved: SpacePresence
): SpacePresence {
  const latched = latchStaleSpacePresence(
    spaceId,
    resolved,
    readSpacePresenceLatch(spaceId)
  );
  writeSpacePresenceLatch(spaceId, latched.latch?.presence ?? null);
  return latched.presence;
}

/**
 * Resolves whether this install is in `spaceId` using targeted sync
 * queries for that space only (not the global membership list).
 */
export function useSpacePresence(spaceId: string): SpacePresence {
  const deviceId = useMyDeviceId();
  const spaceEnabled = spaceId.length > 0;
  const memberEnabled = spaceEnabled && deviceId.length > 0;
  const membershipId = memberEnabled
    ? spaceDeviceMembershipEntityId(deviceId, spaceId)
    : '';

  const { row: spaceRow, isLoading: spaceLoading } = useWatchOne<SpaceRow>(
    spaceEnabled
      ? `${SPACE_SELECT} WHERE ${SpaceCol.id} = ?`
      : `${SPACE_SELECT} WHERE 0`,
    spaceEnabled ? [spaceId] : []
  );

  const { row: guestRow, isLoading: guestLoading } =
    useWatchOne<GuestMembershipRow>(
      memberEnabled
        ? `${GUEST_SELECT} WHERE ${SpaceMembershipCol.id} = ? AND ${SpaceMembershipCol.leftAt} IS NULL`
        : `${GUEST_SELECT} WHERE 0`,
      memberEnabled ? [membershipId] : []
    );

  return applyPresenceLatch(
    spaceId,
    resolveSpacePresence({
      spaceEnabled,
      spaceLoading,
      spaceRow,
      memberEnabled,
      guestLoading,
      guestRow,
      myId: deviceId,
    })
  );
}
