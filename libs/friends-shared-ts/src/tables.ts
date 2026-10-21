import { defineTable } from '@pkgs/db-schema-root-shared-ts/define-table';

export const friendsRequests = defineTable({
  domain: 'friends',
  name: 'friends_requests',
  columns: {
    from_user_id: 'text',
    to_user_id: 'text',
    status: 'text',
    message: 'text',
    responded_at: 'timestamp',
  },
});

export const friendsFriendships = defineTable({
  domain: 'friends',
  name: 'friends_friendships',
  columns: {
    user_low: 'text',
    user_high: 'text',
    source_request_id: 'text',
  },
  uniqueIndexes: [['user_low', 'user_high']],
});

export const friendsBlocks = defineTable({
  domain: 'friends',
  name: 'friends_blocks',
  columns: {
    blocker_id: 'text',
    blocked_id: 'text',
  },
  uniqueIndexes: [['blocker_id', 'blocked_id']],
});

export const FRIENDS_TABLES = [
  friendsRequests,
  friendsFriendships,
  friendsBlocks,
] as const;
