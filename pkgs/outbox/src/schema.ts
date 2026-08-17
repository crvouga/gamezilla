/** Portable SQLite-shaped DDL for outbox (also applied on Postgres). */
export const OUTBOX_EVENTS_DDL = `
CREATE TABLE IF NOT EXISTS outbox_events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL,
  available_at TEXT NOT NULL
)
`;

export const OUTBOX_EVENTS_TYPE_IDX = `
CREATE INDEX IF NOT EXISTS outbox_events_type_idx
  ON outbox_events (type)
`;

export const OUTBOX_EVENTS_AVAILABLE_IDX = `
CREATE INDEX IF NOT EXISTS outbox_events_available_idx
  ON outbox_events (available_at)
`;

export const OUTBOX_DELIVERIES_DDL = `
CREATE TABLE IF NOT EXISTS outbox_deliveries (
  event_id TEXT NOT NULL,
  consumer_id TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  available_at TEXT NOT NULL,
  processed_at TEXT,
  last_error TEXT,
  PRIMARY KEY (event_id, consumer_id)
)
`;

export const OUTBOX_DELIVERIES_CLAIM_IDX = `
CREATE INDEX IF NOT EXISTS outbox_deliveries_claim_idx
  ON outbox_deliveries (processed_at, available_at)
`;

export const OUTBOX_DDL_STATEMENTS = [
  OUTBOX_EVENTS_DDL,
  OUTBOX_EVENTS_TYPE_IDX,
  OUTBOX_EVENTS_AVAILABLE_IDX,
  OUTBOX_DELIVERIES_DDL,
  OUTBOX_DELIVERIES_CLAIM_IDX,
] as const;
