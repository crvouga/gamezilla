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

export type CreateMutationClientOptions = {
  readonly db: SqlClient;
  readonly registry: MutationRegistry;
  readonly env: MutationEnv;
  readonly ids: MutationClientIds;
  readonly connectivity: MutationConnectivity;
};

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

      const mutationId = crypto.randomUUID();
      try {
        const parsed = m.args.parse(args);
        await db.transaction(async (txc) => {
          await m.run({ tx: txc, env }, parsed);
          await txc.run(sql`
            INSERT INTO _mutations (id, name, args, client_id, seq, created_at)
            VALUES (
              ${mutationId},
              ${m.name},
              ${JSON.stringify(parsed)},
              ${ids.clientId},
              ${ids.nextSeq()},
              ${env.now().toISOString()}
            )
          `);
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
