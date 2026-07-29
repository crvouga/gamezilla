import { defineTable } from '@pkgs/sync-engine/shared/table-definition';

export const FriendRequestCol = {
  id: 'id',
  fromUserId: 'from_user_id',
  toUserId: 'to_user_id',
  status: 'status',
  message: 'message',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  respondedAt: 'responded_at',
} as const;

export const FriendshipCol = {
  id: 'id',
  userLow: 'user_low',
  userHigh: 'user_high',
  createdAt: 'created_at',
  sourceRequestId: 'source_request_id',
} as const;

export const UserBlockCol = {
  id: 'id',
  blockerId: 'blocker_id',
  blockedId: 'blocked_id',
  createdAt: 'created_at',
} as const;

export const FRIEND_REQUESTS_TABLE = defineTable({
  tableName: 'friend_requests',
  columns: [
    { name: 'id', type: 'text', primaryKey: true },
    { name: 'from_user_id', type: 'text' },
    { name: 'to_user_id', type: 'text' },
    { name: 'status', type: 'text' },
    { name: 'message', type: 'text' },
    { name: 'created_at', type: 'text' },
    { name: 'updated_at', type: 'text' },
    { name: 'responded_at', type: 'text' },
  ],
});

export const FRIENDSHIPS_TABLE = defineTable({
  tableName: 'friendships',
  columns: [
    { name: 'id', type: 'text', primaryKey: true },
    { name: 'user_low', type: 'text' },
    { name: 'user_high', type: 'text' },
    { name: 'created_at', type: 'text' },
    { name: 'source_request_id', type: 'text' },
  ],
});

export const USER_BLOCKS_TABLE = defineTable({
  tableName: 'user_blocks',
  columns: [
    { name: 'id', type: 'text', primaryKey: true },
    { name: 'blocker_id', type: 'text' },
    { name: 'blocked_id', type: 'text' },
    { name: 'created_at', type: 'text' },
  ],
});

export const ALL_FRIENDS_SYNC_TABLES = [
  FRIEND_REQUESTS_TABLE,
  FRIENDSHIPS_TABLE,
  USER_BLOCKS_TABLE,
] as const;
