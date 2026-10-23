/**
 * Server enforcement, case by case: the real operation a capability is
 * performed through, run against a server world seeded to the case. An
 * operation that completes is the server allowing it; one refused the way the
 * product refuses (a permanent `MutationError` on replay, `UnauthorizedError`
 * from a route guard, an HTTP refusal) is the server denying it — and a
 * denial must leave every stored row exactly as it was.
 *
 * Mutations run the way the server replays them: in one transaction, the
 * host's authorize hook first, then the body; a permanent error is caught
 * inside the transaction, which then commits (the replay records the
 * rejection and keeps whatever the body wrote before failing), so a body that
 * writes before it refuses shows up as changed rows.
 *
 * For tests and spec bindings only (a `root/` export).
 */

import { UnauthorizedError } from '@libs/auth-shared-ts/unauthorized-error';
import type { TableDef } from '@pkgs/db-schema-root-shared-ts/define-table';
import type { DecisionOutput } from '@pkgs/dmn-shared-ts/evaluate';
import type { DecisionLayer } from '@pkgs/dmn-shared-ts/registry';
import type { DenialReason } from '@pkgs/permissions-shared-ts/policy';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import type { Sql } from '@pkgs/sql-root-shared-ts/sql';
import type {
  Mutation,
  MutationAuthorize,
  MutationEnv,
} from '@pkgs/sync-engine-shared-ts/mutations-types';
import { MutationError } from '@pkgs/sync-engine-shared-ts/mutations-types';
import { wrapMutationDb } from '@pkgs/sync-engine-shared-ts/wrap-mutation-db';
import { authorizeAppMutation } from './authorize-app-mutation';
import { MUTATION_ACTIONS } from './mutation-actions';
import type { CaseInput } from './people';
import { CASE_NOW_MS, personOf } from './people';
import type { AppGrantKey, AppPermission } from './permission-catalog';
import { queryRequires } from './query-permission';
import type { ReasonWords } from './reasons';
import { requirePermission } from './require-permission';
import type { AppPolicy } from './world';
import {
  mutationEnvFor,
  openConformanceDb,
  seedAccess,
  storedRows,
} from './world';

/**
 * The server refused an operation that is not a mutation: an HTTP route
 * answering non-2xx, a room refusing a command.
 */
export class OperationRefused extends Error {
  constructor(detail: string) {
    super(`the server refused: ${detail}`);
    this.name = 'OperationRefused';
  }
}

/** Everything an operation runs against for one case. */
export type ServerCase = {
  readonly db: SqlClient;
  readonly env: MutationEnv;
  readonly input: CaseInput;
  readonly nowMs: number;
  /** The replay's authorize hook (the product's, unless a test swaps it). */
  readonly guard: MutationAuthorize;
};

/** Resolves when the server allows the operation; throws a refusal otherwise. */
export type ServerOperation = (c: ServerCase) => Promise<void>;

export type ServerLayerOptions = {
  /** Sub tables the operation reads and writes (billing's included). */
  readonly tables: readonly TableDef[];
  /** The operation the case's capability is performed through; null: none. */
  readonly operationFor: (input: CaseInput) => ServerOperation | null;
  /** Sub rows the case needs (after the access rows are seeded). */
  readonly seed?: (c: ServerCase) => Promise<void>;
  /** A changed policy, synced as the server's policy row. */
  readonly policy?: AppPolicy;
  /** Replaces the replay's authorize hook (mutation tests). */
  readonly guard?: MutationAuthorize;
  /**
   * The table's words for the refusal codes the operation's mutations throw.
   * Given, the layer observes the reason too (every operation it governs must
   * then be a mutation, whose permanent error carries the product's reason).
   */
  readonly reasons?: ReasonWords;
};

function isRefusal(error: unknown): boolean {
  return (
    error instanceof MutationError ||
    error instanceof UnauthorizedError ||
    error instanceof OperationRefused
  );
}

/** The refusal the operation met, or null when the server allowed it. */
async function refusalOf(
  operation: ServerOperation,
  c: ServerCase
): Promise<Error | null> {
  try {
    await operation(c);
    return null;
  } catch (error) {
    if (isRefusal(error)) return error as Error;
    throw error;
  }
}

function refusedAnswer(
  refusal: Error,
  reasons: ReasonWords | undefined
): DecisionOutput {
  if (reasons === undefined) return { answer: 'no' };
  const code = refusal instanceof MutationError ? refusal.code : refusal.name;
  const words = reasons[code as DenialReason];
  return { answer: 'no', reason: words ?? `unmapped: ${code}` };
}

async function answerCase(
  options: ServerLayerOptions,
  run: { readonly input: CaseInput; readonly operation: ServerOperation }
): Promise<DecisionOutput> {
  const db = await openConformanceDb(options.tables);
  try {
    const c: ServerCase = {
      db,
      env: mutationEnvFor(personOf(run.input), CASE_NOW_MS),
      input: run.input,
      nowMs: CASE_NOW_MS,
      guard: options.guard ?? authorizeAppMutation,
    };
    await seedAccess(db, {
      input: run.input,
      nowMs: CASE_NOW_MS,
      policy: options.policy,
    });
    await options.seed?.(c);
    const before = await storedRows(db, options.tables);
    const refusal = await refusalOf(run.operation, c);
    if (refusal === null) {
      return options.reasons === undefined
        ? { answer: 'yes' }
        : { answer: 'yes', reason: 'none' };
    }
    if ((await storedRows(db, options.tables)) !== before) {
      throw new Error('the refused operation changed stored rows');
    }
    return refusedAnswer(refusal, options.reasons);
  } finally {
    await db.disconnect();
  }
}

/**
 * The server enforcement layer: governs the cases whose capability has a
 * server operation; observes the answer, and the reason when the table's
 * words for the operation's refusal codes are given.
 */
export function serverEnforcementLayer(
  options: ServerLayerOptions
): DecisionLayer {
  return {
    observes: options.reasons === undefined ? ['answer'] : ['answer', 'reason'],
    applies: (input) => options.operationFor(input) !== null,
    decide: (input) => {
      const operation = options.operationFor(input);
      if (operation === null) {
        throw new Error('conformance: the case has no server operation');
      }
      return answerCase(options, { input, operation });
    },
  };
}

async function parsedArgs<A>(mutation: Mutation<A>, raw: unknown): Promise<A> {
  const result = await mutation.args['~standard'].validate(raw);
  if (result.issues !== undefined) {
    throw new Error(`conformance: bad args for ${mutation.name}`);
  }
  return result.value;
}

/**
 * Replay `name` as the server does: one transaction, the authorize hook, then
 * `body` (none for a mutation whose body lives beyond this package's reach).
 */
async function replay(
  c: ServerCase,
  step: {
    readonly name: string;
    readonly args: unknown;
    readonly body?: (ctx: {
      readonly tx: ReturnType<typeof wrapMutationDb>['tx'];
      readonly env: MutationEnv;
    }) => Promise<void>;
  }
): Promise<void> {
  let refusal: MutationError | null = null;
  await c.db.transaction(async (txc) => {
    const { tx } = wrapMutationDb(txc, c.env);
    try {
      await c.guard({
        name: step.name,
        args: step.args,
        tx,
        env: c.env,
        serverNow: () => new Date(c.nowMs),
      });
      await step.body?.({ tx, env: c.env });
    } catch (error) {
      if (!(error instanceof MutationError)) throw error;
      refusal = error;
    }
  });
  if (refusal !== null) throw refusal;
}

/** The server replay of a mutation: authorize hook, then its body. */
export function replayOperation<A>(
  mutation: Mutation<A>,
  rawArgs: (c: ServerCase) => unknown
): ServerOperation {
  return async (c) => {
    const args = await parsedArgs(mutation, rawArgs(c));
    await replay(c, {
      name: mutation.name,
      args,
      body: (ctx) => mutation.run(ctx, args),
    });
  };
}

/**
 * The replay's authorize hook alone for `name`: the gate a mutation's body
 * never passes when it refuses.
 */
export function authorizeOperation(name: string): ServerOperation {
  return (c) => replay(c, { name, args: {} });
}

/** The request guard a route runs before answering. */
export function routeGuardOperation(
  permission: AppPermission
): ServerOperation {
  return async (c) => {
    await requirePermission({
      db: c.db,
      auth: {
        authenticatedAtMs: null,
        deviceId: c.env.deviceId,
        accountId: c.env.accountId,
        myId: c.env.actorId,
        isAnon: c.env.isAnon,
      },
      permission,
      nowMs: c.nowMs,
    });
  };
}

/**
 * The `authorize` hook a sync query runs before answering (`queryRequires`),
 * over the same database the query reads: refused, the query hydrates nothing.
 */
export function queryGuardOperation(key: AppGrantKey): ServerOperation {
  const authorize = queryRequires(key);
  return async (c) => {
    const allowed = await authorize({
      db: {
        query: (query) => c.db.query(query as Sql<Record<string, unknown>>),
      },
      env: c.env,
    });
    if (!allowed) throw new OperationRefused('the query denied the caller');
  };
}

/**
 * Every operation must give the same answer (a capability several mutations
 * perform): all allowed, or all refused — the first refusal is rethrown.
 */
export function allOperations(
  operations: readonly ServerOperation[]
): ServerOperation {
  return async (c) => {
    const refused = [];
    for (const operation of operations) {
      try {
        await operation(c);
      } catch (error) {
        if (!isRefusal(error)) throw error;
        refused.push(error);
      }
    }
    const [first] = refused;
    if (first === undefined) return;
    if (refused.length !== operations.length) {
      throw new Error(
        `conformance: ${String(refused.length)} of ${String(operations.length)} operations refused`
      );
    }
    throw first;
  };
}

/** Every mutation the replay authorize hook decides with `key`. */
export function mutationsDeclaring(key: AppGrantKey): readonly string[] {
  return Object.entries(MUTATION_ACTIONS)
    .filter(([, declared]) => declared === key)
    .map(([name]) => name);
}
