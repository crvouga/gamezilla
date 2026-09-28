import { assert } from '@pkgs/assert';
import { serializeTraceContext } from '@pkgs/observability/core';
import { sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';
import type { CreateId } from '@pkgs/uuid';
import { assertUuid, createUuidV7 } from '@pkgs/uuid';
import {
  mutationCorrelationIdentity,
  mutationOriginTraceparent,
} from '../../client/interaction-correlation';
import { isStorageFullError } from '../../client/storage-full-error';
import {
  parseStandardSchema,
  schemaIssuesToFailures,
} from '../../shared/standard-schema';
import type { WriteCaptureSnapshot } from '../../sql-ast';
import { isMutationError, mutationErrorToFailure } from '../core/failures';
import type {
  MutateResult,
  Mutation,
  MutationEnv,
  MutationRegistry,
} from '../core/types';
import { wrapMutationDb } from '../shared/wrap-mutation-db';
import type { MutationVerdict } from './mutation-status';
import { recordOptimisticOwnRows } from './optimistic-own-rows';

export type MutationClientIds = {
  readonly clientId: string;
};

export type MutationConnectivity = {
  readonly isOnline: () => boolean;
};

export type MutationClient = {
  readonly query: SqlClient['query'];
  readonly mutate: <A>(m: Mutation<A>, args: A) => Promise<MutateResult>;
  /**
   * Resolves once every mutation queued so far has finished its local apply.
   * Hosts await this before closing the SQL client so teardown can never write
   * to a closed database (fire-and-forget bootstrap mutations outlive the
   * component tree).
   */
  readonly drain: () => Promise<void>;
};

export type CreateMutationClientOptions = {
  readonly db: SqlClient;
  readonly registry: MutationRegistry;
  readonly env: MutationEnv;
  readonly ids: MutationClientIds;
  readonly connectivity: MutationConnectivity;
  /** Fired after a mutation is durably queued for upload. */
  readonly onQueued?: (info: {
    readonly mutation: Mutation<unknown>;
    readonly args: unknown;
    readonly capture: WriteCaptureSnapshot;
  }) => void;
  /** Id mint for queued mutation rows (wall or harness). */
  readonly createId: CreateId;
  /**
   * Resolves once the server has applied or rejected `mutationId`. With it,
   * `mutate()` of a `pendingUx: 'pending'` mutation reports the server's
   * verdict instead of the local apply's (see {@link Mutation.pendingUx}).
   */
  readonly awaitVerdict?: (mutationId: string) => Promise<MutationVerdict>;
};

/**
 * A `pending` mutation's result is the server's: a local apply can pass a
 * rule the device cannot fully check (uniqueness against rows outside its
 * sync scope). Waits outside the mutation tail, so later writes are not
 * held behind the round trip.
 */
async function withServerVerdict<A>(
  m: Mutation<A>,
  local: MutateResult,
  awaitVerdict: CreateMutationClientOptions['awaitVerdict']
): Promise<MutateResult> {
  if (!local.ok || m.pendingUx !== 'pending' || awaitVerdict === undefined) {
    return local;
  }
  const verdict = await awaitVerdict(local.mutationId);
  if (verdict.status !== 'rejected') return local;
  return {
    ok: false,
    failures: [{ rule: m.name, code: verdict.code, message: verdict.message }],
  };
}

async function nextMutationSeq(tx: SqlClient): Promise<number> {
  const rows = await tx.query(sql<{ next: number | null }>`
    SELECT COALESCE(MAX(seq), 0) + 1 AS next FROM sync_engine_mutations
  `);
  const next = Number(rows[0]?.next ?? 1);
  assert.integer(next, 'sync_engine_mutations seq must be an integer');
  assert.ok(next > 0, 'sync_engine_mutations seq must be positive', {
    table: 'sync_engine_mutations',
    next,
  });
  return next;
}

async function nextUniqueMutationId(
  tx: SqlClient,
  createId: CreateId,
  nowMs: number
): Promise<string> {
  // Seeded harness streams can reset while `sync_engine_mutations` still holds
  // earlier mints (env remount). Skip forward past collisions; fail fast if
  // `createId` itself is stuck returning the same value.
  const seen = new Set<string>();
  for (let attempt = 0; attempt < 4096; attempt += 1) {
    const mutationId = createUuidV7(nowMs, createId());
    assertUuid(mutationId, 'sync_engine_mutations id must be a UUID');
    if (seen.has(mutationId)) {
      assert.fail('sync_engine createId returned a duplicate', {
        table: 'sync_engine_mutations',
        mutationId,
        attempt,
      });
    }
    seen.add(mutationId);
    const existing = await tx.query(sql<{ id: string }>`
      SELECT id FROM sync_engine_mutations WHERE id = ${mutationId} LIMIT 1
    `);
    if (existing.length === 0) return mutationId;
  }
  assert.fail('sync_engine mutation ID allocator produced collisions', {
    table: 'sync_engine_mutations',
    attempts: 4096,
    uniqueGenerated: seen.size,
  });
}

function isMutationQueueUniqueError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /unique constraint failed:\s*sync_engine_mutations(?:\.id)?/i.test(
    message
  );
}

function assertNoInternalTableError(
  error: unknown,
  mutation: string,
  clientId: string
): void {
  const message = error instanceof Error ? error.message : String(error);
  if (
    !/sync_engine_[a-z0-9_]+|unique constraint failed: sync_engine/i.test(
      message
    )
  )
    return;
  assert.fail('sync-engine internal table operation failed', {
    table: 'sync_engine_mutations',
    mutation,
    clientId,
    error: message,
  });
}

async function queueMutation<A>(args: {
  readonly db: SqlClient;
  readonly mutation: Mutation<A>;
  readonly value: A;
  readonly env: MutationEnv;
  readonly clientId: string;
  readonly createId: CreateId;
  readonly originTraceparent: string | null;
  readonly originSessionId: string | null;
  readonly originBuildSha: string | null;
}): Promise<{
  readonly mutationId: string;
  readonly capture: WriteCaptureSnapshot;
}> {
  let mutationId = '';
  let capture: WriteCaptureSnapshot = { tables: [], ids: {}, images: {} };
  let queued = false;
  for (let attempt = 0; attempt < 8 && !queued; attempt += 1) {
    try {
      await args.db.transaction(async (txc) => {
        mutationId = await nextUniqueMutationId(
          txc,
          args.createId,
          args.env.now().getTime()
        );
        const seq = await nextMutationSeq(txc);
        const createdAt = args.env.now().toISOString();
        const wrapped = wrapMutationDb(txc, args.env);
        await args.mutation.run({ tx: wrapped.tx, env: args.env }, args.value);
        capture = wrapped.getCapture();
        await txc.run(sql`
          INSERT INTO sync_engine_mutations (
            id, name, args, client_id, seq, origin_traceparent,
            origin_session_id, origin_build_sha,
            created_at, updated_at, deleted_at
          )
          VALUES (
            ${mutationId},
            ${args.mutation.name},
            ${JSON.stringify(args.value)},
            ${args.clientId},
            ${seq},
            ${args.originTraceparent},
            ${args.originSessionId},
            ${args.originBuildSha},
            ${createdAt},
            ${createdAt},
            ${null}
          )
        `);
        await recordOptimisticOwnRows(txc, mutationId, capture, createdAt);
      });
      queued = true;
    } catch (e) {
      if (!isMutationQueueUniqueError(e) || attempt === 7) throw e;
    }
  }
  assert.ok(queued, 'sync_engine_mutations row must be queued');
  return { mutationId, capture };
}

function mutateCaughtResult(
  error: unknown,
  mutationName: string
): MutateResult | null {
  if (isMutationError(error)) {
    return {
      ok: false,
      failures: [mutationErrorToFailure(error, mutationName)],
    };
  }
  if (isStorageFullError(error)) {
    return {
      ok: false,
      failures: [
        {
          rule: mutationName,
          code: 'STORAGE_FULL',
          message: 'Device storage is full.',
        },
      ],
    };
  }
  return null;
}

function snapshotMutationEnv(env: MutationEnv): MutationEnv {
  const snapshot: MutationEnv = {
    actorId: env.actorId,
    deviceId: env.deviceId,
    accountId: env.accountId,
    isAnon: env.isAnon,
    now: env.now,
    createId: env.createId,
  };
  if (env.serverNow === undefined) {
    return snapshot;
  }
  return { ...snapshot, serverNow: env.serverNow };
}

/**
 * THE client write API. Exposes read-only `query`, `mutate`, and teardown
 * `drain` only — never a writable transaction outside a mutation's `run`.
 */
export function createMutationClient(
  options: CreateMutationClientOptions
): MutationClient {
  const { db, env, ids, connectivity } = options;
  let mutationTail: Promise<void> = Promise.resolve();
  return {
    query: db.query.bind(db) as SqlClient['query'],
    drain: () => mutationTail,

    async mutate<A>(m: Mutation<A>, args: A): Promise<MutateResult> {
      // Capture synchronously at the interaction boundary. Browser context
      // cannot survive the queued Promise tail, and offline upload may happen
      // hours after the originating span ended.
      const originTraceparent =
        mutationOriginTraceparent() ?? serializeTraceContext() ?? null;
      const correlationIdentity = mutationCorrelationIdentity();
      const mutationEnv = snapshotMutationEnv(env);
      const online = connectivity.isOnline();
      const run = mutationTail.then(async () => {
        if (m.requiresOnline === true && !online) {
          return {
            ok: false as const,
            failures: [
              {
                rule: m.name,
                code: 'OFFLINE',
                message: 'This action needs a connection.',
              },
            ],
          };
        }

        let mutationId = '';
        try {
          const parsed = await parseStandardSchema(m.args, args);
          if (!parsed.ok) {
            return {
              ok: false as const,
              failures: schemaIssuesToFailures(parsed.issues, m.name),
            };
          }
          const queued = await queueMutation({
            db,
            mutation: m,
            value: parsed.value,
            env: mutationEnv,
            clientId: ids.clientId,
            createId: options.createId,
            originTraceparent,
            originSessionId: correlationIdentity?.sessionId ?? null,
            originBuildSha: correlationIdentity?.buildSha ?? null,
          });
          mutationId = queued.mutationId;
          const capture = queued.capture;
          options.onQueued?.({
            mutation: m as Mutation<unknown>,
            args: parsed.value,
            capture,
          });
          return { ok: true as const, mutationId };
        } catch (e) {
          assertNoInternalTableError(e, m.name, ids.clientId);
          const caught = mutateCaughtResult(e, m.name);
          if (caught !== null) return caught;
          throw e;
        }
      });
      mutationTail = run.then(
        () => undefined,
        () => undefined
      );
      return withServerVerdict(m, await run, options.awaitVerdict);
    },
  };
}
