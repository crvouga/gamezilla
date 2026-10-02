import { defineTable } from '@pkgs/db-schema';

export const profileAccountPrivacy = defineTable({
  domain: 'profile',
  name: 'profile_account_privacy',
  columns: {
    owner_id: 'text',
    deletion_at: 'timestamp',
    erase_by: 'timestamp',
    erased_at: 'timestamp',
    export_status: 'text',
    requested_at: 'timestamp',
    ready_at: 'timestamp',
    export_detail: 'text',
    export_summary: 'text',
    cancellation_status: 'text',
    legal_purpose: 'text',
    legal_end_condition: 'text',
  },
  uniqueIndexes: ['owner_id'],
});

export const ACCOUNT_PRIVACY_TABLES = [profileAccountPrivacy] as const;
