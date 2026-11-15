import type { ContentAttempt } from '@libs/game-puzzle-shared-ts/attempt-types';
import { restartPuzzleAttemptMutation } from '@libs/game-puzzle-shared-ts/restart-attempt-mutation';
import { useLingui } from '@lingui/solid/macro';
import { useMutationClient } from '@pkgs/sync-engine-client-ts/mutation-client-context';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { ErrorState } from '@pkgs/ui-root-client-ts/error-state';
import { useCreateId } from '@pkgs/uuid-client-ts/solid';
import { type Accessor, createSignal, type JSX, Show } from 'solid-js';
import { useContentGame } from './content-game-context';

/**
 * Restarting one attempt in one press: a new attempt at the same edition
 * starts at the beginning and opens on its board. Nothing is lost (the
 * earlier attempt and any completion stay kept), so there is nothing to
 * confirm; a refused restart stays here with its reason and a retry.
 */
export function useContentAttemptRestart(attempt: Accessor<ContentAttempt>) {
  const { t } = useLingui();
  const game = useContentGame();
  const mutations = useMutationClient();
  const createId = useCreateId();
  const [pending, setPending] = createSignal(false);
  const [failure, setFailure] = createSignal<string | null>(null);
  const restart = async (): Promise<void> => {
    if (pending()) return;
    const attemptId = createId();
    const refused = t`A new attempt could not be saved. Your earlier attempt is still here. Try again.`;
    setPending(true);
    setFailure(null);
    try {
      const result = await mutations.mutate(
        restartPuzzleAttemptMutation(game.catalog),
        {
          earlierAttemptId: attempt().id,
          attemptId,
          positionId: createId(),
        }
      );
      if (result.ok)
        game.open({
          kind: 'attempt',
          attemptId,
          restartedFrom: attempt().id,
        });
      else setFailure(result.failures[0]?.message ?? refused);
    } catch (error) {
      setFailure(error instanceof Error ? error.message : refused);
    } finally {
      setPending(false);
    }
  };
  return {
    /** Starts the new attempt and opens it. */
    restart: (): void => {
      void restart();
    },
    pending,
    /** Why the last restart was refused; the earlier attempt stays. */
    failure,
  };
}

export type ContentAttemptRestartTools = ReturnType<
  typeof useContentAttemptRestart
>;

/** Restart beside undo and redo: one press opens a new attempt at the start. */
export function ContentAttemptRestart(props: {
  tools: ContentAttemptRestartTools;
  disabled: boolean;
}): JSX.Element {
  const { t } = useLingui();
  return (
    <Button
      title={t`Restart`}
      intent="neutral"
      variant="outline"
      size="sm"
      loading={props.tools.pending()}
      loadingLabel={t`Restarting…`}
      disabled={props.disabled}
      onClick={() => props.tools.restart()}
      dataSet={{ testid: 'content-restart' }}
    />
  );
}

/** A restart that was refused: why, with a retry; the earlier attempt stays. */
export function ContentAttemptRestartFailure(props: {
  tools: ContentAttemptRestartTools;
}): JSX.Element {
  const { t } = useLingui();
  return (
    <Show when={props.tools.failure()}>
      {(message) => (
        <ErrorState
          variant="compact"
          title={t`The new attempt did not start`}
          body={message()}
          retry={{ onClick: () => props.tools.restart() }}
          dataSet={{ testid: 'content-restart-failed' }}
        />
      )}
    </Show>
  );
}
