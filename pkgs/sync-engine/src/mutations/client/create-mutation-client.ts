import { sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { ZodError } from 'zod';

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
};

export type MutationConnectivity = {
  readonly isOnline: () => boolean;
};

export type MutationClient = {
  readonly query: SqlClient['query'];
  readonly mutate: <A>(m: Mutation<A>, args: A) => Promise<MutateResult>;
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
  }) => void;
  /** Deterministic id mint for sim; defaults to crypto.randomUUID. */
  readonly createId?: () => string;
};

async function nextMutationSeq(tx: SqlClient): Promise<number> {
  const rows = await tx.query(sql<{ next: number | null }>`
    SELECT COALESCE(MAX(seq), 0) + 1 AS next FROM _mutations
  `);
  return Number(rows[0]?.next ?? 1);
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
        await db.transaction(async (txc) => {
          const seq = await nextMutationSeq(txc);
          const createdAt = env.now().toISOString();
          await m.run({ tx: wrapMutationDb(txc), env }, parsed);
          await txc.run(sql`
            INSERT INTO _mutations (
              id, name, args, client_id, seq, created_at
            )
            VALUES (
              ${mutationId},
              ${m.name},
              ${JSON.stringify(parsed)},
              ${ids.clientId},
              ${seq},
              ${createdAt}
            )
          `);
        });
        options.onQueued?.({
          mutation: m as Mutation<unknown>,
          args: parsed,
        });
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
