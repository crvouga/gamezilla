import type { SqlClient } from '@pkgs/sql-client/interface';

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
  readonly serverNow?: () => Date;
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

  for (const row of sorted) {
    const outcome: ReplayOutcome = await replayMutation(
      {
        serverDb: deps.serverDb,
        registry: deps.registry,
        auth: deps.auth,
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
        });
      }
    }
    ackSeq = Math.max(ackSeq, row.seq);
  }

  return { ok: true, verdicts, applied, ackSeq };
}
