import { sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';
import type { CreateId } from '@pkgs/uuid';
import {
  parseStandardSchema,
  schemaIssuesToFailures,
} from '../../shared/standard-schema';
import { mutationAppliedId } from '../../shared/schema/tables';
import type { WriteCaptureSnapshot } from '../../sql-ast';
import { isMutationError, mutationErrorToFailure } from '../core/failures';
import type {
  MutationEnv,
  MutationFailure,
  MutationRegistry,
} from '../core/types';
import { managedInsertColumns } from '../shared/managed-columns';
import { wrapMutationDb } from '../shared/wrap-mutation-db';
import { mapConstraintError } from './map-constraint-error';

export type MutationRow = {
  readonly id: string;
  readonly name: string;
  readonly args: string;
  readonly clientId: string;
  readonly seq: number;
  readonly createdAt: string;
};

export type ReplayAuth = {
  readonly actorId: string;
  readonly deviceId: string;
  readonly accountId: string | null;
  readonly isAnon: boolean;
};

export type ReplayMutationDeps = {
  readonly serverDb: SqlClient;
  readonly registry: MutationRegistry;
  readonly auth: ReplayAuth;
  readonly now: () => number;
  readonly createId: CreateId;
  readonly serverNow?: () => Date;
};

export type ReplayOutcome =
  | { readonly status: 'applied'; readonly capture: WriteCaptureSnapshot }
  | { readonly status: 'duplicate' }
  | {
      readonly status: 'rejected';
      readonly code: string;
      readonly message: string;
    };

/**
 * Replay one mutation against authoritative Postgres.
 * Permanent failures record sync_engine_write_rejections + sync_engine_mutations_applied rejected.
 * Infra errors rethrow for sync retry (idempotency makes retries safe).
 */
export async function replayMutation(
  deps: ReplayMutationDeps,
  m: MutationRow
): Promise<ReplayOutcome> {
  try {
    return await deps.serverDb.transaction(async (txc) => {
      const seen = await txc.query(sql<{ one: number }>`
        SELECT 1 AS one FROM sync_engine_mutations_applied
        WHERE mutation_id = ${m.id}
          AND deleted_at IS NULL
      `);
      if (seen.length > 0) return { status: 'duplicate' as const };

      const mutation = deps.registry[m.name];
      if (mutation === undefined) {
        const failure = {
          rule: m.name,
          code: 'UNKNOWN_MUTATION',
          message: 'Unknown operation.',
        };
        await recordRejectedInTxn(txc, m, failure, deps);
        return {
          status: 'rejected' as const,
          code: failure.code,
          message: failure.message,
        };
      }

      let rawArgs: unknown;
      try {
        rawArgs = JSON.parse(m.args) as unknown;
      } catch (e) {
        if (e instanceof SyntaxError) {
          const failure = {
            rule: m.name,
            code: 'INVALID_ARGS',
            message: 'Malformed mutation args.',
          };
          await recordRejectedInTxn(txc, m, failure, deps);
          return {
            status: 'rejected' as const,
            code: failure.code,
            message: failure.message,
          };
        }
        throw e;
      }

      const parsed = await parseStandardSchema(mutation.args, rawArgs);
      if (!parsed.ok) {
        const failure = schemaIssuesToFailures(parsed.issues, m.name)[0]!;
        await recordRejectedInTxn(txc, m, failure, deps);
        return {
          status: 'rejected' as const,
          code: failure.code,
          message: failure.message,
        };
      }

      const env: MutationEnv = {
        actorId: deps.auth.actorId,
        deviceId: deps.auth.deviceId,
        accountId: deps.auth.accountId,
        isAnon: deps.auth.isAnon,
        now: () => new Date(m.createdAt),
        createId: deps.createId,
        ...(deps.serverNow !== undefined ? { serverNow: deps.serverNow } : {}),
      };

      const wrapped = wrapMutationDb(txc, env);
      await mutation.run({ tx: wrapped.tx, env }, parsed.value);
      const capture = wrapped.getCapture();

      const managed = managedInsertColumns(
        deps.createId,
        deps.now,
        mutationAppliedId(m.id)
      );
      await txc.run(sql`
        INSERT INTO sync_engine_mutations_applied (
          id, mutation_id, client_id, seq, status,
          created_at, updated_at, deleted_at
        )
        VALUES (
          ${managed.id},
          ${m.id},
          ${m.clientId},
          ${m.seq},
          ${'applied'},
          ${managed.created_at},
          ${managed.updated_at},
          ${null}
        )
      `);
      return { status: 'applied' as const, capture };
    });
  } catch (e) {
    const mutation = deps.registry[m.name];
    const mapped = mapConstraintError(e, mutation?.constraintErrors);
    if (mapped !== undefined) {
      await recordMutationRejection(deps, m, mapped);
      return {
        status: 'rejected',
        code: mapped.code,
        message: mapped.message,
      };
    }
    if (isMutationError(e)) {
      const failure = mutationErrorToFailure(e, m.name);
      await recordMutationRejection(deps, m, failure);
      return {
        status: 'rejected',
        code: failure.code,
        message: failure.message,
      };
    }
    throw e;
  }
}

export async function recordMutationRejection(
  deps: Pick<ReplayMutationDeps, 'serverDb' | 'now' | 'createId'>,
  m: MutationRow,
  failure: MutationFailure
): Promise<void> {
  await deps.serverDb.transaction(async (txc) => {
    await recordRejectedInTxn(txc, m, failure, deps);
  });
}

async function recordRejectedInTxn(
  txc: Pick<SqlClient, 'query' | 'run'>,
  m: MutationRow,
  failure: MutationFailure,
  deps: Pick<ReplayMutationDeps, 'now' | 'createId'>
): Promise<void> {
  const seen = await txc.query(sql<{ one: number }>`
    SELECT 1 AS one FROM sync_engine_mutations_applied
    WHERE mutation_id = ${m.id}
      AND deleted_at IS NULL
  `);
  if (seen.length > 0) return;

  const applied = managedInsertColumns(
    deps.createId,
    deps.now,
    mutationAppliedId(m.id)
  );
  await txc.run(sql`
    INSERT INTO sync_engine_mutations_applied (
      id, mutation_id, client_id, seq, status,
      created_at, updated_at, deleted_at
    )
    VALUES (
      ${applied.id},
      ${m.id},
      ${m.clientId},
      ${m.seq},
      ${'rejected'},
      ${applied.created_at},
      ${applied.updated_at},
      ${null}
    )
  `);

  const rejection = managedInsertColumns(deps.createId, deps.now);
  const metaJson =
    failure.meta !== undefined ? JSON.stringify(failure.meta) : null;
  await txc.run(sql`
    INSERT INTO sync_engine_write_rejections (
      id, mutation_id, client_id, code, message, meta,
      created_at, updated_at, deleted_at, acknowledged
    ) VALUES (
      ${rejection.id},
      ${m.id},
      ${m.clientId},
      ${failure.code},
      ${failure.message},
      ${metaJson},
      ${rejection.created_at},
      ${rejection.updated_at},
      ${null},
      ${0}
    )
  `);
}
