import { defineTable } from '@pkgs/sync-engine/shared/table-definition';

export const SpaceCol = {
  id: 'id',
  title: 'title',
  hostId: 'host_id',
  createdAt: 'created_at',
  endedAt: 'ended_at',
  visibility: 'visibility',
  hostAccountId: 'host_account_id',
  hostMemberId: 'host_member_id',
} as const;

export const SpaceUserCol = {
  id: 'id',
  spaceId: 'space_id',
  userId: 'user_id',
  createdAt: 'created_at',
  createdByAccountId: 'created_by_account_id',
} as const;

export const SPACES_TABLE = defineTable({
  tableName: 'spaces',
  columns: [
    { name: 'id', type: 'text', primaryKey: true },
    { name: 'title', type: 'text' },
    { name: 'host_id', type: 'text' },
    { name: 'created_at', type: 'text' },
    { name: 'ended_at', type: 'text' },
    { name: 'visibility', type: 'text' },
    { name: 'host_account_id', type: 'text' },
    { name: 'host_member_id', type: 'text' },
  ],
});

export const SPACE_USERS_TABLE = defineTable({
  tableName: 'space_users',
  columns: [
    { name: 'id', type: 'text', primaryKey: true },
    { name: 'space_id', type: 'text' },
    { name: 'user_id', type: 'text' },
    { name: 'created_at', type: 'text' },
    { name: 'created_by_account_id', type: 'text' },
  ],
});

export const ALL_SPACE_SYNC_TABLES = [SPACES_TABLE, SPACE_USERS_TABLE] as const;

/** Canonical space_users row id: `${spaceId}:${userId}`. */
export function spaceUserEntityId(spaceId: string, userId: string): string {
  return `${spaceId}:${userId}`;
}
