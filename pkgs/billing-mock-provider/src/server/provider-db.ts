/** Transaction-scoped reads and writes over the provider's tables. */
import type { MockEvent } from '@pkgs/billing-mock/wire';
import { sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';

/** Any stored wire object: it has an id and an `object` name. */
export type StoredObject = { readonly id: string; readonly object: string };

type BodyRow = { readonly body: string };

export type EventDelivery = 'pending' | 'delivered' | 'failed';

/** A saved answer to a request made with an `Idempotency-Key`. */
export type IdempotentResponse = {
  readonly fingerprint: string;
  readonly status: number;
  readonly response: string;
  readonly firstSeenMs: number;
};

export type PendingEvent = {
  readonly event: MockEvent;
  readonly attempts: number;
};

/** Transaction-scoped reads and writes. */
export class ProviderDb {
  constructor(private readonly db: SqlClient) {}

  async get<T extends StoredObject>(
    id: string,
    objectType: T['object']
  ): Promise<T | null> {
    const rows = await this.db.query(sql<BodyRow>`
      SELECT body FROM billing_mock_objects
      WHERE id = ${id} AND object_type = ${objectType}`);
    const row = rows[0];
    return row === undefined ? null : (JSON.parse(row.body) as T);
  }

  private async nextSeq(table: 'objects' | 'events'): Promise<number> {
    const rows = await this.db.query(
      table === 'objects'
        ? sql<{
            readonly n: number | null;
          }>`SELECT MAX(seq) AS n FROM billing_mock_objects`
        : sql<{
            readonly n: number | null;
          }>`SELECT MAX(seq) AS n FROM billing_mock_events`
    );
    return Number(rows[0]?.n ?? 0) + 1;
  }

  /** Insert or replace; a replace keeps the original insertion order. */
  async put<T extends StoredObject>(
    object: T,
    customer: string
  ): Promise<void> {
    const seq = await this.nextSeq('objects');
    await this.db.run(sql`
      INSERT INTO billing_mock_objects (id, object_type, customer, body, seq)
      VALUES (${object.id}, ${object.object}, ${customer}, ${JSON.stringify(object)}, ${seq})
      ON CONFLICT (id) DO UPDATE SET body = excluded.body`);
  }

  /** A customer's objects of one type, newest first. */
  async list<T extends StoredObject>(
    objectType: T['object'],
    customer: string
  ): Promise<readonly T[]> {
    const rows = await this.db.query(sql<BodyRow>`
      SELECT body FROM billing_mock_objects
      WHERE customer = ${customer} AND object_type = ${objectType}
      ORDER BY seq DESC`);
    return rows.map((row) => JSON.parse(row.body) as T);
  }

  /** Every object of one type, oldest first. */
  async all<T extends StoredObject>(
    objectType: T['object']
  ): Promise<readonly T[]> {
    const rows = await this.db.query(sql<BodyRow>`
      SELECT body FROM billing_mock_objects
      WHERE object_type = ${objectType}
      ORDER BY seq ASC`);
    return rows.map((row) => JSON.parse(row.body) as T);
  }

  async clockOffsetMs(customer: string): Promise<number> {
    const rows = await this.db.query(sql<{ readonly offset_ms: number }>`
      SELECT offset_ms FROM billing_mock_clocks WHERE id = ${customer}`);
    return Number(rows[0]?.offset_ms ?? 0);
  }

  async setClockOffsetMs(customer: string, offsetMs: number): Promise<void> {
    await this.db.run(sql`
      INSERT INTO billing_mock_clocks (id, offset_ms) VALUES (${customer}, ${offsetMs})
      ON CONFLICT (id) DO UPDATE SET offset_ms = excluded.offset_ms`);
  }

  async idempotentResponse(key: string): Promise<IdempotentResponse | null> {
    const rows = await this.db.query(sql<{
      readonly fingerprint: string;
      readonly status: number;
      readonly response: string;
      readonly first_seen_ms: number;
    }>`
      SELECT fingerprint, status, response, first_seen_ms
      FROM billing_mock_idempotency WHERE id = ${key}`);
    const row = rows[0];
    return row === undefined
      ? null
      : {
          fingerprint: row.fingerprint,
          status: Number(row.status),
          response: row.response,
          firstSeenMs: Number(row.first_seen_ms),
        };
  }

  async saveIdempotentResponse(
    key: string,
    saved: IdempotentResponse
  ): Promise<void> {
    await this.db.run(sql`
      INSERT INTO billing_mock_idempotency
        (id, fingerprint, status, response, first_seen_ms)
      VALUES (${key}, ${saved.fingerprint}, ${saved.status}, ${saved.response},
        ${saved.firstSeenMs})
      ON CONFLICT (id) DO UPDATE SET fingerprint = excluded.fingerprint,
        status = excluded.status, response = excluded.response,
        first_seen_ms = excluded.first_seen_ms`);
  }

  async insertEvent(event: MockEvent, nextAttemptMs: number): Promise<void> {
    const seq = await this.nextSeq('events');
    await this.db.run(sql`
      INSERT INTO billing_mock_events
        (id, event_type, body, seq, delivery, attempts, next_attempt_ms)
      VALUES (${event.id}, ${event.type}, ${JSON.stringify(event)}, ${seq},
        ${'pending'}, ${0}, ${nextAttemptMs})`);
  }

  async event(id: string): Promise<MockEvent | null> {
    const rows = await this.db.query(sql<BodyRow>`
      SELECT body FROM billing_mock_events WHERE id = ${id}`);
    const row = rows[0];
    return row === undefined ? null : (JSON.parse(row.body) as MockEvent);
  }

  /** Newest first, optionally of one type. */
  async events(type: string | null): Promise<readonly MockEvent[]> {
    const rows = await this.db.query(
      type === null
        ? sql<BodyRow>`SELECT body FROM billing_mock_events ORDER BY seq DESC`
        : sql<BodyRow>`SELECT body FROM billing_mock_events WHERE event_type = ${type} ORDER BY seq DESC`
    );
    return rows.map((row) => JSON.parse(row.body) as MockEvent);
  }

  /** Pending deliveries due by `nowMs`, oldest first. */
  async dueEvents(nowMs: number): Promise<readonly PendingEvent[]> {
    const rows = await this.db.query(sql<{
      readonly body: string;
      readonly attempts: number;
    }>`
      SELECT body, attempts FROM billing_mock_events
      WHERE delivery = ${'pending'} AND next_attempt_ms <= ${nowMs}
      ORDER BY seq ASC`);
    return rows.map((row) => ({
      event: JSON.parse(row.body) as MockEvent,
      attempts: Number(row.attempts),
    }));
  }

  /** The earliest pending attempt still in the future, if any. */
  async nextAttemptMs(): Promise<number | null> {
    const rows = await this.db.query(sql<{ readonly n: number | null }>`
      SELECT MIN(next_attempt_ms) AS n FROM billing_mock_events
      WHERE delivery = ${'pending'}`);
    const next = rows[0]?.n;
    return next === null || next === undefined ? null : Number(next);
  }

  async recordAttempt(args: {
    readonly id: string;
    readonly delivery: EventDelivery;
    readonly attempts: number;
    readonly nextAttemptMs: number;
  }): Promise<void> {
    await this.db.run(sql`
      UPDATE billing_mock_events
      SET delivery = ${args.delivery}, attempts = ${args.attempts},
          next_attempt_ms = ${args.nextAttemptMs}
      WHERE id = ${args.id}`);
  }
}
