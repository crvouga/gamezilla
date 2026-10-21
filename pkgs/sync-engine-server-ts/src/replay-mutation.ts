import { SpanStatusCode, trace } from '@opentelemetry/api';
import { ATTR } from '@pkgs/observability-root-shared-ts/attributes';
import {
  currentCorrelation,
  deserializeTraceContext,
} from '@pkgs/observability-root-shared-ts/correlation';
import { EVENT, events } from '@pkgs/observability-root-shared-ts/events';
import { createMutationReplayMetric } from '@pkgs/observability-root-shared-ts/mutation-metrics';
import { withSpan } from '@pkgs/observability-root-shared-ts/span';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import sql from '@pkgs/sql-root-shared-ts/sql';
import {
  isMutationError,
  mutationErrorToFailure,
} from '@pkgs/sync-engine-shared-ts/failures';
import {
  managedInsertColumns,
  managedUpdatedAtIso,
} from '@pkgs/sync-engine-shared-ts/managed-columns';
import { mutationOriginLink } from '@pkgs/sync-engine-shared-ts/mutation-observability';
import type {
  ContentRules,
  MutationAuthorize,
  MutationEnv,
  MutationFailure,
  MutationRegistry,
} from '@pkgs/sync-engine-shared-ts/mutations-types';
import {
  parseStandardSchema,
  schemaIssuesToFailures,
} from '@pkgs/sync-engine-shared-ts/standard-schema';
import { mutationAppliedId } from '@pkgs/sync-engine-shared-ts/tables';
import { wrapMutationDb } from '@pkgs/sync-engine-shared-ts/wrap-mutation-db';
import type { WriteCaptureSnapshot } from '@pkgs/sync-engine-shared-ts/write-capture';
import type { TurnGames } from '@pkgs/turn-game-shared-ts/game-rules';
import type { CreateId } from '@pkgs/uuid-shared-ts/create-id';
import { mapConstraintError } from './map-constraint-error';
import { storedReplayVerdict } from './stored-replay-verdict';

export type MutationRow = {
  readonly id: string;
  readonly name: string;
  readonly args: string;
  readonly clientId: string;
  readonly seq: number;
  readonly createdAt: string;
  readonly originTraceparent: string | null;
  readonly correlation?: {
    readonly sessionId: string;
    readonly buildSha: string;
  };
};

export type ReplayAuth = {
  readonly synthetic?: boolean;
  readonly actorId: string;
  readonly deviceId: string;
  readonly accountId: string | null;
  readonly isAnon: boolean;
  readonly authenticatedAtMs?: number;
};

export type ReplayMutationDeps = {
  readonly serverDb: SqlClient;
  readonly registry: MutationRegistry;
  readonly auth: ReplayAuth;
  readonly now: () => number;
  readonly createId: CreateId;
  /** Host guard run before every mutation body (server replay only). */
  readonly authorize?: MutationAuthorize;
  /**
   * The app's content rules at the time selected by the mutation,
   * handed to its body as `env.contentRules`.
   */
  readonly turnGames?: TurnGames;
  readonly contentRulesAt?: (atMs: number) => ContentRules;
};

export type ReplayOutcome =
  | { readonly status: 'applied'; readonly capture: WriteCaptureSnapshot }
  | { readonly status: 'duplicate' }
  | {
      readonly status: 'rejected';
      readonly code: string;
      readonly message: string;
    };

function originTraceId(traceparent: string | null): string | null {
  if (traceparent === null) return null;
  const origin = deserializeTraceContext(traceparent);
  return origin === undefined
    ? null
    : (trace.getSpanContext(origin)?.traceId ?? null);
}

async function appendObservabilityEvent(args: {
  readonly txc: Pick<SqlClient, 'run'>;
  readonly deps: Pick<ReplayMutationDeps, 'now' | 'createId' | 'auth'>;
  readonly m: MutationRow;
  readonly eventName: string;
}): Promise<void> {
  const row = managedInsertColumns(args.deps.createId, args.deps.now);
  const traceId =
    currentCorrelation().traceId ?? originTraceId(args.m.originTraceparent);
  await args.txc.run(sql`
    INSERT INTO sync_engine_observability_events (
      id, event_name, user_id, session_id, device_id, mutation_id,
      trace_id, build_sha, created_at, updated_at, deleted_at
    ) VALUES (
      ${row.id}, ${args.eventName},
      ${args.deps.auth.accountId ?? args.deps.auth.actorId},
      ${args.m.correlation?.sessionId ?? null},
      ${args.deps.auth.deviceId}, ${args.m.id}, ${traceId},
      ${args.m.correlation?.buildSha ?? null},
      ${row.created_at}, ${row.updated_at}, ${null}
    )
  `);
}

async function claimAppliedInTxn(args: {
  readonly txc: Pick<SqlClient, 'query' | 'run'>;
  readonly deps: Pick<ReplayMutationDeps, 'now' | 'createId' | 'auth'>;
  readonly m: MutationRow;
}): Promise<boolean> {
  const applied = managedInsertColumns(
    args.deps.createId,
    args.deps.now,
    mutationAppliedId(args.m.id)
  );
  const claimed = await args.txc.query(sql<{ id: string }>`
    INSERT INTO sync_engine_mutations_applied (
      id, mutation_id, client_id, seq, status,
      created_at, updated_at, deleted_at
    )
    VALUES (
      ${applied.id}, ${args.m.id}, ${args.m.clientId}, ${args.m.seq},
      ${'applied'}, ${applied.created_at}, ${applied.updated_at}, ${null}
    )
    ON CONFLICT (id) DO NOTHING
    RETURNING id
  `);
  return claimed.length > 0;
}

async function applyReplayMutationInTxn(args: {
  readonly txc: Pick<SqlClient, 'query' | 'run'>;
  readonly deps: ReplayMutationDeps;
  readonly m: MutationRow;
  readonly mutation: NonNullable<MutationRegistry[string]>;
  readonly parsedValue: unknown;
}): Promise<ReplayOutcome> {
  const { txc, deps, m, mutation, parsedValue } = args;
  const env: MutationEnv = {
    ...(deps.auth.synthetic === undefined
      ? {}
      : { synthetic: deps.auth.synthetic }),
    actorId: deps.auth.actorId,
    deviceId: deps.auth.deviceId,
    accountId: deps.auth.accountId,
    isAnon: deps.auth.isAnon,
    now: () => new Date(m.createdAt),
    createId: deps.createId,
    serverNow: () => new Date(deps.now()),
    ...(deps.auth.authenticatedAtMs === undefined
      ? {}
      : { authenticatedAtMs: deps.auth.authenticatedAtMs }),
    ...(deps.turnGames === undefined ? {} : { turnGames: deps.turnGames }),
    ...(deps.contentRulesAt === undefined
      ? {}
      : {
          contentRules: deps.contentRulesAt(
            mutation.contentRulesTime === 'replayed'
              ? deps.now()
              : Date.parse(m.createdAt)
          ),
        }),
  };

  const wrapped = wrapMutationDb(txc, env);
  // Permanent failures propagate through the replay transaction's rollback
  // before a separate transaction records their durable rejection.
  await deps.authorize?.({
    name: m.name,
    args: parsedValue,
    tx: wrapped.tx,
    env,
    serverNow: () => new Date(deps.now()),
  });
  await mutation.run({ tx: wrapped.tx, env }, parsedValue);
  await appendObservabilityEvent({
    txc,
    deps,
    m,
    eventName: EVENT.MUTATION_PERSISTED,
  });
  return { status: 'applied' as const, capture: wrapped.getCapture() };
}

/**
 * Replay one mutation against authoritative Postgres.
 * Permanent failures record sync_engine_write_rejections + sync_engine_mutations_applied rejected.
 * Infra errors rethrow for sync retry (idempotency makes retries safe).
 */
async function replayMutationCore(
  deps: ReplayMutationDeps,
  m: MutationRow
): Promise<ReplayOutcome> {
  try {
    return await deps.serverDb.transaction(async (txc) => {
      const claimed = await claimAppliedInTxn({
        txc,
        deps,
        m,
      });
      if (!claimed) return storedReplayVerdict(txc, m.id);

      const mutation = deps.registry[m.name];
      if (mutation === undefined) {
        const failure = {
          rule: m.name,
          code: 'UNKNOWN_MUTATION',
          message: 'Unknown operation.',
        };
        await recordRejectedInTxn({
          txc,
          m,
          failure,
          deps,
          claimed: true,
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
          await recordRejectedInTxn({
            txc,
            m,
            failure,
            deps,
            claimed: true,
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
        await recordRejectedInTxn({
          txc,
          m,
          failure,
          deps,
          claimed: true,
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

/** Replay once and count what became of it; a throw is a `failed` replay. */
async function replayCounted(
  deps: ReplayMutationDeps,
  m: MutationRow
): Promise<ReplayOutcome> {
  const count = createMutationReplayMetric();
  try {
    const outcome = await replayMutationCore(deps, m);
    count(outcome.status);
    return outcome;
  } catch (error) {
    count('failed');
    throw error;
  }
}

export function replayMutation(
  deps: ReplayMutationDeps,
  m: MutationRow
): Promise<ReplayOutcome> {
  const originLink = mutationOriginLink(m.originTraceparent, m.createdAt, m.id);
  return withSpan(
    'mutation.replay',
    async (span) => {
      const outcome = await replayCounted(deps, m);
      if (outcome.status === 'applied') {
        events.mutationPersisted(span, m.id);
      } else if (outcome.status === 'rejected') {
        events.mutationRejected(span, m.id);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: outcome.code,
        });
      }
      return outcome;
    },
    {
      [ATTR.APP_MUTATION_ID]: m.id,
      [ATTR.APP_MUTATION_NAME]: m.name,
      [ATTR.USER_ID]: deps.auth.accountId ?? deps.auth.actorId,
      [ATTR.APP_DEVICE_ID]: deps.auth.deviceId,
      ...(m.correlation === undefined
        ? {}
        : {
            [ATTR.SESSION_ID]: m.correlation.sessionId,
            [ATTR.APP_BUILD_SHA]: m.correlation.buildSha,
          }),
    },
    originLink === undefined ? undefined : { links: [originLink] }
  );
}

export async function recordMutationRejection(
  deps: Pick<ReplayMutationDeps, 'serverDb' | 'now' | 'createId' | 'auth'>,
  m: MutationRow,
  failure: MutationFailure
): Promise<void> {
  await deps.serverDb.transaction(async (txc) => {
    await recordRejectedInTxn({ txc, m, failure, deps });
  });
}

async function recordRejectedInTxn(args: {
  readonly txc: Pick<SqlClient, 'query' | 'run'>;
  readonly m: MutationRow;
  readonly failure: MutationFailure;
  readonly deps: Pick<ReplayMutationDeps, 'now' | 'createId' | 'auth'>;
  readonly claimed?: boolean;
}): Promise<void> {
  const ownsMarker =
    args.claimed === true ||
    (await claimAppliedInTxn({ txc: args.txc, deps: args.deps, m: args.m }));
  if (!ownsMarker) return;

  await appendObservabilityEvent({
    txc: args.txc,
    deps: args.deps,
    m: args.m,
    eventName: EVENT.MUTATION_REJECTED,
  });

  await args.txc.run(sql`
    UPDATE sync_engine_mutations_applied
    SET status = ${'rejected'}, updated_at = ${managedUpdatedAtIso(args.deps.now)}
    WHERE id = ${mutationAppliedId(args.m.id)}
  `);

  const rejection = managedInsertColumns(args.deps.createId, args.deps.now);
  const metaJson =
    args.failure.meta !== undefined ? JSON.stringify(args.failure.meta) : null;
  await args.txc.run(sql`
    INSERT INTO sync_engine_write_rejections (
      id, mutation_id, client_id, code, message, meta,
      created_at, updated_at, deleted_at, acknowledged
    ) VALUES (
      ${rejection.id},
      ${args.m.id},
      ${args.m.clientId},
      ${args.failure.code},
      ${args.failure.message},
      ${metaJson},
      ${rejection.created_at},
      ${rejection.updated_at},
      ${null},
      ${0}
    )
  `);
}
