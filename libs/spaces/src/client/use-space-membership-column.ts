import { raw, sql } from '@pkgs/sql';
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

export function useSpaceMembershipColumn(
  membershipId: string,
  field: SpaceMembershipFieldKey
): string | null {
  const col = SpaceMembershipCol[field];
  const { value } = useWatchField<string>(
    sql`SELECT ${raw(SpaceMembershipCol.id)},
            ${raw(SpaceMembershipCol.memberId)}, ${raw(SpaceMembershipCol.spaceId)},
            ${raw(SpaceMembershipCol.joinedAt)}, ${raw(SpaceMembershipCol.leftAt)},
            ${raw(SpaceMembershipCol.profileId)}
     FROM ${raw(SPACE_MEMBERSHIPS_TABLE.tableName)}
     WHERE ${raw(SpaceMembershipCol.id)} = ${membershipId}`,
    col
  );
  return value;
}
