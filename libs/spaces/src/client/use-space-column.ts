import { useWatchValue } from '@pkgs/sync-engine/client/sync-engine-context';

import { SpaceCol, SPACES_TABLE } from '../shared/sync-tables';

export const SpaceField = {
  title: 'title',
  hostId: 'hostId',
  createdAt: 'createdAt',
  endedAt: 'endedAt',
} as const satisfies Record<string, keyof typeof SpaceCol>;

export type SpaceFieldKey = keyof typeof SpaceField;

export function useSpaceColumn(
  spaceId: string,
  field: SpaceFieldKey
): string | null {
  const col = SpaceCol[field];
  const { value } = useWatchValue<string>(
    `SELECT ${col} AS value FROM ${SPACES_TABLE.tableName} WHERE ${SpaceCol.id} = ?`,
    [spaceId]
  );
  return value;
}
