import { attemptContinuations } from '@libs/game-puzzle-shared-ts/attempt-library';
import type { ContentAttempt } from '@libs/game-puzzle-shared-ts/attempt-types';
import { choosePuzzleContinuationMutation } from '@libs/game-puzzle-shared-ts/choose-attempt-position-mutation';
import { Trans, useLingui } from '@lingui/solid/macro';
import { useMutationClient } from '@pkgs/sync-engine-client-ts/mutation-client-context';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { MutationModal } from '@pkgs/ui-root-client-ts/mutation-modal';
import { createMemo, createSignal, For, type JSX, Show } from 'solid-js';
import { useContentLibraryState } from './content-library-context';

export function ContentKeptPositions(props: {
  attempt: ContentAttempt;
  disabled: boolean;
}): JSX.Element {
  const { t } = useLingui();
  const data = useContentLibraryState();
  const mutations = useMutationClient();
  const positions = createMemo(() =>
    attemptContinuations(data.play(), props.attempt.id)
  );
  const [choice, setChoice] = createSignal<{
    positionId: string;
    expectedPositionId: string;
  } | null>(null);
  const choose = async (): Promise<void> => {
    const selected = choice();
    if (selected === null) return;
    const result = await mutations.mutate(choosePuzzleContinuationMutation, {
      attemptId: props.attempt.id,
      ...selected,
    });
    if (!result.ok)
      throw new Error(
        result.failures[0]?.message ??
          t`The continuation was not chosen. Review your kept positions and try again.`
      );
  };
  return (
    <Show when={positions().length > 1}>
      <MenuSection
        title={<Trans>Kept continuations</Trans>}
        footer={
          <Trans>
            Changes made from different positions stay separate. Choose which
            one to continue.
          </Trans>
        }
      >
        <For each={positions().map((position) => position.id)}>
          {(id, index) => (
            <MenuRow
              title={t`Continuation ${index() + 1}`}
              value={
                id === props.attempt.current_position_id ? t`Current` : t`Kept`
              }
              disabled={
                props.disabled || id === props.attempt.current_position_id
              }
              onClick={() =>
                setChoice({
                  positionId: id,
                  expectedPositionId: props.attempt.current_position_id,
                })
              }
              dataSet={{ testid: `content-position-${id}` }}
            />
          )}
        </For>
      </MenuSection>
      <MutationModal
        visible={choice() !== null}
        onClose={() => setChoice(null)}
        title={<Trans>Continue this kept position?</Trans>}
        message={<Trans>Your other continuations stay saved.</Trans>}
        submitLabel={<Trans>Choose continuation</Trans>}
        successTitle={<Trans>Continuation chosen</Trans>}
        operation={choose}
      />
    </Show>
  );
}
