import type {
  AttemptCommand,
  ContentAttempt,
} from '@libs/game-puzzle-shared-ts/attempt-types';
import { changePuzzleAttemptMutation } from '@libs/game-puzzle-shared-ts/change-attempt-mutation';
import { useLingui } from '@lingui/solid/macro';
import { createAsync } from '@pkgs/async-root-client-ts/solid';
import { useMutationClient } from '@pkgs/sync-engine-client-ts/mutation-client-context';
import { usePendingOperation } from '@pkgs/ui-root-client-ts/pending-navigation';
import { useCreateId } from '@pkgs/uuid-client-ts/solid';
import { createEffect, createSignal } from 'solid-js';
import { useContentGame } from './content-game-context';
import { useContentLibraryState } from './content-library-context';

export function useContentAttemptChange(attempt: () => ContentAttempt) {
  const { t } = useLingui();
  const game = useContentGame();
  const data = useContentLibraryState();
  const mutations = useMutationClient();
  const createId = useCreateId();
  const [last, setLast] = createSignal<AttemptCommand | null>(null);
  const [adopting, setAdopting] = createSignal<string | null>(null);
  createEffect(() => {
    const id = adopting();
    if (data.play().positions.some((entry) => entry.id === id))
      setAdopting(null);
  });
  const change = createAsync({
    operation: async (_context, command: AttemptCommand) => {
      const current = attempt();
      const positionId = createId();
      const result = await mutations.mutate(
        changePuzzleAttemptMutation(game.catalog),
        {
          attemptId: current.id,
          parentId: current.current_position_id,
          positionId,
          command,
        }
      );
      if (!result.ok)
        throw new Error(
          result.failures[0]?.message ??
            t`The change was not saved. Your previous position is still kept. Try again.`
        );
      setAdopting(positionId);
    },
  });
  const pending = () => change.loading() || adopting() !== null;
  const execute = (command: AttemptCommand): void => {
    if (pending()) return;
    setLast(command);
    void change.run(command).catch(() => undefined);
  };
  const retry = (): void => {
    const command = last();
    if (command !== null) execute(command);
  };
  usePendingOperation(pending, () => change.cancelAll());
  return { change, pending, execute, retry };
}
