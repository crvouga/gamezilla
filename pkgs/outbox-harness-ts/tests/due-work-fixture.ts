import {
  createMessageNamespace,
  isPlainRecord,
} from '@pkgs/message-shared-ts/message';
import { withOutboxCausation } from '@pkgs/outbox-shared-ts/causation';
import { OutboxConsumerRegistry } from '@pkgs/outbox-shared-ts/define-consumer';
import type { DrainOutboxDeps } from '@pkgs/outbox-shared-ts/drain';
import { Outbox } from '@pkgs/outbox-shared-ts/outbox';
import { reconcileOutbox } from '@pkgs/outbox-shared-ts/reconcile';
import type { OutboxConsumerDef } from '@pkgs/outbox-shared-ts/types';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client-sqlite-root-server-ts/impl-bun-sqlite';
import sql from '@pkgs/sql-root-shared-ts/sql';

export const NOW = Date.parse('2026-10-01T00:00:00.000Z');
const ns = createMessageNamespace('outbox', 'due-work');
const valid = (value: unknown): value is { n: number } =>
  isPlainRecord(value) && typeof value['n'] === 'number';
export const Ping = ns('ping', valid);
export const Pong = ns('pong', valid);

export type EventInput = {
  readonly id: string;
  readonly kind?: 'ping' | 'pong';
  readonly at?: number;
  readonly deleted?: boolean;
  readonly causation?: string | null;
};
export type DeliveryInput = {
  readonly eventId: string;
  readonly consumerId?: string;
  readonly at?: number;
  readonly processed?: boolean;
  readonly deleted?: boolean;
};

export async function openDueWork() {
  const db = SqlClientImplBunSqlite.open(':memory:');
  await db.connect();
  await reconcileOutbox(db);
  let now = NOW;
  const clock = { now: () => now };
  const registry = new OutboxConsumerRegistry();
  const seen: string[] = [];
  const attempts: string[] = [];
  let nextId = 0;
  const deps: DrainOutboxDeps = {
    db,
    clock,
    registry,
    createId: () => `delivery-${++nextId}`,
    observeDelivery: async (info, run) => {
      attempts.push(`${info.eventId}:${info.consumerId}`);
      return run();
    },
  };
  const register = (ids: readonly string[]) => {
    for (const id of ids)
      registry.register({
        id,
        on: id === 'pong-worker' ? Pong : Ping,
        handler: async (_ctx, event) => {
          seen.push(`${id}:${event.n}`);
        },
      });
  };
  return {
    db,
    deps,
    seen,
    attempts,
    registry,
    register,
    advance: (ms: number) => {
      now += ms;
    },
    registerConsumer: (consumer: OutboxConsumerDef<{ n: number }>) =>
      registry.register(consumer),
    /** Appends through `tx`, a producer's own open transaction, or alone. */
    async append(event: EventInput, tx: Pick<typeof db, 'query' | 'run'> = db) {
      await new Outbox({
        tx: withOutboxCausation(tx, event.causation ?? null),
        env: { now: () => new Date(now), createId: deps.createId },
      }).send({
        id: event.id,
        message: (event.kind === 'pong' ? Pong : Ping)({ n: 7 }),
        availableAt: new Date(NOW + (event.at ?? 0)),
      });
      if (event.deleted)
        await tx.run(
          sql`UPDATE outbox_events SET deleted_at = ${new Date(now).toISOString()} WHERE id = ${event.id}`
        );
    },
    async delivery(input: DeliveryInput) {
      const consumer = input.consumerId ?? 'ping-worker';
      const iso = new Date(NOW).toISOString();
      await db.run(sql`INSERT INTO outbox_deliveries
        (id, event_id, consumer_id, attempts, available_at, processed_at, last_error, created_at, updated_at, deleted_at)
        VALUES (${`${input.eventId}:${consumer}`}, ${input.eventId}, ${consumer}, 0,
          ${new Date(NOW + (input.at ?? 0)).toISOString()}, ${input.processed ? iso : null},
          ${null}, ${iso}, ${iso}, ${input.deleted ? iso : null})`);
    },
    deliveryState: () =>
      db.query(
        sql<{
          id: string;
          attempts: number;
          processed_at: string | null;
          last_error: string | null;
        }>`SELECT id, attempts, processed_at, last_error FROM outbox_deliveries ORDER BY id`
      ),
  };
}
