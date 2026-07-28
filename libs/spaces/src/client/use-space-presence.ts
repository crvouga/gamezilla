import { useMyAccountId } from '@libs/auth/client/use-current-user';
import { honey, type Sql } from '@pkgs/sql';
import { useWatchOne } from '@pkgs/sync-engine/client/sync-engine-context';
import { useSyncEnginePaintReady } from '@pkgs/sync-engine/client/sync-engine-paint-gate';

import { spaceMembershipEntityId } from '../shared/membership-key';
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
  readonly host_member_id: string | null;
  readonly host_account_id: string | null;
  readonly ended_at: string | null;
};

type MembershipRow = {
  readonly id: string;
};

function spaceRowSql(enabled: boolean, spaceId: string): Sql {
  return honey({
    select: [SpaceCol.hostMemberId, SpaceCol.hostAccountId, SpaceCol.endedAt],
    from: SPACES_TABLE.tableName,
    where: enabled ? ['=', SpaceCol.id, spaceId] : ['=', 1, 0],
  });
}

function membershipRowSql(enabled: boolean, membershipId: string): Sql {
  return honey({
    select: [SpaceMembershipCol.id],
    from: SPACE_MEMBERSHIPS_TABLE.tableName,
    where: enabled
      ? [
          'and',
          ['=', SpaceMembershipCol.id, membershipId],
          ['is-null', SpaceMembershipCol.leftAt],
        ]
      : ['=', 1, 0],
  });
}

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

function useSpacePresenceQueries(args: {
  readonly spaceId: string;
  readonly membershipId: string;
  readonly spaceEnabled: boolean;
  readonly memberEnabled: boolean;
}): {
  readonly spaceRow: SpaceRow | null;
  readonly spaceLoading: boolean;
  readonly guestRow: MembershipRow | null;
  readonly guestLoading: boolean;
} {
  const { spaceId, membershipId, spaceEnabled, memberEnabled } = args;
  const { row: spaceRow, isLoading: spaceLoading } = useWatchOne<SpaceRow>(
    spaceRowSql(spaceEnabled, spaceId)
  );
  const { row: guestRow, isLoading: guestLoading } = useWatchOne<MembershipRow>(
    membershipRowSql(memberEnabled, membershipId)
  );
  return { spaceRow, spaceLoading, guestRow, guestLoading };
}

/**
 * Resolves whether this account is in `spaceId` via local membership.
 * Role uses account id vs `host_member_id` / `host_account_id`.
 */
export function useSpacePresence(spaceId: string): SpacePresence {
  const accountId = useMyAccountId();
  const paintReady = useSyncEnginePaintReady();
  const spaceEnabled = spaceId.length > 0;
  const memberEnabled =
    paintReady && spaceEnabled && accountId !== null && accountId.length > 0;
  const membershipId = memberEnabled
    ? spaceMembershipEntityId(accountId, spaceId)
    : '';
  const queries = useSpacePresenceQueries({
    spaceId,
    membershipId,
    spaceEnabled,
    memberEnabled,
  });
  if (!paintReady) {
    return { status: 'loading' };
  }
  return applyPresenceLatch(
    spaceId,
    resolveSpacePresence({
      spaceEnabled,
      spaceLoading: queries.spaceLoading,
      spaceRow: queries.spaceRow,
      memberEnabled,
      guestLoading: queries.guestLoading,
      guestRow: queries.guestRow,
      myId: accountId ?? '',
    })
  );
}
