import { defineTable } from '@pkgs/db-schema-root-shared/define-table';

export const spaces = defineTable({
  domain: 'spaces',
  name: 'spaces',
  columns: {
    title: 'text',
    host_id: 'text',
    ended_at: 'timestamp',
    visibility: 'text',
    host_account_id: 'text',
    host_member_id: 'text',
  },
});

export const spacesUsers = defineTable({
  domain: 'spaces',
  name: 'spaces_users',
  columns: {
    space_id: 'text',
    user_id: 'text',
    created_by_account_id: 'text',
  },
  uniqueIndexes: [['space_id', 'user_id']],
});

export const spacesOpenSessions = defineTable({
  domain: 'spaces',
  name: 'spaces_open_sessions',
  columns: {
    space_id: 'text',
    device_id: 'text',
    opened_at: 'timestamp',
    join_announced: 'boolean',
  },
  uniqueIndexes: [['device_id', 'space_id']],
});

export const SPACES_TABLES = [spaces, spacesUsers, spacesOpenSessions] as const;
