import { startPuzzleAttemptMutation } from '@libs/game-puzzle-shared-ts/start-attempt-mutation';
import { DenialSurface } from '@libs/permissions-client-ts/denial-surface';
import { useDecision } from '@libs/permissions-client-ts/use-can';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import { useLingui } from '@lingui/solid/macro';
import { useMutationClient } from '@pkgs/sync-engine-client-ts/mutation-client-context';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { ErrorState } from '@pkgs/ui-root-client-ts/error-state';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { useMutationButton } from '@pkgs/ui-root-client-ts/use-mutation-button';
import { useCreateId } from '@pkgs/uuid-client-ts/solid';
import { createMemo, createSignal, type JSX, Show } from 'solid-js';
import { useContentGame } from './content-game-context';
import { useContentLibraryState } from './content-library-context';

export function ContentStartAttempt(props: {
  revisionId: string;
  packRevisionId: string | null;
  disabled: boolean;
}): JSX.Element {
  const { t } = useLingui();
  const game = useContentGame();
  const data = useContentLibraryState();
  const mutations = useMutationClient();
  const createId = useCreateId();
  const decision = useDecision(PERMISSION.puzzlesPlay);
  const [created, setCreated] = createSignal<string | null>(null);
  const previous = createMemo(() =>
    data
      .play()
      .attempts.find(
        (attempt) =>
          attempt.mode === 'ordinary' && attempt.source_id === props.revisionId
      )
  );
  const selected = () => created() ?? previous()?.id;
  const start = useMutationButton({
    operation: async () => {
      const attemptId = createId();
      const result = await mutations.mutate(
        startPuzzleAttemptMutation(game.catalog),
        {
          revisionId: props.revisionId,
          packRevisionId: props.packRevisionId,
          attemptId,
          positionId: createId(),
        }
      );
      if (!result.ok)
        throw new Error(
          result.failures[0]?.message ??
            t`The attempt could not be saved. Try starting again.`
        );
      setCreated(attemptId);
    },
    labels: {
      idle: t`Start a new attempt`,
      loading: t`Starting…`,
      success: t`Attempt saved`,
      error: t`Try starting again`,
    },
    get disabled() {
      return props.disabled;
    },
  });
  return (
    <Show
      when={decision().allowed}
      fallback={<DenialSurface decision={decision()} />}
    >
      <StackVertical gap="md">
        <Show when={selected()}>
          {(id) => (
            <Button
              title={t`Continue saved attempt`}
              onClick={() => game.open({ kind: 'attempt', attemptId: id() })}
              dataSet={{ testid: 'content-continue-attempt' }}
            />
          )}
        </Show>
        <Button
          {...start.buttonProps}
          dataSet={{ testid: 'content-start-attempt' }}
        />
        <Show when={start.error()}>
          {(error) => (
            <ErrorState
              variant="compact"
              title={t`The attempt was not started`}
              body={error().message}
              retry={{
                onClick: () => {
                  void start.run();
                },
              }}
            />
          )}
        </Show>
      </StackVertical>
    </Show>
  );
}
