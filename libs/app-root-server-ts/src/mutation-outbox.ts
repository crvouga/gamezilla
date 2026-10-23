import { withOutboxCausation } from '@pkgs/outbox-shared-ts/causation';
import type {
  CommittedMutations,
  MutationTxWrapper,
} from '@pkgs/sync-engine-server-ts/mutation-lifecycle';
import { drainAndNotifyOutbox } from './outbox-drain';

/** Neither a wire client id nor a guessed foreign mutation id selects another actor's work. */
export function mutationOutboxCausation(
  actorId: string,
  mutationId: string
): string {
  return JSON.stringify([actorId, mutationId]);
}

export const scopeMutationOutbox: MutationTxWrapper = ({
  tx,
  auth,
  mutationId,
}) =>
  withOutboxCausation(tx, mutationOutboxCausation(auth.actorId, mutationId));

export async function drainCommittedMutationOutbox(
  args: {
    readonly batch: CommittedMutations;
  } & Omit<
    Parameters<typeof drainAndNotifyOutbox>[0],
    'db' | 'eventIds' | 'causationIds'
  >
): Promise<void> {
  const { batch, ...ports } = args;
  await drainAndNotifyOutbox({
    ...ports,
    db: batch.db,
    causationIds: batch.mutationIds.map((id) =>
      mutationOutboxCausation(batch.auth.actorId, id)
    ),
  });
}
