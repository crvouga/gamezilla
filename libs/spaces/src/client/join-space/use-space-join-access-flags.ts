import {
  FRIENDSHIPS_TABLE,
  FriendshipCol,
} from '@libs/db/shared/friends-tables';
import {
  SPACE_INVITES_TABLE,
  SpaceInviteCol,
} from '@libs/db/shared/space-tables';
import { useWatchOne } from '@pkgs/sync-engine/client/sync-engine-context';

import { canonicalUserPair } from '../../shared/canonical-user-pair';

function isInviteStillValid(row: {
  readonly expires_at: string | null;
  readonly revoked_at: string | null;
  readonly max_uses: number | string | null;
  readonly use_count: number | string | null;
}): boolean {
  if (row.revoked_at !== null) return false;
  if (row.expires_at !== null && Date.parse(row.expires_at) <= Date.now()) {
    return false;
  }
  const maxUses = Number(row.max_uses);
  const useCount = Number(row.use_count);
  if (Number.isFinite(maxUses) && useCount >= maxUses) return false;
  return true;
}

function friendshipPairOrNull(
  accountA: string | null,
  accountB: string | null
): { readonly userLow: string; readonly userHigh: string } | null {
  if (accountA === null || accountB === null) return null;
  if (accountA.length === 0 || accountB.length === 0) return null;
  if (accountA === accountB) return null;
  return canonicalUserPair(accountA, accountB);
}

/** True when a local invite row for (spaceId, token) is still usable. */
export function useHasValidLocalInvite(
  spaceId: string,
  inviteToken: string | null
): boolean {
  const token = inviteToken ?? '';
  const enabled = spaceId.length > 0 && token.length > 0;
  const { row } = useWatchOne<{
    readonly expires_at: string | null;
    readonly revoked_at: string | null;
    readonly max_uses: number | string | null;
    readonly use_count: number | string | null;
  }>(
    enabled
      ? `SELECT ${SpaceInviteCol.expiresAt} AS expires_at,
                ${SpaceInviteCol.revokedAt} AS revoked_at,
                ${SpaceInviteCol.maxUses} AS max_uses,
                ${SpaceInviteCol.useCount} AS use_count
         FROM ${SPACE_INVITES_TABLE.tableName}
         WHERE ${SpaceInviteCol.spaceId} = ?
           AND ${SpaceInviteCol.token} = ?
         LIMIT 1`
      : `SELECT ${SpaceInviteCol.expiresAt} AS expires_at,
                ${SpaceInviteCol.revokedAt} AS revoked_at,
                ${SpaceInviteCol.maxUses} AS max_uses,
                ${SpaceInviteCol.useCount} AS use_count
         FROM ${SPACE_INVITES_TABLE.tableName} WHERE 0`,
    enabled ? [spaceId, token] : []
  );
  if (row === null) return false;
  return isInviteStillValid(row);
}

/** True when the two accounts share a local friendship row. */
export function useAreAccountsFriendsLocal(
  accountA: string | null,
  accountB: string | null
): boolean {
  const sameAccount =
    accountA !== null && accountB !== null && accountA === accountB;
  const pair = friendshipPairOrNull(accountA, accountB);
  const { row } = useWatchOne<{ readonly id: string }>(
    pair !== null
      ? `SELECT ${FriendshipCol.id} AS id
         FROM ${FRIENDSHIPS_TABLE.tableName}
         WHERE ${FriendshipCol.userLow} = ? AND ${FriendshipCol.userHigh} = ?
         LIMIT 1`
      : `SELECT ${FriendshipCol.id} AS id FROM ${FRIENDSHIPS_TABLE.tableName} WHERE 0`,
    pair !== null ? [pair.userLow, pair.userHigh] : []
  );
  return sameAccount || row !== null;
}
