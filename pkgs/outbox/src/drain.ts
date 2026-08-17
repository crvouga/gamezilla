import type { Io } from '@pkgs/io';
import { createLogger } from '@pkgs/logger/logger';
import { sql } from '@pkgs/sql';
import type { SqlClient, SqlTx } from '@pkgs/sql-client/interface';

import {
  type OutboxConsumerRegistry,
  resolveRetryPolicy,
} from './define-consumer';
import type { OutboxConsumerDef } from './types';

type PendingEventRow = {
  readonly id: string;
  readonly type: string;
  readonly payload: string;
};

type ClaimRow = {
  readonly event_id: string;
  readonly consumer_id: string;
  readonly attempts: number;
};

export type DrainOutboxDeps = {
  readonly db: SqlClient;
  readonly io: Io;
  readonly registry: OutboxConsumerRegistry;
  readonly limit?: number;
};

export type DrainOutboxResult = {
  readonly processed: number;
  readonly notifyUserIds: readonly string[];
};

/**
 * Ensure delivery rows exist for registered consumers, claim due work, run
 * handlers, mark processed or schedule retry.
 */
export async function drainOutbox(
  deps: DrainOutboxDeps
): Promise<DrainOutboxResult> {
  const limit = deps.limit ?? 50;
  const log = createLogger({
    name: 'outbox-drain',
    now: deps.io.clock.now,
  });
  const notifyUserIds = new Set<string>();

  const processed = await deps.db.transaction(async (tx) => {
    await ensureDeliveries(tx, deps.registry, deps.io);
    const claims = await claimDueDeliveries(tx, deps.io, limit);
    let count = 0;
    for (const claim of claims) {
      const consumer = deps.registry.get(claim.consumer_id);
      if (consumer === undefined) {
        log.warn('missing consumer for delivery', {
          consumerId: claim.consumer_id,
          eventId: claim.event_id,
        });
        continue;
      }
      const event = await loadEvent(tx, claim.event_id);
      if (event === null) {
        await markProcessed(tx, claim, deps.io);
        count += 1;
        continue;
      }
      const result = await runDelivery({
        tx,
        io: deps.io,
        consumer,
        event,
        claim,
        log,
      });
      if (result.ok) {
        count += 1;
        for (const id of result.notifyUserIds) {
          if (id.length > 0) notifyUserIds.add(id);
        }
      }
    }
    return count;
  });

  return { processed, notifyUserIds: [...notifyUserIds].sort() };
}

async function ensureDeliveries(
  tx: SqlTx,
  registry: OutboxConsumerRegistry,
  io: Io
): Promise<void> {
  const nowIso = new Date(io.clock.now()).toISOString();
  for (const consumer of registry.all()) {
    const missing = await tx.query(sql<{ id: string }>`
      SELECT e.id
        FROM outbox_events e
       WHERE e.type = ${consumer.on.type}
         AND NOT EXISTS (
           SELECT 1
             FROM outbox_deliveries d
            WHERE d.event_id = e.id
              AND d.consumer_id = ${consumer.id}
         )
       LIMIT 200
    `);
    for (const row of missing) {
      await tx.run(sql`
        INSERT INTO outbox_deliveries (
          event_id, consumer_id, attempts, available_at, processed_at, last_error
        )
        VALUES (
          ${row.id}, ${consumer.id}, ${0}, ${nowIso}, ${null}, ${null}
        )
        ON CONFLICT (event_id, consumer_id) DO NOTHING
      `);
    }
  }
}

async function claimDueDeliveries(
  tx: SqlTx,
  io: Io,
  limit: number
): Promise<readonly ClaimRow[]> {
  const nowIso = new Date(io.clock.now()).toISOString();
  // Portable claim: select then bump attempts in the same tx (single Worker drain).
  const rows = await tx.query(sql<ClaimRow>`
    SELECT event_id, consumer_id, attempts
      FROM outbox_deliveries
     WHERE processed_at IS NULL
       AND available_at <= ${nowIso}
     ORDER BY available_at ASC
     LIMIT ${limit}
  `);
  return rows;
}

async function loadEvent(
  tx: SqlTx,
  eventId: string
): Promise<PendingEventRow | null> {
  const rows = await tx.query(sql<PendingEventRow>`
    SELECT id, type, payload
      FROM outbox_events
     WHERE id = ${eventId}
     LIMIT 1
  `);
  return rows[0] ?? null;
}

async function runDelivery(args: {
  readonly tx: SqlTx;
  readonly io: Io;
  readonly consumer: OutboxConsumerDef;
  readonly event: PendingEventRow;
  readonly claim: ClaimRow;
  readonly log: ReturnType<typeof createLogger>;
}): Promise<{ ok: boolean; notifyUserIds: readonly string[] }> {
  const { tx, io, consumer, event, claim, log } = args;
  const policy = resolveRetryPolicy(consumer);
  let payload: unknown;
  try {
    payload = JSON.parse(event.payload) as unknown;
  } catch (error: unknown) {
    await failDelivery({
      tx,
      io,
      claim,
      policy,
      error: error instanceof Error ? error.message : String(error),
      log,
      permanent: true,
    });
    return { ok: false, notifyUserIds: [] };
  }

  if (!consumer.on.validatePayload(payload)) {
    await failDelivery({
      tx,
      io,
      claim,
      policy,
      error: `invalid payload for ${event.type}`,
      log,
      permanent: true,
    });
    return { ok: false, notifyUserIds: [] };
  }

  try {
    const result = await consumer.handler({ tx, io }, payload);
    await markProcessed(tx, claim, io);
    return {
      ok: true,
      notifyUserIds: result?.notifyUserIds ?? [],
    };
  } catch (error: unknown) {
    await failDelivery({
      tx,
      io,
      claim,
      policy,
      error: error instanceof Error ? error.message : String(error),
      log,
      permanent: false,
    });
    return { ok: false, notifyUserIds: [] };
  }
}

async function markProcessed(
  tx: SqlTx,
  claim: ClaimRow,
  io: Io
): Promise<void> {
  const nowIso = new Date(io.clock.now()).toISOString();
  await tx.run(sql`
    UPDATE outbox_deliveries
       SET processed_at = ${nowIso},
           last_error = ${null}
     WHERE event_id = ${claim.event_id}
       AND consumer_id = ${claim.consumer_id}
  `);
}

async function failDelivery(args: {
  readonly tx: SqlTx;
  readonly io: Io;
  readonly claim: ClaimRow;
  readonly policy: ReturnType<typeof resolveRetryPolicy>;
  readonly error: string;
  readonly log: ReturnType<typeof createLogger>;
  readonly permanent: boolean;
}): Promise<void> {
  const { tx, io, claim, policy, error, log, permanent } = args;
  const attempts = claim.attempts + 1;
  const nowMs = io.clock.now();
  if (permanent || attempts >= policy.maxAttempts) {
    log.error('outbox delivery exhausted', {
      eventId: claim.event_id,
      consumerId: claim.consumer_id,
      attempts,
      error,
    });
    const far = new Date(nowMs + 365 * 24 * 60 * 60 * 1000).toISOString();
    await tx.run(sql`
      UPDATE outbox_deliveries
         SET attempts = ${attempts},
             available_at = ${far},
             last_error = ${error}
       WHERE event_id = ${claim.event_id}
         AND consumer_id = ${claim.consumer_id}
    `);
    return;
  }
  const backoff =
    policy.backoffMs[Math.min(attempts - 1, policy.backoffMs.length - 1)] ??
    60_000;
  const availableAt = new Date(nowMs + backoff).toISOString();
  log.warn('outbox delivery failed; retry scheduled', {
    eventId: claim.event_id,
    consumerId: claim.consumer_id,
    attempts,
    availableAt,
    error,
  });
  await tx.run(sql`
    UPDATE outbox_deliveries
       SET attempts = ${attempts},
           available_at = ${availableAt},
           last_error = ${error}
     WHERE event_id = ${claim.event_id}
       AND consumer_id = ${claim.consumer_id}
  `);
}
