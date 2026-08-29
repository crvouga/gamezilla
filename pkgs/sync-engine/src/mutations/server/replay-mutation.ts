import { sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';
import type { CreateId } from '@pkgs/uuid';
import { ZodError } from 'zod';
import type { WriteCaptureSnapshot } from '../../sql-ast';
import {
  isMutationError,
  mutationErrorToFailure,
  zodFailures,
} from '../core/failures';
import type {
  MutationEnv,
  MutationFailure,
  MutationRegistry,
} from '../core/types';
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
        SELECT 1 AS one FROM sync_engine_mutations_applied WHERE mutation_id = ${m.id}
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

      let parsed: unknown;
      try {
        parsed = mutation.args.parse(JSON.parse(m.args) as unknown);
      } catch (e) {
        if (e instanceof ZodError) {
          const failures = zodFailures(e, m.name);
          const failure = failures[0]!;
          await recordRejectedInTxn(txc, m, failure, deps);
          return {
            status: 'rejected' as const,
            code: failure.code,
            message: failure.message,
          };
        }
        // Malformed JSON (SyntaxError) is a permanent client bug — not infra.
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
      await mutation.run({ tx: wrapped.tx, env }, parsed);
      const capture = wrapped.getCapture();

      const appliedAt = new Date(deps.now()).toISOString();
      await txc.run(sql`
        INSERT INTO sync_engine_mutations_applied (mutation_id, client_id, seq, status, applied_at)
        VALUES (${m.id}, ${m.clientId}, ${m.seq}, ${'applied'}, ${appliedAt})
      `);
      return { status: 'applied' as const, capture };
    });
  } catch (e) {
    const mutation = deps.registry[m.name];
    const mapped = mapConstraintError(e, mutation?.constraintErrors);
    if (mapped !== undefined || isMutationError(e) || e instanceof ZodError) {
      const failure =
        mapped ??
        (isMutationError(e)
          ? mutationErrorToFailure(e, m.name)
          : zodFailures(e as ZodError, m.name)[0]!);
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
    SELECT 1 AS one FROM sync_engine_mutations_applied WHERE mutation_id = ${m.id}
  `);
  if (seen.length > 0) return;

  const appliedAt = new Date(deps.now()).toISOString();
  await txc.run(sql`
    INSERT INTO sync_engine_mutations_applied (mutation_id, client_id, seq, status, applied_at)
    VALUES (${m.id}, ${m.clientId}, ${m.seq}, ${'rejected'}, ${appliedAt})
  `);

  const metaJson =
    failure.meta !== undefined ? JSON.stringify(failure.meta) : null;
  await txc.run(sql`
    INSERT INTO sync_engine_write_rejections (
      id, mutation_id, client_id, code, message, meta, created_at, acknowledged
    ) VALUES (
      ${deps.createId()},
      ${m.id},
      ${m.clientId},
      ${failure.code},
      ${failure.message},
      ${metaJson},
      ${new Date(deps.now()).toISOString()},
      ${0}
    )
  `);
}
