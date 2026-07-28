import { raw, sql } from '@pkgs/sql';
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
  activeMemberCount: 'activeMemberCount',
} as const satisfies Record<string, keyof typeof SpaceCol>;

export type SpaceFieldKey = keyof typeof SpaceField;

export function useSpaceColumn(
  spaceId: string,
  field: SpaceFieldKey
): string | null {
  const col = SpaceCol[field];
  const { value } = useWatchField<string>(
    sql`SELECT ${raw(SpaceCol.id)}, ${raw(SpaceCol.title)},
            ${raw(SpaceCol.hostId)}, ${raw(SpaceCol.createdAt)}, ${raw(SpaceCol.endedAt)},
            ${raw(SpaceCol.visibility)}, ${raw(SpaceCol.hostAccountId)},
            ${raw(SpaceCol.hostMemberId)}, ${raw(SpaceCol.activeMemberCount)}
     FROM ${raw(SPACES_TABLE.tableName)}
     WHERE ${raw(SpaceCol.id)} = ${spaceId}`,
    col
  );
  return value;
}
