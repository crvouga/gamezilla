import { startPuzzlePlaytestMutation } from '@libs/game-puzzle-shared-ts/start-playtest-mutation';
import { useLingui } from '@lingui/solid/macro';
import { useMutationClient } from '@pkgs/sync-engine-client-ts/mutation-client-context';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { ErrorState } from '@pkgs/ui-root-client-ts/error-state';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { useMutationButton } from '@pkgs/ui-root-client-ts/use-mutation-button';
import { useCreateId } from '@pkgs/uuid-client-ts/solid';
import { type JSX, Show } from 'solid-js';
import { useContentGame } from './content-game-context';
import type { useContentDraftSave } from './use-content-draft-save';

/**
 * Starting a private playtest of the working copy, then the way into it.
 * The builder keeps the started playtest (`attemptId`), so "Open playtest"
 * is still offered when the publish screen is opened again.
 */
export function ContentDraftPlaytest(props: {
  documentId: string;
  writer: ReturnType<typeof useContentDraftSave>;
  /** The playtest is the draft's one next step: filled. */
  next?: boolean | undefined;
  disabled: boolean;
  /** The playtest started in this builder, if any. */
  attemptId: string | null;
  onStarted: (attemptId: string) => void;
}): JSX.Element {
  const { t } = useLingui();
  const game = useContentGame();
  const mutations = useMutationClient();
  const createId = useCreateId();
  const start = useMutationButton({
    operation: async () => {
      await props.writer.save();
      if (props.writer.dirty())
        throw new Error(
          t`Keep the current changes before playtesting. Try saving again.`
        );
      const id = createId();
      const result = await mutations.mutate(
        startPuzzlePlaytestMutation(game.catalog),
        {
          documentId: props.documentId,
          draftId: props.writer.draftId(),
          attemptId: id,
          positionId: createId(),
        }
      );
      if (!result.ok)
        throw new Error(
          result.failures[0]?.message ??
            t`Complete the required details and start the playtest again.`
        );
      props.onStarted(id);
    },
    labels: {
      idle: t`Start playtest`,
      loading: t`Preparing…`,
      success: t`Playtest ready`,
      error: t`Try playtesting again`,
    },
    get disabled() {
      return (
        props.disabled ||
        game.client.authoring?.readable?.(props.writer.body().definition) ===
          false
      );
    },
  });
  return (
    <StackVertical gap="sm">
      <Button
        {...start.buttonProps}
        intent={props.next === true ? 'primary' : 'neutral'}
        variant={props.next === true ? 'solid' : 'outline'}
        size={props.next === true ? 'md' : 'sm'}
        dataSet={{ testid: 'content-start-playtest' }}
      />
      <Show when={start.error()}>
        {(error) => (
          <ErrorState
            variant="compact"
            title={t`The playtest could not start`}
            body={error().message}
            retry={{
              onClick: () => {
                void start.run();
              },
            }}
          />
        )}
      </Show>
      <Show when={props.attemptId}>
        {(id) => (
          <Button
            title={t`Open playtest`}
            intent="neutral"
            variant="outline"
            onClick={() => game.open({ kind: 'attempt', attemptId: id() })}
            dataSet={{ testid: 'content-open-playtest' }}
          />
        )}
      </Show>
    </StackVertical>
  );
}
