import type { ContentAttempt } from '@libs/game-puzzle-shared-ts/attempt-types';
import { restartPuzzleAttemptMutation } from '@libs/game-puzzle-shared-ts/restart-attempt-mutation';
import { Trans, useLingui } from '@lingui/solid/macro';
import { useMutationClient } from '@pkgs/sync-engine-client-ts/mutation-client-context';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { MutationModal } from '@pkgs/ui-root-client-ts/mutation-modal';
import { useCreateId } from '@pkgs/uuid-client-ts/solid';
import { type Accessor, createSignal, type JSX, Show } from 'solid-js';
import { useContentGame } from './content-game-context';

type RestartRequest = {
  readonly earlierAttemptId: string;
  readonly attemptId: string;
  readonly positionId: string;
};

/**
 * Restarting one attempt, for as long as its screens are open: the request
 * waiting to be confirmed, and the new attempt once it is saved.
 */
export function useContentAttemptRestart(attempt: Accessor<ContentAttempt>) {
  const { t } = useLingui();
  const game = useContentGame();
  const mutations = useMutationClient();
  const createId = useCreateId();
  const [request, setRequest] = createSignal<RestartRequest | null>(null);
  const [created, setCreated] = createSignal<string | null>(null);
  const restart = async (): Promise<void> => {
    const args = request();
    if (args === null) return;
    const result = await mutations.mutate(
      restartPuzzleAttemptMutation(game.catalog),
      args
    );
    if (!result.ok)
      throw new Error(
        result.failures[0]?.message ??
          t`A new attempt could not be saved. Your earlier attempt is still here. Try again.`
      );
    setCreated(args.attemptId);
  };
  return {
    /** Asks to restart; the attempt's shell confirms first. */
    ask: (): void => {
      setRequest({
        earlierAttemptId: attempt().id,
        attemptId: createId(),
        positionId: createId(),
      });
    },
    asking: () => request() !== null,
    close: (): void => {
      setRequest(null);
    },
    restart,
    /** The restarted attempt, once saved. */
    created,
  };
}

export type ContentAttemptRestartTools = ReturnType<
  typeof useContentAttemptRestart
>;

/**
 * Restart beside undo and redo; once a new attempt is saved, the way into
 * it takes Restart's place.
 */
export function ContentAttemptRestart(props: {
  tools: ContentAttemptRestartTools;
  disabled: boolean;
}): JSX.Element {
  const { t } = useLingui();
  const game = useContentGame();
  return (
    <Show
      when={props.tools.created()}
      fallback={
        <Button
          title={t`Restart`}
          intent="neutral"
          variant="outline"
          size="sm"
          disabled={props.disabled}
          onClick={() => props.tools.ask()}
          dataSet={{ testid: 'content-restart' }}
        />
      }
    >
      {(id) => (
        <Button
          title={t`Open restarted attempt`}
          intent="neutral"
          variant="outline"
          size="sm"
          onClick={() => game.open({ kind: 'attempt', attemptId: id() })}
          dataSet={{ testid: 'content-open-restart' }}
        />
      )}
    </Show>
  );
}

/** The confirm before a new attempt starts at the beginning. */
export function ContentAttemptRestartConfirm(props: {
  tools: ContentAttemptRestartTools;
}): JSX.Element {
  return (
    <MutationModal
      visible={props.tools.asking()}
      onClose={() => props.tools.close()}
      title={<Trans>Restart this puzzle?</Trans>}
      message={
        <Trans>
          A new attempt starts at the beginning. Your earlier progress and
          completion stay saved.
        </Trans>
      }
      submitLabel={<Trans>Restart</Trans>}
      successTitle={<Trans>New attempt saved</Trans>}
      operation={props.tools.restart}
      submitDataSet={{ testid: 'content-restart-confirm' }}
      dismissDataSet={{ testid: 'content-restart-dismiss' }}
    />
  );
}
