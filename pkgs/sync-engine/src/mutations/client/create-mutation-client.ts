import { sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { ZodError } from 'zod';

import { bumpWriteEpoch } from '../../queries/client/write-epoch';
import {
  isMutationError,
  mutationErrorToFailure,
  zodFailures,
} from '../core/failures';
import type {
  MutateResult,
  Mutation,
  MutationEnv,
  MutationRegistry,
} from '../core/types';
import { wrapMutationDb } from '../shared/wrap-mutation-db';

export type MutationClientIds = {
  readonly clientId: string;
  readonly nextSeq: () => number;
};

export type MutationConnectivity = {
  readonly isOnline: () => boolean;
};

export type MutationClient = {
  readonly query: SqlClient['query'];
  readonly mutate: <A>(m: Mutation<A>, args: A) => Promise<MutateResult>;
};

export type MutationAppliedEvent = {
  readonly mutationId: string;
  readonly mutation: Mutation<unknown>;
  readonly args: unknown;
  readonly seq: number;
  readonly createdAt: string;
};

export type CreateMutationClientOptions = {
  readonly db: SqlClient;
  readonly registry: MutationRegistry;
  readonly env: MutationEnv;
  readonly ids: MutationClientIds;
  readonly connectivity: MutationConnectivity;
  /** Fired after a mutation is durably queued for upload. */
  readonly onQueued?: () => void;
  /** Fired after local apply + queue — MQTT fanout hook. */
  readonly onApplied?: (event: MutationAppliedEvent) => void;
  /** Deterministic id mint for sim; defaults to crypto.randomUUID. */
  readonly createId?: () => string;
};

function isMissingUploadState(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes('no such table') ||
    message.includes('no such column') ||
    message.includes('does not exist')
  );
}

async function reserveMutationSeq(
  tx: SqlClient,
  ids: MutationClientIds
): Promise<number> {
  try {
    const rows = await tx.query(sql<{ next_seq: number }>`
      SELECT next_seq FROM _upload_state WHERE id = ${'singleton'} LIMIT 1
    `);
    const next = Number(rows[0]?.next_seq ?? 1);
    await tx.run(sql`
      UPDATE _upload_state SET next_seq = ${next + 1}
      WHERE id = ${'singleton'}
    `);
    return next;
  } catch (error) {
    if (isMissingUploadState(error)) return ids.nextSeq();
    throw error;
  }
}

/**
 * THE client write API. Exposes read-only `query` and `mutate` only —
 * never a writable transaction outside a mutation's `run`.
 */
export function createMutationClient(
  options: CreateMutationClientOptions
): MutationClient {
  const { db, env, ids, connectivity } = options;
  return {
    query: db.query.bind(db) as SqlClient['query'],

    async mutate<A>(m: Mutation<A>, args: A): Promise<MutateResult> {
      if (m.requiresOnline === true && !connectivity.isOnline()) {
        return {
          ok: false,
          failures: [
            {
              rule: m.name,
              code: 'OFFLINE',
              message: 'This action needs a connection.',
            },
          ],
        };
      }

      const mutationId = (options.createId ?? (() => crypto.randomUUID()))();
      try {
        const parsed = m.args.parse(args);
        let appliedSeq = 0;
        let createdAt = '';
        await db.transaction(async (txc) => {
          const seq = await reserveMutationSeq(txc, ids);
          const epoch = await bumpWriteEpoch(txc);
          appliedSeq = seq;
          createdAt = env.now().toISOString();
          await m.run({ tx: wrapMutationDb(txc), env }, parsed);
          await txc.run(sql`
            INSERT INTO _mutations (
              id, name, args, client_id, seq, created_at, epoch, status
            )
            VALUES (
              ${mutationId},
              ${m.name},
              ${JSON.stringify(parsed)},
              ${ids.clientId},
              ${seq},
              ${createdAt},
              ${epoch},
              ${'pending'}
            )
          `);
        });
        options.onApplied?.({
          mutationId,
          mutation: m as Mutation<unknown>,
          args: parsed,
          seq: appliedSeq,
          createdAt,
        });
        options.onQueued?.();
        return { ok: true, mutationId };
      } catch (e) {
        if (isMutationError(e)) {
          return {
            ok: false,
            failures: [mutationErrorToFailure(e, m.name)],
          };
        }
        if (e instanceof ZodError) {
          return { ok: false, failures: zodFailures(e, m.name) };
        }
        throw e;
      }
    },
  };
}
