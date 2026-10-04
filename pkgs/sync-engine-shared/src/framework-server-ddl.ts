import {
  SYNC_ENGINE_MUTATIONS,
  SYNC_ENGINE_MUTATIONS_APPLIED,
  SYNC_ENGINE_OBSERVABILITY_EVENTS,
  SYNC_ENGINE_PUSH_APPLIED,
  SYNC_ENGINE_SCOPE_META,
  SYNC_ENGINE_TOPIC_SEQ,
  SYNC_ENGINE_WRITE_REJECTIONS,
} from './tables';

/** Table names owned by framework schema (server + local). */
export const FRAMEWORK_TABLE_NAMES = [
  SYNC_ENGINE_MUTATIONS,
  SYNC_ENGINE_MUTATIONS_APPLIED,
  SYNC_ENGINE_WRITE_REJECTIONS,
  SYNC_ENGINE_SCOPE_META,
  SYNC_ENGINE_PUSH_APPLIED,
  SYNC_ENGINE_TOPIC_SEQ,
  SYNC_ENGINE_OBSERVABILITY_EVENTS,
] as const;

/**
 * Local SQLite durable tables (survive CACHE clear). Refusal notices are
 * durable: a notice stays until its author acknowledges it, and no query
 * hydrates it again after a wipe.
 */
export const FRAMEWORK_DURABLE_TABLE_NAMES = [
  SYNC_ENGINE_MUTATIONS,
  SYNC_ENGINE_WRITE_REJECTIONS,
] as const;

/** Local SQLite cache tables wiped on CACHE clear / epoch bump. */
export const FRAMEWORK_CACHE_TABLE_NAMES = [
  SYNC_ENGINE_SCOPE_META,
  SYNC_ENGINE_PUSH_APPLIED,
] as const;
