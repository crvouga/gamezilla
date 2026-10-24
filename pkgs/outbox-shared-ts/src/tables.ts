import { defineTable } from '@pkgs/db-schema-root-shared-ts/define-table';
import { registerTables } from '@pkgs/db-schema-root-shared-ts/register-tables';

export const OUTBOX_EVENTS_TABLE = 'outbox_events';
export const OUTBOX_DELIVERIES_TABLE = 'outbox_deliveries';

export const outboxEvents = defineTable({
  domain: 'outbox',
  name: 'outbox_events',
  columns: {
    type: 'text',
    payload: 'json',
    available_at: 'timestamp',
    causation_id: 'text',
  },
  indexes: ['type', 'available_at', 'causation_id'],
});

export const outboxDeliveries = defineTable({
  domain: 'outbox',
  name: 'outbox_deliveries',
  columns: {
    event_id: 'text',
    consumer_id: 'text',
    attempts: 'integer',
    available_at: 'timestamp',
    processed_at: 'timestamp',
    last_error: 'text',
  },
  indexes: [['processed_at', 'available_at']],
  uniqueIndexes: [['event_id', 'consumer_id']],
});

export const outboxSchema = registerTables([outboxEvents, outboxDeliveries]);
