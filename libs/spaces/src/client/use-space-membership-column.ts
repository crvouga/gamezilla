import { useWatchField } from '@pkgs/sync-engine/client/sync-engine-context';

import {
  SpaceMembershipCol,
  SPACE_MEMBERSHIPS_TABLE,
} from '@libs/db/shared/space-tables';

export const SpaceMembershipField = {
  memberId: 'memberId',
  spaceId: 'spaceId',
  joinedAt: 'joinedAt',
  leftAt: 'leftAt',
  profileId: 'profileId',
} as const satisfies Record<string, keyof typeof SpaceMembershipCol>;

export type SpaceMembershipFieldKey = keyof typeof SpaceMembershipField;

/** Canonical membership row SELECT — shared by all column field selectors. */
export const SPACE_MEMBERSHIP_ROW_BY_ID_SQL = `SELECT ${SpaceMembershipCol.id},
            ${SpaceMembershipCol.memberId}, ${SpaceMembershipCol.spaceId},
            ${SpaceMembershipCol.joinedAt}, ${SpaceMembershipCol.leftAt},
            ${SpaceMembershipCol.profileId}
     FROM ${SPACE_MEMBERSHIPS_TABLE.tableName}
     WHERE ${SpaceMembershipCol.id} = ?`;

export function useSpaceMembershipColumn(
  membershipId: string,
  field: SpaceMembershipFieldKey
): string | null {
  const col = SpaceMembershipCol[field];
  const { value } = useWatchField<string>(
    SPACE_MEMBERSHIP_ROW_BY_ID_SQL,
    [membershipId],
    col
  );
  return value;
}
