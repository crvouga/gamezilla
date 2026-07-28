import { sql, ident } from '@pkgs/sql';
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
    sql`SELECT ${ident(SpaceCol.id)}, ${ident(SpaceCol.title)},
            ${ident(SpaceCol.hostId)}, ${ident(SpaceCol.createdAt)}, ${ident(SpaceCol.endedAt)},
            ${ident(SpaceCol.visibility)}, ${ident(SpaceCol.hostAccountId)},
            ${ident(SpaceCol.hostMemberId)}, ${ident(SpaceCol.activeMemberCount)}
     FROM ${ident(SPACES_TABLE.tableName)}
     WHERE ${ident(SpaceCol.id)} = ${spaceId}`,
    col
  );
  return value;
}
