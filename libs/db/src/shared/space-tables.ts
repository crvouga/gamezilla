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
  activeMemberCount: 'active_member_count',
} as const;

export const SpaceMembershipCol = {
  id: 'id',
  memberId: 'member_id',
  spaceId: 'space_id',
  joinedAt: 'joined_at',
  leftAt: 'left_at',
  profileId: 'profile_id',
} as const;

export const SpaceAllowlistCol = {
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
    { name: 'active_member_count', type: 'integer' },
  ],
});

export const SPACE_MEMBERSHIPS_TABLE = defineTable({
  tableName: 'space_memberships',
  columns: [
    { name: 'id', type: 'text', primaryKey: true },
    { name: 'member_id', type: 'text' },
    { name: 'space_id', type: 'text' },
    { name: 'joined_at', type: 'text' },
    { name: 'left_at', type: 'text' },
    { name: 'profile_id', type: 'text' },
  ],
});

export const SPACE_ALLOWLIST_TABLE = defineTable({
  tableName: 'space_allowlist',
  columns: [
    { name: 'id', type: 'text', primaryKey: true },
    { name: 'space_id', type: 'text' },
    { name: 'user_id', type: 'text' },
    { name: 'created_at', type: 'text' },
    { name: 'created_by_account_id', type: 'text' },
  ],
});

export const ALL_SPACE_SYNC_TABLES = [
  SPACES_TABLE,
  SPACE_MEMBERSHIPS_TABLE,
  SPACE_ALLOWLIST_TABLE,
] as const;

/** Canonical allowlist row id: `${spaceId}:${userId}`. */
export function spaceAllowlistEntityId(
  spaceId: string,
  userId: string
): string {
  return `${spaceId}:${userId}`;
}
