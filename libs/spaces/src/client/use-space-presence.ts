import { useMyAccountId } from '@libs/auth/client/use-current-user';
import { honey, type Sql } from '@pkgs/sql';
import { useWatchOne } from '@pkgs/sync-engine/client/sync-engine-context';
import { useSyncEnginePaintReady } from '@pkgs/sync-engine/client/sync-engine-paint-gate';

import { SpaceCol, SPACES_TABLE } from '@libs/db/shared/space-tables';
import {
  latchStaleSpacePresence,
  resolveSpacePresence,
  type SpacePresence,
} from '../shared/resolve-space-presence';
import {
  readSpacePresenceLatch,
  writeSpacePresenceLatch,
} from '../shared/space-presence-latch-store';
import { useOpenSpaceIds } from './open-space/use-open-space-ids';

export type { SpacePresence };

type SpaceRow = {
  readonly host_member_id: string | null;
  readonly host_account_id: string | null;
  readonly ended_at: string | null;
};

function spaceRowSql(enabled: boolean, spaceId: string): Sql {
  return honey({
    select: [SpaceCol.hostMemberId, SpaceCol.hostAccountId, SpaceCol.endedAt],
    from: SPACES_TABLE.tableName,
    where: enabled ? ['=', SpaceCol.id, spaceId] : ['=', 1, 0],
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

/**
 * Resolves whether this account has `spaceId` open locally.
 * Role uses account id vs `host_member_id` / `host_account_id`.
 */
export function useSpacePresence(spaceId: string): SpacePresence {
  const accountId = useMyAccountId();
  const paintReady = useSyncEnginePaintReady();
  const { isOpen } = useOpenSpaceIds();
  const spaceEnabled = spaceId.length > 0;
  const { row: spaceRow, isLoading: spaceLoading } = useWatchOne<SpaceRow>(
    spaceRowSql(spaceEnabled, spaceId)
  );
  if (!paintReady) {
    return { status: 'loading' };
  }
  return applyPresenceLatch(
    spaceId,
    resolveSpacePresence({
      spaceEnabled,
      spaceLoading,
      spaceRow,
      isOpenLocally: isOpen(spaceId),
      myId: accountId ?? '',
    })
  );
}
