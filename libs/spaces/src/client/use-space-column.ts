import { sqlMap } from '@pkgs/sql';
import { useWatchOne } from '@pkgs/sync-engine/client/sync-engine-context';

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

type SpaceRow = Readonly<Record<string, unknown>>;

/**
 * Space column for `spaceId`. Uses {@link useWatchOne} (same path as profile
 * columns) — `useWatchField` can stick on an empty snapshot after create and
 * leave host ids null forever (ID-suffix titles).
 */
export function useSpaceColumn(
  spaceId: string,
  field: SpaceFieldKey
): string | null {
  const col = SpaceCol[field];
  const { row } = useWatchOne<SpaceRow>(
    sqlMap({
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
    })
  );
  if (row === null) return null;
  const value = row[col];
  if (typeof value !== 'string') return null;
  return value;
}
