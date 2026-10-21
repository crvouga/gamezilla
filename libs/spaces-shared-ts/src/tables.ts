import { defineTable } from '@pkgs/db-schema-root-shared-ts/define-table';

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
    hosting_limit_reached: {
      type: 'boolean',
      backfill: { sql: { sql: 'FALSE', sqlite: '0' } },
    },
  },
});

export const spacesUsers = defineTable({
  domain: 'spaces',
  name: 'spaces_users',
  columns: {
    space_id: 'text',
    user_id: 'text',
    created_by_account_id: 'text',
    joined: {
      type: 'boolean',
      backfill: { sql: { sql: 'TRUE', sqlite: '1' } },
    },
    participation_revision: { type: 'integer', backfill: { sql: '0' } },
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
    participation_revision: { type: 'integer', backfill: { sql: '0' } },
  },
  uniqueIndexes: [['device_id', 'space_id']],
});

export const SPACES_TABLES = [spaces, spacesUsers, spacesOpenSessions] as const;
