/**
 * Portable DDL for matchmaking (SQLite + Postgres).
 *
 * Types are TEXT / BIGINT / REAL / INTEGER so both engines accept the
 * same CREATE statements. JSON payloads are TEXT. Timestamps are epoch
 * ms BIGINT (injected from Io — never SQL now()).
 */

import {
  MATCHMAKING_MAX_GROUP_SIZE,
  MATCHMAKING_MAX_PRIORITY,
  MATCHMAKING_MIN_GROUP_SIZE,
  MATCHMAKING_MIN_PRIORITY,
} from '../interface/payload-limits';

export {
  MATCHMAKING_MAX_GROUP_SIZE,
  MATCHMAKING_MAX_PRIORITY,
  MATCHMAKING_MIN_GROUP_SIZE,
  MATCHMAKING_MIN_PRIORITY,
};

export const CREATE_SCHEMA_STATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS matchmaking_schema_state (
  id                  INTEGER PRIMARY KEY,
  schema_fingerprint  TEXT NOT NULL
)
`.trim();

export const DROP_ACTIVE_PARTITIONS_SQL = `
DROP TABLE IF EXISTS matchmaking_active_partitions
`.trim();

export const CREATE_ACTIVE_PARTITIONS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS matchmaking_active_partitions (
  partition_signature TEXT NOT NULL,
  group_size          INTEGER NOT NULL DEFAULT 2,
  first_seen_at       BIGINT NOT NULL,
  PRIMARY KEY (partition_signature, group_size)
)
`.trim();

export const CREATE_MATCHED_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS matchmaking_matched (
  id          TEXT PRIMARY KEY,
  match_id    TEXT NOT NULL,
  joined_at   BIGINT NOT NULL,
  matched_at  BIGINT NOT NULL,
  data        TEXT NOT NULL,
  metadata    TEXT NULL
)
`.trim();

export const CREATE_MATCHED_MATCH_ID_INDEX_SQL = `
CREATE INDEX IF NOT EXISTS matchmaking_matched_match_id_idx
  ON matchmaking_matched (match_id)
`.trim();

export const CREATE_MATCHED_MATCHED_AT_INDEX_SQL = `
CREATE INDEX IF NOT EXISTS matchmaking_matched_matched_at_idx
  ON matchmaking_matched (matched_at)
`.trim();

export const DROP_WAITING_TABLE_SQL = `
DROP TABLE IF EXISTS matchmaking_waiting
`.trim();

export const CREATE_WAITING_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS matchmaking_waiting (
  id                   TEXT PRIMARY KEY,
  joined_at            BIGINT NOT NULL,
  data                 TEXT NOT NULL,
  formulas             TEXT NOT NULL,
  metadata             TEXT NULL,
  partition_signature  TEXT NOT NULL,
  group_size           INTEGER NOT NULL DEFAULT 2
    CHECK (group_size BETWEEN ${String(MATCHMAKING_MIN_GROUP_SIZE)}
      AND ${String(MATCHMAKING_MAX_GROUP_SIZE)}),
  priority             INTEGER NOT NULL DEFAULT 0
    CHECK (priority BETWEEN ${String(MATCHMAKING_MIN_PRIORITY)}
      AND ${String(MATCHMAKING_MAX_PRIORITY)}),
  primary_rating       REAL NOT NULL,
  primary_bucket       INTEGER NOT NULL,
  claim_token          TEXT NULL,
  claimed_at           BIGINT NULL
)
`.trim();

export const CREATE_WAITING_LOOKUP_INDEX_SQL = `
CREATE INDEX IF NOT EXISTS matchmaking_waiting_lookup_idx
  ON matchmaking_waiting (
    partition_signature, group_size, primary_bucket, priority, joined_at
  )
`.trim();

export const CREATE_WAITING_CLAIM_TOKEN_INDEX_SQL = `
CREATE INDEX IF NOT EXISTS matchmaking_waiting_claim_token_idx
  ON matchmaking_waiting (claim_token)
`.trim();

export const CREATE_WAITING_CLAIMED_AT_INDEX_SQL = `
CREATE INDEX IF NOT EXISTS matchmaking_waiting_claimed_at_idx
  ON matchmaking_waiting (claimed_at)
`.trim();

/** Best-effort: add claim columns on older installs that lack them. */
export const ADD_CLAIM_TOKEN_COLUMN_SQL = `
ALTER TABLE matchmaking_waiting ADD COLUMN claim_token TEXT NULL
`.trim();

export const ADD_CLAIMED_AT_COLUMN_SQL = `
ALTER TABLE matchmaking_waiting ADD COLUMN claimed_at BIGINT NULL
`.trim();

export const ADD_PRIMARY_RATING_COLUMN_SQL = `
ALTER TABLE matchmaking_waiting ADD COLUMN primary_rating REAL NOT NULL DEFAULT 0
`.trim();

export const ADD_PRIMARY_BUCKET_COLUMN_SQL = `
ALTER TABLE matchmaking_waiting ADD COLUMN primary_bucket INTEGER NOT NULL DEFAULT 0
`.trim();
