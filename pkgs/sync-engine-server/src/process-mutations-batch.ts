import { assert } from '@pkgs/assert-root-shared/singleton';
import type { SqlClient } from '@pkgs/sql-client-root-shared/interface';
import { MAX_MUTATIONS_BATCH } from '@pkgs/sync-engine-shared/bounds';
import type {
  ContentRules,
  MutationAuthorize,
  MutationRegistry,
} from '@pkgs/sync-engine-shared/mutations-types';
import type { WriteCaptureSnapshot } from '@pkgs/sync-engine-shared/write-capture';
import type { TurnGames } from '@pkgs/turn-game-shared/game-rules';
import type { CreateId } from '@pkgs/uuid-shared/create-id';
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
  readonly serverDb: SqlClient;
  readonly registry: MutationRegistry;
  readonly auth: ReplayAuth;
  readonly mutations: readonly MutationRow[];
  readonly now: () => number;
  readonly createId: CreateId;
  readonly authorize?: MutationAuthorize;
  /**
   * The app's content rules as they stood at a write's time (its
   * `created_at`), handed to the mutation body as `env.contentRules`.
   */
  readonly turnGames?: TurnGames;
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
        serverDb: deps.serverDb,
        registry: deps.registry,
        auth: deps.auth,
        now: deps.now,
        createId: deps.createId,
        ...(deps.authorize !== undefined ? { authorize: deps.authorize } : {}),
        ...(deps.turnGames === undefined ? {} : { turnGames: deps.turnGames }),
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
