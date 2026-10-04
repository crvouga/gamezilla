import { defineTable } from '@pkgs/db-schema-root-shared/define-table';

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

export const profileDeletionReceipts = defineTable({
  domain: 'profile',
  name: 'profile_deletion_receipts',
  columns: {
    owner_id: 'text',
    confirmed_at: 'timestamp',
    erase_by: 'timestamp',
    cancellation_status: 'text',
  },
  uniqueIndexes: ['owner_id'],
});

export const profileLegalPreservations = defineTable({
  domain: 'profile',
  name: 'profile_legal_preservations',
  columns: {
    owner_id: 'text',
    purpose: 'text',
    end_condition: 'text',
    category: 'text',
    preserved_data: 'text',
  },
});

export const ACCOUNT_PRIVACY_TABLES = [
  profileAccountPrivacy,
  profileDeletionReceipts,
  profileLegalPreservations,
] as const;
