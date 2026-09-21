/**
 * The provider's own SQLite schema. Not part of the product `appSchema`:
 * nothing here is synced, and the provider owns its file.
 *
 * Provider objects (customers, prices, payment methods, subscriptions,
 * invoices, checkout and portal sessions) are documents in one table, keyed
 * by their provider id and indexed by customer — the provider's API returns
 * them whole, so storing them whole keeps the wire and the store in step.
 * Events carry their delivery bookkeeping beside the payload.
 */
import { defineTable, registerTables } from '@pkgs/db-schema';

export const billingMockObjects = defineTable({
  domain: 'billing_mock',
  name: 'billing_mock_objects',
  columns: {
    /** The wire `object` name (`customer`, `subscription`, …). */
    object_type: 'text',
    /** The owning customer's id; the customer's own row points at itself. */
    customer: 'text',
    /** The wire object, JSON. */
    body: 'text',
    /** Insertion order, for stable newest-first listings. */
    seq: 'integer',
  },
  indexes: [['customer', 'object_type'], 'object_type'],
});

export const billingMockEvents = defineTable({
  domain: 'billing_mock',
  name: 'billing_mock_events',
  columns: {
    event_type: 'text',
    /** The wire event, JSON. */
    body: 'text',
    seq: 'integer',
    /** `pending` | `delivered` | `failed`. */
    delivery: 'text',
    attempts: 'integer',
    /** Wall-clock ms of the next delivery attempt. */
    next_attempt_ms: 'integer',
  },
  indexes: [['delivery', 'next_attempt_ms'], 'event_type'],
});

/** Each customer's test clock, as an offset ahead of the provider's clock. */
export const billingMockClocks = defineTable({
  domain: 'billing_mock',
  name: 'billing_mock_clocks',
  columns: {
    offset_ms: 'integer',
  },
});

export const BILLING_MOCK_TABLES = [
  billingMockObjects,
  billingMockEvents,
  billingMockClocks,
] as const;

export const billingMockSchema = registerTables(BILLING_MOCK_TABLES);
