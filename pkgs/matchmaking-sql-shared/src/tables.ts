import { defineTable } from '@pkgs/db-schema-root-shared/define-table';
import { registerTables } from '@pkgs/db-schema-root-shared/register-tables';

export const MATCHMAKING_SCHEMA_STATE_TABLE = 'matchmaking_schema_state';
export const MATCHMAKING_ACTIVE_PARTITIONS_TABLE =
  'matchmaking_active_partitions';
export const MATCHMAKING_MATCHED_TABLE = 'matchmaking_matched';
export const MATCHMAKING_WAITING_TABLE = 'matchmaking_waiting';

/** Singleton row id for schema fingerprint state. */
export const MATCHMAKING_SCHEMA_STATE_ID = '0';

/**
 * Ephemeral matchmaking tick tables (not product appSchema / not synced).
 * Managed columns: id, created_at, updated_at, deleted_at.
 * Payload epoch-ms columns stay `integer` (not ISO timestamps).
 */
export const matchmakingSchemaState = defineTable({
  domain: 'matchmaking',
  name: 'matchmaking_schema_state',
  columns: {
    schema_fingerprint: 'text',
  },
});

export const matchmakingActivePartitions = defineTable({
  domain: 'matchmaking',
  name: 'matchmaking_active_partitions',
  columns: {
    partition_signature: 'text',
    group_size: 'integer',
    first_seen_at: 'integer',
    accepted_count: 'integer',
  },
  uniqueIndexes: [['partition_signature', 'group_size']],
  indexes: ['first_seen_at'],
});

export const matchmakingMatched = defineTable({
  domain: 'matchmaking',
  name: 'matchmaking_matched',
  columns: {
    owner_id: 'text',
    match_id: 'text',
    joined_at: 'integer',
    matched_at: 'integer',
    data: 'json',
    metadata: 'json',
  },
  indexes: ['match_id', 'matched_at'],
});

export const matchmakingWaiting = defineTable({
  domain: 'matchmaking',
  name: 'matchmaking_waiting',
  columns: {
    owner_id: 'text',
    accepted_order: 'integer',
    ended_at: 'integer',
    joined_at: 'integer',
    data: 'json',
    formulas: 'json',
    metadata: 'json',
    partition_signature: 'text',
    group_size: 'integer',
    primary_rating: 'real',
    primary_bucket: 'integer',
  },
  indexes: [
    ['partition_signature', 'group_size', 'primary_bucket', 'joined_at'],
  ],
});

export const matchmakingOwners = defineTable({
  domain: 'matchmaking',
  name: 'matchmaking_owners',
  columns: { current_id: 'text', available: 'boolean' },
});

export const matchmakingRequests = defineTable({
  domain: 'matchmaking',
  name: 'matchmaking_requests',
  columns: {
    owner_id: 'text',
    request_id: 'text',
    kind: 'text',
    result: 'json',
  },
  uniqueIndexes: [['owner_id', 'request_id']],
});

export const matchmakingRestrictions = defineTable({
  domain: 'matchmaking',
  name: 'matchmaking_restrictions',
  columns: { owner_a: 'text', owner_b: 'text', restricted: 'boolean' },
  uniqueIndexes: [['owner_a', 'owner_b']],
});

export const matchmakingSchema = registerTables([
  matchmakingSchemaState,
  matchmakingActivePartitions,
  matchmakingMatched,
  matchmakingWaiting,
  matchmakingOwners,
  matchmakingRequests,
  matchmakingRestrictions,
]);

/** Deterministic id for an active-partition row. */
export function activePartitionId(
  partitionSignature: string,
  groupSize: number
): string {
  return `${partitionSignature}:${String(groupSize)}`;
}
