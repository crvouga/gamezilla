import { sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { ZodError } from 'zod';

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
  readonly serverNow?: () => Date;
};

/**
 * Replay one mutation against authoritative Postgres.
 * Permanent failures record write_rejections + _mutations_applied rejected.
 * Infra errors rethrow for sync retry (idempotency makes retries safe).
 */
export async function replayMutation(
  deps: ReplayMutationDeps,
  m: MutationRow
): Promise<void> {
  try {
    await deps.serverDb.transaction(async (txc) => {
      const seen = await txc.query(sql<{ one: number }>`
        SELECT 1 AS one FROM _mutations_applied WHERE mutation_id = ${m.id}
      `);
      if (seen.length > 0) return;

      const mutation = deps.registry[m.name];
      if (mutation === undefined) {
        await recordRejectedInTxn(txc, m, {
          rule: m.name,
          code: 'UNKNOWN_MUTATION',
          message: 'Unknown operation.',
        });
        return;
      }

      let parsed: unknown;
      try {
        parsed = mutation.args.parse(JSON.parse(m.args) as unknown);
      } catch (e) {
        if (e instanceof ZodError) {
          const failures = zodFailures(e, m.name);
          await recordRejectedInTxn(txc, m, failures[0]!);
          return;
        }
        throw e;
      }

      const env: MutationEnv = {
        actorId: deps.auth.actorId,
        deviceId: deps.auth.deviceId,
        accountId: deps.auth.accountId,
        isAnon: deps.auth.isAnon,
        now: () => new Date(m.createdAt),
        ...(deps.serverNow !== undefined ? { serverNow: deps.serverNow } : {}),
      };

      await mutation.run({ tx: txc, env }, parsed);

      await txc.run(sql`
        INSERT INTO _mutations_applied (mutation_id, client_id, seq, status)
        VALUES (${m.id}, ${m.clientId}, ${m.seq}, ${'applied'})
      `);
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
      await recordMutationRejection(deps.serverDb, m, failure);
      return;
    }
    throw e;
  }
}

export async function recordMutationRejection(
  serverDb: SqlClient,
  m: MutationRow,
  failure: MutationFailure
): Promise<void> {
  await serverDb.transaction(async (txc) => {
    await recordRejectedInTxn(txc, m, failure);
  });
}

async function recordRejectedInTxn(
  txc: Pick<SqlClient, 'query' | 'run'>,
  m: MutationRow,
  failure: MutationFailure
): Promise<void> {
  const seen = await txc.query(sql<{ one: number }>`
    SELECT 1 AS one FROM _mutations_applied WHERE mutation_id = ${m.id}
  `);
  if (seen.length > 0) return;

  await txc.run(sql`
    INSERT INTO _mutations_applied (mutation_id, client_id, seq, status)
    VALUES (${m.id}, ${m.clientId}, ${m.seq}, ${'rejected'})
  `);

  const metaJson =
    failure.meta !== undefined ? JSON.stringify(failure.meta) : null;
  await txc.run(sql`
    INSERT INTO write_rejections (
      id, mutation_id, client_id, code, message, meta, created_at, acknowledged
    ) VALUES (
      ${crypto.randomUUID()},
      ${m.id},
      ${m.clientId},
      ${failure.code},
      ${failure.message},
      ${metaJson},
      ${new Date().toISOString()},
      ${0}
    )
  `);
}
