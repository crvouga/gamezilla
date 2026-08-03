import { sql, type Sql } from '@pkgs/sql';

import { useWatchOne } from '@pkgs/sync-engine/client/sync-engine-context';

export const SpaceField = {
  title: 'title',
  hostId: 'host_id',
  createdAt: 'created_at',
  endedAt: 'ended_at',
  visibility: 'visibility',
  hostAccountId: 'host_account_id',
  hostMemberId: 'host_member_id',
} as const;

export type SpaceFieldKey = keyof typeof SpaceField;

export type SpaceFieldColumn = (typeof SpaceField)[SpaceFieldKey];

type SpaceRow = Readonly<Record<string, unknown>>;

function spaceRowByIdSql(spaceId: string): Sql {
  return sql`
    SELECT id, title, host_id, created_at, ended_at, visibility, host_account_id, host_member_id
    FROM spaces
    WHERE id = ${spaceId}
  `;
}

/**
 * Space column for `spaceId`. Uses {@link useWatchOne} (same path as profile
 * columns) — `useWatchField` can stick on an empty snapshot after create and
 * leave host ids null forever (ID-suffix titles).
 */
export function useSpaceColumn(
  spaceId: string,
  field: SpaceFieldColumn
): string | null {
  const { row } = useWatchOne<SpaceRow>(spaceRowByIdSql(spaceId));
  if (row === null) return null;
  const value = row[field];
  if (typeof value !== 'string') return null;
  return value;
}
