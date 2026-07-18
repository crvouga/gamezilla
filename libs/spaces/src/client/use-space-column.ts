import { useWatchField } from '@pkgs/sync-engine/client/sync-engine-context';

import { SpaceCol, SPACES_TABLE } from '@libs/db/shared/space-tables';

export const SpaceField = {
  title: 'title',
  hostId: 'hostId',
  createdAt: 'createdAt',
  endedAt: 'endedAt',
  visibility: 'visibility',
  hostAccountId: 'hostAccountId',
  hostMemberId: 'hostMemberId',
  hostUsername: 'hostUsername',
  hostAvatarConfig: 'hostAvatarConfig',
  activeMemberCount: 'activeMemberCount',
} as const satisfies Record<string, keyof typeof SpaceCol>;

export type SpaceFieldKey = keyof typeof SpaceField;

/** Canonical space row SELECT — shared by all {@link useSpaceColumn} fields. */
export const SPACE_ROW_BY_ID_SQL = `SELECT ${SpaceCol.id}, ${SpaceCol.title},
            ${SpaceCol.hostId}, ${SpaceCol.createdAt}, ${SpaceCol.endedAt},
            ${SpaceCol.visibility}, ${SpaceCol.hostAccountId},
            ${SpaceCol.hostMemberId}, ${SpaceCol.hostUsername},
            ${SpaceCol.hostAvatarConfig}, ${SpaceCol.activeMemberCount}
     FROM ${SPACES_TABLE.tableName}
     WHERE ${SpaceCol.id} = ?`;

export function useSpaceColumn(
  spaceId: string,
  field: SpaceFieldKey
): string | null {
  const col = SpaceCol[field];
  const { value } = useWatchField<string>(SPACE_ROW_BY_ID_SQL, [spaceId], col);
  return value;
}
