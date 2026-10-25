import { assert } from '@pkgs/assert-root-shared-ts/singleton';
import type { RoomServicePort } from '@pkgs/room-root-shared-ts/room-service';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import { raw } from '@pkgs/sql-root-shared-ts/sql';
import { MAX_MUTATIONS_BATCH } from '@pkgs/sync-engine-shared-ts/bounds';
import type {
  ContentRules,
  MutationAuthorize,
  MutationRegistry,
} from '@pkgs/sync-engine-shared-ts/mutations-types';
import type { WriteCaptureSnapshot } from '@pkgs/sync-engine-shared-ts/write-capture';
import type { TurnGames } from '@pkgs/turn-game-shared-ts/game-rules';
import type { CreateId } from '@pkgs/uuid-shared-ts/create-id';
import type { MutationTxWrapper } from './mutation-lifecycle';
import type { MutationRow, ReplayAuth, ReplayOutcome } from './replay-mutation';
import { replayMutation } from './replay-mutation';

export type MutationVerdict =
  | { readonly mutationId: string; readonly status: 'applied' }
  | {
      readonly mutationId: string;
      readonly status: 'rejected';
      readonly code: string;
      readonly message: string;
    };

export type AppliedMutationRef = {
  readonly mutationId: string;
  readonly name: string;
  readonly argsJson: string;
  readonly capture: WriteCaptureSnapshot;
};

export type ProcessMutationsBatchResult = {
  readonly ok: true;
  readonly verdicts: readonly MutationVerdict[];
  readonly applied: readonly AppliedMutationRef[];
  readonly ackSeq: number;
};

export type ProcessMutationsBatchDeps = {
  /** The caller owns this enclosing transaction, including late fanout work. */
  readonly transaction: SqlClient;
  readonly registry: MutationRegistry;
  readonly auth: ReplayAuth;
  readonly mutations: readonly MutationRow[];
  readonly now: () => number;
  readonly createId: CreateId;
  readonly authorize?: MutationAuthorize;
  readonly wrapMutationTx?: MutationTxWrapper;
  /**
   * The app's content rules as they stood at a write's time (its
   * `created_at`), handed to the mutation body as `env.contentRules`.
   */
  readonly turnGames?: TurnGames;
  readonly rooms?: RoomServicePort;
  readonly contentRulesAt?: (atMs: number) => ContentRules;
  /**
   * Called after each mutation attempt (applied/rejected/duplicate).
   * Harness uses this for in-txn fault injection at the replay loop boundary.
   */
  readonly onAfterMutation?: (index: number) => void;
};

/**
 * Replay ordered mutation rows; permanent failures become rejected verdicts.
 * Infra errors rethrow (retryable).
 */
export async function processMutationsBatch(
  deps: ProcessMutationsBatchDeps
): Promise<ProcessMutationsBatchResult> {
  assert.ok(
    deps.mutations.length <= MAX_MUTATIONS_BATCH,
    'mutation batch size'
  );
  const sorted = [...deps.mutations].sort((a, b) => a.seq - b.seq);
  const verdicts: MutationVerdict[] = [];
  const applied: AppliedMutationRef[] = [];
  let ackSeq = 0;

  for (let index = 0; index < sorted.length; index += 1) {
    const row = sorted[index]!;
    const outcome: ReplayOutcome = await replayMutation(
      {
        serverDb: replaySavepoint(
          deps.transaction,
          index === sorted.length - 1
        ),
        registry: deps.registry,
        auth: deps.auth,
        now: deps.now,
        createId: deps.createId,
        ...(deps.authorize !== undefined ? { authorize: deps.authorize } : {}),
        ...(deps.wrapMutationTx === undefined
          ? {}
          : { wrapMutationTx: deps.wrapMutationTx }),
        ...(deps.turnGames === undefined ? {} : { turnGames: deps.turnGames }),
        ...(deps.rooms === undefined ? {} : { rooms: deps.rooms }),
        ...(deps.contentRulesAt !== undefined
          ? { contentRulesAt: deps.contentRulesAt }
          : {}),
      },
      row
    );
    if (outcome.status === 'rejected') {
      verdicts.push({
        mutationId: row.id,
        status: 'rejected',
        code: outcome.code,
        message: outcome.message,
        ...(outcome.meta === undefined ? {} : { meta: outcome.meta }),
      });
    } else {
      // applied + duplicate both ack as applied (idempotent retry).
      verdicts.push({ mutationId: row.id, status: 'applied' });
      if (outcome.status === 'applied') {
        applied.push({
          mutationId: row.id,
          name: row.name,
          argsJson: row.args,
          capture: outcome.capture,
        });
      }
    }
    ackSeq = Math.max(ackSeq, row.seq);
    deps.onAfterMutation?.(index);
  }

  assert.equals(verdicts.length, sorted.length, 'mutation verdict count');

  return { ok: true, verdicts, applied, ackSeq };
}

/** Only the last applied replay may leave its savepoint to the outer commit.
 * Rejection bookkeeping also uses transaction(), but returns void, so it and
 * every duplicate or rejected result still release normally. */
function replaySavepoint(tx: SqlClient, finalRecord: boolean): SqlClient {
  return {
    connect: () => tx.connect(),
    disconnect: () => Promise.resolve(),
    query: (q) => tx.query(q),
    run: (q) => tx.run(q),
    prepare: (q) => tx.prepare(q),
    transaction: async (body) => {
      await tx.run(raw('SAVEPOINT sync_engine_mutation'));
      try {
        const result = await body(tx);
        const applied =
          typeof result === 'object' &&
          result !== null &&
          'status' in result &&
          result.status === 'applied';
        if (!finalRecord || !applied)
          await tx.run(raw('RELEASE SAVEPOINT sync_engine_mutation'));
        return result;
      } catch (error) {
        await tx.run(raw('ROLLBACK TO SAVEPOINT sync_engine_mutation'));
        await tx.run(raw('RELEASE SAVEPOINT sync_engine_mutation'));
        throw error;
      }
    },
  };
}
