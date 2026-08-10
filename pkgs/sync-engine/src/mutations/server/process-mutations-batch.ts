import type { SqlClient } from '@pkgs/sql-client/interface';
import type { CreateId } from '@pkgs/uuid';

import type { WriteCaptureSnapshot } from '../../sql-ast';
import type { MutationRegistry } from '../core/types';
import {
  type MutationRow,
  type ReplayAuth,
  type ReplayOutcome,
  replayMutation,
} from './replay-mutation';

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
  readonly serverNow?: () => Date;
  /**
   * Called after each mutation attempt (applied/rejected/duplicate).
   * Sim uses this for in-txn fault injection at the replay loop boundary.
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
        ...(deps.serverNow !== undefined ? { serverNow: deps.serverNow } : {}),
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

  return { ok: true, verdicts, applied, ackSeq };
}
