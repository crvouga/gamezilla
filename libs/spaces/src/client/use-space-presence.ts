import {
  useMyDeviceId,
  useMyId,
} from '@libs/auth/client/use-current-user';
import { useWatchOne } from '@pkgs/sync-engine/client/sync-engine-context';

import { spaceParticipationEntityId } from '../shared/membership-key';
import {
  SpaceCol,
  SpaceParticipationCol,
  SPACES_TABLE,
  SPACE_PARTICIPATIONS_TABLE,
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
  readonly host_member_id: string | null;
  readonly ended_at: string | null;
};

type ParticipationRow = {
  readonly id: string;
};

const SPACE_SELECT = `SELECT ${SpaceCol.hostMemberId} AS host_member_id,
         ${SpaceCol.endedAt} AS ended_at
         FROM ${SPACES_TABLE.tableName}`;

const PARTICIPATION_SELECT = `SELECT ${SpaceParticipationCol.id} AS id
           FROM ${SPACE_PARTICIPATIONS_TABLE.tableName}`;

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
 * Resolves whether this install is in `spaceId` via local device participation.
 * Role uses member id (`accountId ?? deviceId`) vs `host_member_id`.
 */
export function useSpacePresence(spaceId: string): SpacePresence {
  const deviceId = useMyDeviceId();
  const memberId = useMyId();
  const spaceEnabled = spaceId.length > 0;
  const memberEnabled = spaceEnabled && deviceId.length > 0;
  const participationId = memberEnabled
    ? spaceParticipationEntityId(deviceId, spaceId)
    : '';

  const { row: spaceRow, isLoading: spaceLoading } = useWatchOne<SpaceRow>(
    spaceEnabled
      ? `${SPACE_SELECT} WHERE ${SpaceCol.id} = ?`
      : `${SPACE_SELECT} WHERE 0`,
    spaceEnabled ? [spaceId] : []
  );

  const { row: guestRow, isLoading: guestLoading } =
    useWatchOne<ParticipationRow>(
      memberEnabled
        ? `${PARTICIPATION_SELECT} WHERE ${SpaceParticipationCol.id} = ? AND ${SpaceParticipationCol.leftAt} IS NULL`
        : `${PARTICIPATION_SELECT} WHERE 0`,
      memberEnabled ? [participationId] : []
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
      myId: memberId,
    })
  );
}
