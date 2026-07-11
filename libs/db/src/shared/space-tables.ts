import { defineTable } from '@pkgs/sync-engine/shared/table-definition';

export const SpaceCol = {
  id: 'id',
  title: 'title',
  hostId: 'host_id',
  createdAt: 'created_at',
  endedAt: 'ended_at',
} as const;

export const SpaceMembershipCol = {
  id: 'id',
  guestId: 'guest_id',
  spaceId: 'space_id',
  joinedAt: 'joined_at',
  leftAt: 'left_at',
} as const;

export const SPACES_TABLE = defineTable({
  tableName: 'spaces',
  columns: [
    { name: 'id', type: 'text', primaryKey: true },
    { name: 'title', type: 'text' },
    { name: 'host_id', type: 'text' },
    { name: 'created_at', type: 'text' },
    { name: 'ended_at', type: 'text' },
  ],
});

export const SPACE_MEMBERSHIPS_TABLE = defineTable({
  tableName: 'space_memberships',
  columns: [
    { name: 'id', type: 'text', primaryKey: true },
    { name: 'guest_id', type: 'text' },
    { name: 'space_id', type: 'text' },
    { name: 'joined_at', type: 'text' },
    { name: 'left_at', type: 'text' },
  ],
});

export const ALL_SPACE_SYNC_TABLES = [
  SPACES_TABLE,
  SPACE_MEMBERSHIPS_TABLE,
] as const;
