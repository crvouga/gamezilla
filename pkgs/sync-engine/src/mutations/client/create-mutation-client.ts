import { sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';
import type { CreateId } from '@pkgs/uuid';
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
  /** Id mint for queued mutation rows (wall or sim). */
  readonly createId: CreateId;
};

async function nextMutationSeq(tx: SqlClient): Promise<number> {
  const rows = await tx.query(sql<{ next: number | null }>`
    SELECT COALESCE(MAX(seq), 0) + 1 AS next FROM sync_engine_mutations
  `);
  return Number(rows[0]?.next ?? 1);
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

      const mutationId = options.createId();
      try {
        const parsed = await parseStandardSchema(m.args, args);
        if (!parsed.ok) {
          return {
            ok: false,
            failures: schemaIssuesToFailures(parsed.issues, m.name),
          };
        }
        let capture: WriteCaptureSnapshot = {
          tables: [],
          ids: {},
          images: {},
        };
        await db.transaction(async (txc) => {
          const seq = await nextMutationSeq(txc);
          const createdAt = env.now().toISOString();
          const wrapped = wrapMutationDb(txc, env);
          await m.run({ tx: wrapped.tx, env }, parsed.value);
          capture = wrapped.getCapture();
          await txc.run(sql`
            INSERT INTO sync_engine_mutations (
              id, name, args, client_id, seq, created_at
            )
            VALUES (
              ${mutationId},
              ${m.name},
              ${JSON.stringify(parsed.value)},
              ${ids.clientId},
              ${seq},
              ${createdAt}
            )
          `);
          await recordOptimisticOwnRows(txc, mutationId, capture);
        });
        options.onQueued?.({
          mutation: m as Mutation<unknown>,
          args: parsed.value,
          capture,
        });
        return { ok: true, mutationId };
      } catch (e) {
        const caught = mutateCaughtResult(e, m.name);
        if (caught !== null) return caught;
        throw e;
      }
    },
  };
}
