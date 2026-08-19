import { defineTable } from '@pkgs/db-schema';

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
  indexes: [
    'created_at',
    'ended_at',
    'host_id',
    'host_account_id',
    'host_member_id',
  ],
});

export const spacesUsers = defineTable({
  domain: 'spaces',
  name: 'spaces_users',
  columns: {
    space_id: 'text',
    user_id: 'text',
    created_by_account_id: 'text',
  },
  indexes: ['space_id', 'user_id'],
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
  indexes: ['device_id', 'space_id'],
  uniqueIndexes: [['device_id', 'space_id']],
});

export const SPACES_TABLES = [spaces, spacesUsers, spacesOpenSessions] as const;
