import { defineTable } from '@pkgs/db-schema-shared/define-table';
import { registerTables } from '@pkgs/db-schema-shared/register-tables';

export const SYNC_ENGINE_MUTATIONS = 'sync_engine_mutations';
export const SYNC_ENGINE_MUTATIONS_APPLIED = 'sync_engine_mutations_applied';
export const SYNC_ENGINE_WRITE_REJECTIONS = 'sync_engine_write_rejections';
export const SYNC_ENGINE_SCOPE_META = 'sync_engine_scope_meta';
export const SYNC_ENGINE_PUSH_APPLIED = 'sync_engine_push_applied';
export const SYNC_ENGINE_TOPIC_SEQ = 'sync_engine_topic_seq';
export const SYNC_ENGINE_OBSERVABILITY_EVENTS =
  'sync_engine_observability_events';
/** Client-only: peer rows applied from optimistic MQTT (healed on snapshot). */
export const SYNC_ENGINE_OPTIMISTIC_PEER_ROWS =
  'sync_engine_optimistic_peer_rows';

/** Server idempotency row — `id` equals `mutation_id`. */
export const syncEngineMutationsApplied = defineTable({
  domain: 'sync_engine',
  name: 'sync_engine_mutations_applied',
  columns: {
    mutation_id: 'text',
    client_id: 'text',
    seq: 'integer',
    status: 'text',
  },
  uniqueIndexes: ['mutation_id'],
  indexes: [['client_id', 'seq']],
});

/** Server + client audit of permanent mutation rejections. */
export const syncEngineWriteRejections = defineTable({
  domain: 'sync_engine',
  name: 'sync_engine_write_rejections',
  columns: {
    mutation_id: 'text',
    client_id: 'text',
    code: 'text',
    message: 'text',
    meta: 'json',
    acknowledged: 'integer',
  },
  indexes: ['client_id', 'mutation_id'],
});

/** Server monotonic pushSeq allocator — `id` equals `topic`. */
export const syncEngineTopicSeq = defineTable({
  domain: 'sync_engine',
  name: 'sync_engine_topic_seq',
  columns: {
    topic: 'text',
    n: 'integer',
  },
  uniqueIndexes: ['topic'],
});

/** Client durable mutation upload queue. */
export const syncEngineMutations = defineTable({
  domain: 'sync_engine',
  name: 'sync_engine_mutations',
  columns: {
    name: 'text',
    args: 'text',
    client_id: 'text',
    seq: 'integer',
    origin_traceparent: 'text',
    origin_session_id: 'text',
    origin_build_sha: 'text',
  },
  indexes: [['client_id', 'seq']],
});

/** Append-only server event truth for offline mutation causality. */
export const syncEngineObservabilityEvents = defineTable({
  domain: 'sync_engine',
  name: 'sync_engine_observability_events',
  columns: {
    event_name: 'text',
    user_id: 'text',
    session_id: 'text',
    device_id: 'text',
    mutation_id: 'text',
    trace_id: 'text',
    build_sha: 'text',
  },
  indexes: [
    'user_id',
    'session_id',
    'device_id',
    'mutation_id',
    'trace_id',
    'build_sha',
  ],
});

/** Client scope checkpoint metadata — `id` equals `scope_hash`. */
export const syncEngineScopeMeta = defineTable({
  domain: 'sync_engine',
  name: 'sync_engine_scope_meta',
  columns: {
    scope_hash: 'text',
    last_active_at: 'timestamp',
    last_checkpoint: 'text',
    last_hash: 'text',
  },
  uniqueIndexes: ['scope_hash'],
});

/** Client pushSeq floor per topic — `id` equals `topic`. */
export const syncEnginePushApplied = defineTable({
  domain: 'sync_engine',
  name: 'sync_engine_push_applied',
  columns: {
    topic: 'text',
    last_push_seq: 'text',
  },
  uniqueIndexes: ['topic'],
});

/** Client optimistic peer row markers — `id` equals `table_name:row_id`. */
export const syncEngineOptimisticPeerRows = defineTable({
  domain: 'sync_engine',
  name: 'sync_engine_optimistic_peer_rows',
  columns: {
    table_name: 'text',
    row_id: 'text',
    mutation_id: 'text',
  },
  uniqueIndexes: [['table_name', 'row_id']],
});

export const syncEngineServerSchema = registerTables([
  syncEngineMutationsApplied,
  syncEngineWriteRejections,
  syncEngineTopicSeq,
  syncEngineObservabilityEvents,
]);
export const syncEngineLocalSchema = registerTables([
  syncEngineMutations,
  syncEngineScopeMeta,
  syncEnginePushApplied,
  syncEngineWriteRejections,
  syncEngineOptimisticPeerRows,
]);

/** Deterministic PK for mutations_applied rows. */
export function mutationAppliedId(mutationId: string): string {
  return mutationId;
}

/** Deterministic PK for topic_seq / push_applied rows. */
export function topicRowId(topic: string): string {
  return topic;
}

/** Deterministic PK for scope_meta rows. */
export function scopeMetaId(scopeHash: string): string {
  return scopeHash;
}

/** Deterministic PK for optimistic peer marker rows. */
export function optimisticPeerRowId(tableName: string, rowId: string): string {
  return `${tableName.length}:${tableName}${rowId.length}:${rowId}`;
}
