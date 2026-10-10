import { defineTable } from '@pkgs/db-schema-root-shared/define-table';

export const profile = defineTable({
  domain: 'profile',
  name: 'profile',
  columns: {
    username: 'text',
    avatar_config: 'json',
    username_changed_at: 'timestamp',
    username_norm: 'text',
    account_kind: 'text',
  },
  uniqueIndexes: [['username_norm']],
});

export const PROFILE_TABLES = [profile] as const;
