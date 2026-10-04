import type { Sql } from '@pkgs/sql-shared/sql';
import sql from '@pkgs/sql-shared/sql';

import { createQuery } from '@pkgs/sync-engine-client/sync-engine-context';
import { type Accessor, createMemo } from 'solid-js';

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
 * Space column for `spaceId`. Uses {@link createQuery} (same path as profile
 * columns) — field-only subscriptions can stick on an empty snapshot after create and
 * leave host ids null forever (ID-suffix titles).
 */
export function useSpaceColumn(
  spaceId: string | Accessor<string>,
  field: SpaceFieldColumn
): Accessor<string | null> {
  const resolveId = (): string =>
    typeof spaceId === 'string' ? spaceId : spaceId();
  const query = createQuery(() => spaceRowByIdSql(resolveId()));
  const row = createMemo(() => query.rows()[0] ?? null);
  return createMemo(() => {
    const current = row();
    if (current === null) return null;
    const value = current[field];
    if (typeof value !== 'string') return null;
    return value;
  });
}
