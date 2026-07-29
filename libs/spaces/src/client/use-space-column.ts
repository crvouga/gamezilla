import { honey } from '@pkgs/sql';
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
} as const satisfies Record<string, keyof typeof SpaceCol>;

export type SpaceFieldKey = keyof typeof SpaceField;

export function useSpaceColumn(
  spaceId: string,
  field: SpaceFieldKey
): string | null {
  const col = SpaceCol[field];
  const { value } = useWatchField<string>(
    honey({
      select: [
        SpaceCol.id,
        SpaceCol.title,
        SpaceCol.hostId,
        SpaceCol.createdAt,
        SpaceCol.endedAt,
        SpaceCol.visibility,
        SpaceCol.hostAccountId,
        SpaceCol.hostMemberId,
      ],
      from: SPACES_TABLE.tableName,
      where: ['=', SpaceCol.id, spaceId],
    }),
    col
  );
  return value;
}
