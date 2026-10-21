import type { Clock } from '@pkgs/clock-shared/types';
import { createLogger } from '@pkgs/logger-shared/logger';
import type { ObjectStore } from '@pkgs/object-store-root-shared/interface';
import type { SqlClient, SqlTx } from '@pkgs/sql-client-root-shared/interface';
import sql, { join } from '@pkgs/sql-root-shared/sql';
import type { CreateId } from '@pkgs/uuid-shared/create-id';

import type { OutboxConsumerRegistry } from './define-consumer';
import { resolveRetryPolicy } from './define-consumer';
import type { OutboxConsumerDef } from './types';

type PendingEventRow = {
  readonly id: string;
  readonly type: string;
  /** Text on SQLite; often already-parsed object on Postgres json. */
  readonly payload: unknown;
};

type ClaimRow = {
  readonly event_id: string;
  readonly consumer_id: string;
  readonly attempts: number;
};

export type DrainOutboxDeps = {
  readonly db: SqlClient;
  readonly clock: Clock;
  readonly createId: CreateId;
  readonly registry: OutboxConsumerRegistry;
  readonly limit?: number;
  /** Optional queue partition selected by the worker. */
  readonly eventIds?: readonly string[];
  /** Host capture / managed-row wrapper for consumer domain writes. */
  readonly wrapConsumerTx?: (tx: SqlTx) => SqlTx;
  readonly objectStore?: ObjectStore;
};

export type DrainOutboxResult = {
  readonly processed: number;
  /**
   * Deliveries this pass gave up on: their last attempt failed (or the payload
   * could never be read), so they are parked and will not run again without
   * reconciliation. Hosts count these; a log line alone goes unseen.
   */
  readonly exhausted: number;
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
    now: deps.clock.now,
  });
  const notifyUserIds = new Set<string>();

  const { processed, exhausted } = await deps.db.transaction(async (tx) => {
    await ensureDeliveries(tx, deps.registry, deps.clock);
    const claims = await claimDueDeliveries(tx, { ...deps, limit });
    return processClaims({ deps, tx, claims, log, notifyUserIds });
  });

  return { processed, exhausted, notifyUserIds: [...notifyUserIds].sort() };
}

async function processClaims(args: {
  deps: DrainOutboxDeps;
  tx: SqlTx;
  claims: readonly ClaimRow[];
  log: ReturnType<typeof createLogger>;
  notifyUserIds: Set<string>;
}): Promise<{ processed: number; exhausted: number }> {
  const { deps, tx, claims, log, notifyUserIds } = args;
  let count = 0;
  let exhausted = 0;
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
      await markProcessed(tx, claim, deps.clock);
      count += 1;
      continue;
    }
    const result = await runDelivery({
      tx: deps.wrapConsumerTx?.(tx) ?? tx,
      clock: deps.clock,
      createId: deps.createId,
      ...(deps.objectStore === undefined
        ? {}
        : { objectStore: deps.objectStore }),
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
    } else if (result.parked) {
      exhausted += 1;
    }
  }
  return { processed: count, exhausted };
}

/** Events given a delivery per consumer in one pass. */
const DELIVERIES_PER_CONSUMER_PER_PASS = 200;

/**
 * One statement for every consumer. A pass runs inside a transaction that
 * holds one of the pooled database sessions, and each statement costs a
 * round trip to the database, so the statement count must not grow with the
 * number of registered consumers.
 */
async function ensureDeliveries(
  tx: SqlTx,
  registry: OutboxConsumerRegistry,
  clock: Clock
): Promise<void> {
  const consumers = registry.all();
  if (consumers.length === 0) return;
  const nowIso = new Date(clock.now()).toISOString();
  const subscriptions = join(
    consumers.map(
      (consumer) =>
        sql`SELECT ${consumer.on.type} AS type, ${consumer.id} AS consumer_id`
    ),
    ' UNION ALL '
  );
  await tx.run(sql`
    INSERT INTO outbox_deliveries (
      id, event_id, consumer_id, attempts, available_at, processed_at,
      last_error, created_at, updated_at, deleted_at
    )
    SELECT e.id || ':' || s.consumer_id, e.id, s.consumer_id, 0,
           COALESCE(e.available_at, ${nowIso}), NULL,
           NULL, ${nowIso}, ${nowIso}, NULL
      FROM outbox_events e
      JOIN (${subscriptions}) s ON s.type = e.type
     WHERE e.deleted_at IS NULL
       AND NOT EXISTS (
         SELECT 1
           FROM outbox_deliveries d
          WHERE d.event_id = e.id
            AND d.consumer_id = s.consumer_id
            AND d.deleted_at IS NULL
       )
     LIMIT ${DELIVERIES_PER_CONSUMER_PER_PASS * consumers.length}
    ON CONFLICT (event_id, consumer_id) DO NOTHING
  `);
}

async function claimDueDeliveries(
  tx: SqlTx,
  options: DrainOutboxDeps & { limit: number }
): Promise<readonly ClaimRow[]> {
  const { clock, limit, registry, eventIds } = options;
  const nowIso = new Date(clock.now()).toISOString();
  const consumers = registry.all().map((consumer) => consumer.id);
  if (consumers.length === 0 || eventIds?.length === 0) return [];
  // Portable claim: select then bump attempts in the same tx (single Worker drain).
  const rows = await tx.query(sql<ClaimRow>`
    SELECT event_id, consumer_id, attempts
      FROM outbox_deliveries
     WHERE processed_at IS NULL
       AND deleted_at IS NULL
       AND available_at <= ${nowIso}
       AND consumer_id IN (${join(consumers)})
       ${eventIds === undefined ? sql`` : sql`AND event_id IN (${join(eventIds)})`}
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
       AND deleted_at IS NULL
     LIMIT 1
  `);
  return rows[0] ?? null;
}

async function runDelivery(args: {
  readonly tx: SqlTx;
  readonly clock: Clock;
  readonly createId: CreateId;
  readonly objectStore?: ObjectStore;
  readonly consumer: OutboxConsumerDef;
  readonly event: PendingEventRow;
  readonly claim: ClaimRow;
  readonly log: ReturnType<typeof createLogger>;
}): Promise<{
  ok: boolean;
  parked: boolean;
  notifyUserIds: readonly string[];
}> {
  const { tx, clock, createId, consumer, event, claim, log } = args;
  const fail = async (error: unknown, permanent: boolean) => ({
    ok: false,
    parked: await failDelivery({
      tx,
      clock,
      claim,
      policy: resolveRetryPolicy(consumer),
      error: error instanceof Error ? error.message : String(error),
      log,
      permanent,
    }),
    notifyUserIds: [],
  });
  let payload: unknown;
  try {
    // Postgres `json` columns often return already-parsed objects;
    // SQLite stores JSON as text. Accept both wire shapes.
    payload =
      typeof event.payload === 'string'
        ? (JSON.parse(event.payload) as unknown)
        : event.payload;
  } catch (error: unknown) {
    return fail(error, true);
  }

  if (!consumer.on.validatePayload(payload)) {
    return fail(`invalid payload for ${event.type}`, true);
  }

  try {
    const result = await consumer.handler(
      {
        tx,
        clock,
        createId,
        ...(args.objectStore === undefined
          ? {}
          : { objectStore: args.objectStore }),
      },
      payload
    );
    await markProcessed(tx, claim, clock);
    return {
      ok: true,
      parked: false,
      notifyUserIds: result?.notifyUserIds ?? [],
    };
  } catch (error: unknown) {
    return fail(error, false);
  }
}

async function markProcessed(
  tx: SqlTx,
  claim: ClaimRow,
  clock: Clock
): Promise<void> {
  const nowIso = new Date(clock.now()).toISOString();
  await tx.run(sql`
    UPDATE outbox_deliveries
       SET processed_at = ${nowIso},
           last_error = ${null}
     WHERE event_id = ${claim.event_id}
       AND consumer_id = ${claim.consumer_id}
  `);
}

/** Schedules a retry, or parks a spent delivery and returns true. */
async function failDelivery(args: {
  readonly tx: SqlTx;
  readonly clock: Clock;
  readonly claim: ClaimRow;
  readonly policy: ReturnType<typeof resolveRetryPolicy>;
  readonly error: string;
  readonly log: ReturnType<typeof createLogger>;
  readonly permanent: boolean;
}): Promise<boolean> {
  const { tx, clock, claim, policy, error, log, permanent } = args;
  const attempts = claim.attempts + 1;
  const nowMs = clock.now();
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
    return true;
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
  return false;
}
