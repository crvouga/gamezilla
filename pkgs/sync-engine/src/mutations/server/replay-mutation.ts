import { sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';
import type { CreateId } from '@pkgs/uuid';
import { mutationAppliedId } from '../../shared/schema/tables';
import {
  parseStandardSchema,
  schemaIssuesToFailures,
} from '../../shared/standard-schema';
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

async function applyReplayMutationInTxn(args: {
  readonly txc: Pick<SqlClient, 'query' | 'run'>;
  readonly deps: ReplayMutationDeps;
  readonly m: MutationRow;
  readonly mutation: NonNullable<MutationRegistry[string]>;
  readonly parsedValue: unknown;
}): Promise<ReplayOutcome> {
  const { txc, deps, m, mutation, parsedValue } = args;
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
  await mutation.run({ tx: wrapped.tx, env }, parsedValue);
  const capture = wrapped.getCapture();
  return { status: 'applied' as const, capture };
}

async function claimMutationInTxn(
  txc: Pick<SqlClient, 'query'>,
  m: MutationRow,
  deps: Pick<ReplayMutationDeps, 'now' | 'createId'>,
  status: 'applied' | 'rejected'
): Promise<boolean> {
  const managed = managedInsertColumns(
    deps.createId,
    deps.now,
    mutationAppliedId(m.id)
  );
  const claimed = await txc.query(sql<{ id: string }>`
    INSERT INTO sync_engine_mutations_applied (
      id, mutation_id, client_id, seq, status,
      created_at, updated_at, deleted_at
    ) VALUES (
      ${managed.id}, ${m.id}, ${m.clientId}, ${m.seq}, ${status},
      ${managed.created_at}, ${managed.updated_at}, ${null}
    )
    ON CONFLICT (id) DO NOTHING
    RETURNING id
  `);
  return claimed.length > 0;
}

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
      if (!(await claimMutationInTxn(txc, m, deps, 'applied'))) {
        return { status: 'duplicate' as const };
      }

      const mutation = deps.registry[m.name];
      if (mutation === undefined) {
        const failure = {
          rule: m.name,
          code: 'UNKNOWN_MUTATION',
          message: 'Unknown operation.',
        };
        await recordRejectedInTxn(txc, m, failure, {
          deps,
          alreadyClaimed: true,
        });
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
          await recordRejectedInTxn(txc, m, failure, {
            deps,
            alreadyClaimed: true,
          });
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
        await recordRejectedInTxn(txc, m, failure, {
          deps,
          alreadyClaimed: true,
        });
        return {
          status: 'rejected' as const,
          code: failure.code,
          message: failure.message,
        };
      }

      return applyReplayMutationInTxn({
        txc,
        deps,
        m,
        mutation,
        parsedValue: parsed.value,
      });
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
    await recordRejectedInTxn(txc, m, failure, {
      deps,
      alreadyClaimed: false,
    });
  });
}

async function recordRejectedInTxn(
  txc: Pick<SqlClient, 'query' | 'run'>,
  m: MutationRow,
  failure: MutationFailure,
  options: {
    readonly deps: Pick<ReplayMutationDeps, 'now' | 'createId'>;
    readonly alreadyClaimed: boolean;
  }
): Promise<void> {
  const { deps, alreadyClaimed } = options;
  if (alreadyClaimed) {
    await txc.run(sql`
      UPDATE sync_engine_mutations_applied
      SET status = ${'rejected'}, updated_at = ${new Date(deps.now()).toISOString()}
      WHERE id = ${mutationAppliedId(m.id)}
    `);
  } else if (!(await claimMutationInTxn(txc, m, deps, 'rejected'))) {
    return;
  }

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
