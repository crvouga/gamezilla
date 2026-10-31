import type { Clock } from '@pkgs/clock-shared-ts/types';
import { createLogger } from '@pkgs/logger-shared-ts/logger';
import type { ObjectStore } from '@pkgs/object-store-root-shared-ts/interface';
import type {
  SqlClient,
  SqlTx,
} from '@pkgs/sql-client-root-shared-ts/interface';
import { isTransientConflict } from '@pkgs/sql-client-root-shared-ts/transient-conflict';
import sql, { join, raw } from '@pkgs/sql-root-shared-ts/sql';
import type { CreateId } from '@pkgs/uuid-shared-ts/create-id';
import { withOutboxCausation } from './causation';
import type { OutboxConsumerRegistry } from './define-consumer';
import { resolveRetryPolicy } from './define-consumer';
import { ensureDeliveries } from './ensure-deliveries';
import type { OutboxConsumerDef } from './types';

type PendingEventRow = {
  readonly id: string;
  readonly type: string;
  /** Text on SQLite; often already-parsed object on Postgres json. */
  readonly payload: unknown;
  readonly causation_id: string | null;
};

type ClaimRow = {
  readonly event_id: string;
  readonly consumer_id: string;
  readonly attempts: number;
  readonly available_at: string;
};

export type ObserveOutboxPhase = <T>(
  phase: 'outbox-materialize' | 'outbox-claim' | 'outbox-commit',
  run: () => Promise<T>
) => Promise<T>;

export type DrainOutboxDeps = {
  readonly db: SqlClient;
  readonly clock: Clock;
  readonly createId: CreateId;
  readonly registry: OutboxConsumerRegistry;
  readonly limit?: number;
  /** Optional queue partition selected by the worker. */
  readonly eventIds?: readonly string[];
  /** Exact durable causal families; omitted for the owned all-backlog drain. */
  readonly causationIds?: readonly string[];
  /** Records each delivery; absent in hosts that keep no telemetry. */
  readonly observeDelivery?: ObserveDelivery;
  readonly observePhase?: ObserveOutboxPhase;
  /** Starts after the claim is locked; finishes only after commit or rollback. */
  readonly measureDelivery?: (info: {
    readonly consumerId: string;
    readonly attempt: number;
    readonly eligibleAtMs: number;
  }) => (success: boolean) => void;
  /** Oldest selected ready work, before lock acquisition; null means no candidate. */
  readonly observeOldestReady?: (eligibleAtMs: number | null) => void;
  /** Runs after a delivery transaction commits, before any following delivery. */
  readonly afterDelivery?: (result: DrainOutboxResult) => Promise<void>;
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
  if (deps.causationIds?.length === 0 || deps.eventIds?.length === 0)
    return { processed: 0, exhausted: 0, notifyUserIds: [] };
  const observe: ObserveOutboxPhase =
    deps.observePhase ?? ((_phase, run) => run());
  const limit = deps.limit ?? 50;
  const log = createLogger({
    name: 'outbox-drain',
    now: deps.clock.now,
  });
  const notifyUserIds = new Set<string>();

  const claims = await deps.db.transaction(async (tx) => {
    await observe('outbox-materialize', () => ensureDeliveries(tx, deps));
    return observe('outbox-claim', () =>
      claimDueDeliveries(tx, { ...deps, limit })
    );
  });
  deps.observeOldestReady?.(
    claims.length === 0 ? null : new Date(claims[0]!.available_at).getTime()
  );
  let processed = 0;
  let exhausted = 0;
  for (const claim of claims) {
    const deliveryUsers = new Set<string>();
    const result = await observe('outbox-commit', () =>
      commitClaim({ deps, claim, log, notifyUserIds: deliveryUsers })
    );
    processed += result.processed;
    exhausted += result.exhausted;
    for (const id of deliveryUsers) notifyUserIds.add(id);
    await deps.afterDelivery?.({
      ...result,
      notifyUserIds: [...deliveryUsers].sort(),
    });
  }

  return { processed, exhausted, notifyUserIds: [...notifyUserIds].sort() };
}

async function commitClaim(args: {
  readonly deps: DrainOutboxDeps;
  readonly claim: ClaimRow;
  readonly log: ReturnType<typeof createLogger>;
  readonly notifyUserIds: Set<string>;
}): Promise<{ processed: number; exhausted: number }> {
  const { deps, claim } = args;
  let finish = (_success: boolean): void => undefined;
  try {
    const result = await deps.db.transaction(async (tx) => {
      // A concurrent worker may already have committed or rescheduled this candidate.
      const locked = await tx.run(sql`
        UPDATE outbox_deliveries SET updated_at = updated_at
        WHERE event_id = ${claim.event_id} AND consumer_id = ${claim.consumer_id}
          AND attempts = ${claim.attempts} AND processed_at IS NULL
          AND deleted_at IS NULL
          AND available_at <= ${new Date(deps.clock.now()).toISOString()}
      `);
      if (locked.changes === 0) return { processed: 0, exhausted: 0 };
      finish =
        deps.measureDelivery?.({
          consumerId: claim.consumer_id,
          attempt: claim.attempts + 1,
          eligibleAtMs: new Date(claim.available_at).getTime(),
        }) ?? finish;
      return processClaims({ ...args, tx, claims: [claim] });
    });
    finish(result.processed > 0);
    return result;
  } catch (error) {
    finish(false);
    throw error;
  }
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
    const result = await observeDelivery(
      {
        tx: deps.wrapConsumerTx?.(tx) ?? tx,
        transaction: tx,
        clock: deps.clock,
        createId: deps.createId,
        ...(deps.objectStore === undefined
          ? {}
          : { objectStore: deps.objectStore }),
        consumer,
        event,
        claim,
        log,
      },
      deps.observeDelivery
    );
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

async function claimDueDeliveries(
  tx: SqlTx,
  options: DrainOutboxDeps & { limit: number }
): Promise<readonly ClaimRow[]> {
  const { clock, limit, registry, eventIds, causationIds } = options;
  const nowIso = new Date(clock.now()).toISOString();
  const consumers = registry.all().map((consumer) => consumer.id);
  if (consumers.length === 0 || eventIds?.length === 0) return [];
  // Select candidates; each delivery transaction locks and rechecks before work.
  const rows = await tx.query(sql<ClaimRow>`
    SELECT event_id, consumer_id, attempts, available_at
      FROM outbox_deliveries
     WHERE processed_at IS NULL
       AND deleted_at IS NULL
       AND available_at <= ${nowIso}
       AND consumer_id IN (${join(consumers)})
       ${eventIds === undefined ? sql`` : sql`AND event_id IN (${join(eventIds)})`}
       ${causationIds === undefined ? sql`` : sql`AND event_id IN (SELECT id FROM outbox_events WHERE causation_id IN (${join(causationIds)}))`}
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
    SELECT id, type, payload, causation_id
      FROM outbox_events
     WHERE id = ${eventId}
       AND deleted_at IS NULL
     LIMIT 1
  `);
  return rows[0] ?? null;
}

export type DeliveryResult = {
  readonly ok: boolean;
  /** The delivery spent its last attempt (or can never run) and is parked. */
  readonly parked: boolean;
  readonly notifyUserIds: readonly string[];
  readonly failure?: string;
};

/** What a host needs to name one delivery in its telemetry. */
export type DeliveryInfo = {
  readonly consumerId: string;
  readonly eventType: string;
  readonly eventId: string;
  /** 1 for the first try. */
  readonly attempt: number;
};

/**
 * Wraps one delivery so the host can record it. A failed delivery becomes a
 * scheduled retry, not an exception, so `failure` is how the host learns of it.
 */
export type ObserveDelivery = (
  info: DeliveryInfo,
  run: () => Promise<DeliveryResult>
) => Promise<DeliveryResult>;

function observeDelivery(
  args: Parameters<typeof runDelivery>[0],
  observe: ObserveDelivery | undefined
): Promise<DeliveryResult> {
  const run = () => runDelivery(args);
  if (observe === undefined) return run();
  return observe(
    {
      consumerId: args.consumer.id,
      eventType: args.event.type,
      eventId: args.claim.event_id,
      attempt: args.claim.attempts + 1,
    },
    run
  );
}

/**
 * A consumer runs inside a savepoint. When it throws, the database has aborted
 * the whole transaction (Postgres refuses every later statement), so recording
 * the failure needs the transaction back first. Without the savepoint, one
 * failed consumer made the retry bookkeeping fail too and rolled back the entire
 * pass, so the same delivery failed on every run and held up every other one.
 */
const DELIVERY_SAVEPOINT = 'outbox_delivery';

async function runDelivery(args: {
  /** The consumer's view of the transaction: capture wrappers included. */
  readonly tx: SqlTx;
  /** The drain's own transaction, for savepoints. */
  readonly transaction: SqlTx;
  readonly clock: Clock;
  readonly createId: CreateId;
  readonly objectStore?: ObjectStore;
  readonly consumer: OutboxConsumerDef;
  readonly event: PendingEventRow;
  readonly claim: ClaimRow;
  readonly log: ReturnType<typeof createLogger>;
}): Promise<DeliveryResult> {
  const { tx, transaction, clock, createId, consumer, event, claim, log } =
    args;
  const policy = resolveRetryPolicy(consumer);
  let payload: unknown;
  try {
    // Postgres `json` columns often return already-parsed objects;
    // SQLite stores JSON as text. Accept both wire shapes.
    payload =
      typeof event.payload === 'string'
        ? (JSON.parse(event.payload) as unknown)
        : event.payload;
  } catch (error: unknown) {
    return {
      ok: false,
      parked: await failDelivery({
        tx,
        clock,
        claim,
        policy,
        error: error instanceof Error ? error.message : String(error),
        log,
        permanent: true,
      }),
      notifyUserIds: [],
      failure: 'payload is not valid JSON',
    };
  }

  if (!consumer.on.validatePayload(payload)) {
    return {
      ok: false,
      parked: await failDelivery({
        tx,
        clock,
        claim,
        policy,
        error: `invalid payload for ${event.type}`,
        log,
        permanent: true,
      }),
      notifyUserIds: [],
      failure: `invalid payload for ${event.type}`,
    };
  }

  await transaction.run(raw(`SAVEPOINT ${DELIVERY_SAVEPOINT}`));
  try {
    const result = await consumer.handler(
      {
        tx: withOutboxCausation(tx, event.causation_id),
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
    await transaction.run(raw(`ROLLBACK TO SAVEPOINT ${DELIVERY_SAVEPOINT}`));
    const message = error instanceof Error ? error.message : String(error);
    const parked = await failDelivery({
      tx,
      clock,
      claim,
      policy,
      error: message,
      log,
      permanent: false,
      conflict: isTransientConflict(error),
    });
    return { ok: false, parked, notifyUserIds: [], failure: message };
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
  /** The database aborted this attempt in a race; the work itself is not at fault. */
  readonly conflict?: boolean;
}): Promise<boolean> {
  const { tx, clock, claim, policy, error, log, permanent } = args;
  const conflict = args.conflict === true && !permanent;
  // A lost race costs no attempt: spending the retry budget on contention would
  // eventually park a healthy delivery for a year.
  const attempts = conflict ? claim.attempts : claim.attempts + 1;
  const nowMs = clock.now();
  if (!conflict && (permanent || attempts >= policy.maxAttempts)) {
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
    policy.backoffMs[
      Math.max(0, Math.min(attempts - 1, policy.backoffMs.length - 1))
    ] ?? 60_000;
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
