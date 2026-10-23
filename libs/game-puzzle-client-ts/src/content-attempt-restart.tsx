import type { ContentAttempt } from '@libs/game-puzzle-shared-ts/attempt-types';
import { restartPuzzleAttemptMutation } from '@libs/game-puzzle-shared-ts/restart-attempt-mutation';
import { Trans, useLingui } from '@lingui/solid/macro';
import { useMutationClient } from '@pkgs/sync-engine-client-ts/mutation-client-context';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { MutationModal } from '@pkgs/ui-root-client-ts/mutation-modal';
import { useCreateId } from '@pkgs/uuid-client-ts/solid';
import { createSignal, type JSX, Show } from 'solid-js';
import { useContentGame } from './content-game-context';

export function ContentAttemptRestart(props: {
  attempt: ContentAttempt;
  disabled: boolean;
}): JSX.Element {
  const { t } = useLingui();
  const game = useContentGame();
  const mutations = useMutationClient();
  const createId = useCreateId();
  const [request, setRequest] = createSignal<{
    earlierAttemptId: string;
    attemptId: string;
    positionId: string;
  } | null>(null);
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
  return (
    <>
      <Button
        title={t`Restart`}
        intent="neutral"
        variant="outline"
        disabled={props.disabled}
        onClick={() =>
          setRequest({
            earlierAttemptId: props.attempt.id,
            attemptId: createId(),
            positionId: createId(),
          })
        }
        dataSet={{ testid: 'content-restart' }}
      />
      <Show when={created()}>
        {(id) => (
          <Button
            title={t`Open restarted attempt`}
            onClick={() => game.open({ kind: 'attempt', attemptId: id() })}
            dataSet={{ testid: 'content-open-restart' }}
          />
        )}
      </Show>
      <MutationModal
        visible={request() !== null}
        onClose={() => setRequest(null)}
        title={<Trans>Restart this puzzle?</Trans>}
        message={
          <Trans>
            A new attempt starts at the beginning. Your earlier progress and
            completion stay saved.
          </Trans>
        }
        submitLabel={<Trans>Restart</Trans>}
        successTitle={<Trans>New attempt saved</Trans>}
        operation={restart}
      />
    </>
  );
}
