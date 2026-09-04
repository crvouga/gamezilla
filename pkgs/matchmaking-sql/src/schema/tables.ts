import { defineTable, registerTables } from '@pkgs/db-schema';

import {
  MATCHMAKING_MAX_GROUP_SIZE,
  MATCHMAKING_MAX_PRIORITY,
  MATCHMAKING_MIN_GROUP_SIZE,
  MATCHMAKING_MIN_PRIORITY,
} from '@pkgs/matchmaking/interface';

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
  },
  uniqueIndexes: [['partition_signature', 'group_size']],
  indexes: ['first_seen_at'],
});

export const matchmakingMatched = defineTable({
  domain: 'matchmaking',
  name: 'matchmaking_matched',
  columns: {
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
    joined_at: 'integer',
    data: 'json',
    formulas: 'json',
    metadata: 'json',
    partition_signature: 'text',
    group_size: 'integer',
    priority: 'integer',
    primary_rating: 'real',
    primary_bucket: 'integer',
    claim_token: 'text',
    claimed_at: 'integer',
  },
  indexes: [
    [
      'partition_signature',
      'group_size',
      'primary_bucket',
      'priority',
      'joined_at',
    ],
    'claim_token',
    'claimed_at',
  ],
  checks: [
    {
      name: 'waiting_group_size',
      sql: `group_size BETWEEN ${String(MATCHMAKING_MIN_GROUP_SIZE)} AND ${String(MATCHMAKING_MAX_GROUP_SIZE)}`,
    },
    {
      name: 'waiting_priority',
      sql: `priority BETWEEN ${String(MATCHMAKING_MIN_PRIORITY)} AND ${String(MATCHMAKING_MAX_PRIORITY)}`,
    },
  ],
});

export const matchmakingSchema = registerTables([
  matchmakingSchemaState,
  matchmakingActivePartitions,
  matchmakingMatched,
  matchmakingWaiting,
]);

/** Deterministic id for an active-partition row. */
export function activePartitionId(
  partitionSignature: string,
  groupSize: number
): string {
  return `${partitionSignature}:${String(groupSize)}`;
}
