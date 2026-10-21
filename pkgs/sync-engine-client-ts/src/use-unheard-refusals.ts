import { acknowledgeWriteRejectionMutation } from '@pkgs/sync-engine-shared-ts/acknowledge-write-rejection';
import type { MutateResult } from '@pkgs/sync-engine-shared-ts/mutations-types';
import { type Accessor, createSignal, onCleanup } from 'solid-js';
import { useMutationClient } from './mutation-client-context';
import { useSyncEngineInstance } from './sync-engine-context';
import type { WriteRefusal } from './write-outcome-reads';

export type UnheardRefusals = {
  /** Oldest first; empty until the first read lands. */
  readonly refusals: Accessor<readonly WriteRefusal[]>;
  /** Mark a refusal as seen, here and wherever it is kept for everyone. */
  readonly acknowledge: (refusal: WriteRefusal) => Promise<MutateResult>;
};

/**
 * Refusals of writes whose caller never heard the verdict, live, plus the
 * way to acknowledge one once the person has been told. Mount under the
 * sync engine and mutation client providers.
 */
export function useUnheardRefusals(): UnheardRefusals {
  const engine = useSyncEngineInstance();
  const client = useMutationClient();
  const subscription = engine.unheardRefusals();
  const [refusals, setRefusals] = createSignal<readonly WriteRefusal[]>(
    subscription.getSnapshot()
  );
  onCleanup(
    subscription.subscribe(() => setRefusals(subscription.getSnapshot()))
  );
  return {
    refusals,
    acknowledge: (refusal) =>
      client.mutate(acknowledgeWriteRejectionMutation, {
        mutationId: refusal.mutationId,
      }),
  };
}
