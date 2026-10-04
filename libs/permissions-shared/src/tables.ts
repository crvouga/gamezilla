import { defineTable } from '@pkgs/db-schema-shared/define-table';

/**
 * Append-only quota consumption ledger (§22.4). One row per consumed
 * idempotency key; counters are derived by counting rows inside a window, so
 * a retried or replayed consume can never double-charge. Synced per owner.
 */
export const permissionQuotaLedger = defineTable({
  domain: 'permissions',
  name: 'permissions_quota_ledger',
  columns: {
    owner_id: 'text',
    quota: 'text',
    idempotency_key: 'text',
    amount: 'integer',
    /** Server time on replay (client time on the optimistic local row). */
    consumed_at: 'timestamp',
    policy_version: 'text',
  },
  uniqueIndexes: [['owner_id', 'idempotency_key']],
  indexes: [['owner_id', 'quota', 'consumed_at']],
});

export const PERMISSIONS_TABLES = [permissionQuotaLedger] as const;
