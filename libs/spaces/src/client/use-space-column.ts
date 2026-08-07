import { type Sql, sql } from '@pkgs/sql';

import { useQuery } from '@pkgs/sync-engine/client/sync-engine-context';

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

type SpaceColumnRow = {
  readonly id: string;
  readonly title: string | null;
  readonly host_id: string | null;
  readonly created_at: string | null;
  readonly ended_at: string | null;
  readonly visibility: string | null;
  readonly host_account_id: string | null;
  readonly host_member_id: string | null;
};

function spaceRowByIdSql(spaceId: string): Sql<SpaceColumnRow> {
  return sql<SpaceColumnRow>`
    SELECT id, title, host_id, created_at, ended_at, visibility, host_account_id, host_member_id
    FROM spaces
    WHERE id = ${spaceId}
  `;
}

/**
 * Space column for `spaceId`. Uses {@link useQuery} (same path as profile
 * columns) — field-only subscriptions can stick on an empty snapshot after create and
 * leave host ids null forever (ID-suffix titles).
 */
export function useSpaceColumn(
  spaceId: string,
  field: SpaceFieldColumn
): string | null {
  const { rows } = useQuery(spaceRowByIdSql(spaceId));
  const row = rows[0] ?? null;
  if (row === null) return null;
  const value = row[field];
  if (typeof value !== 'string') return null;
  return value;
}
