import type { ContentAttempt } from '@libs/game-puzzle-shared-ts/attempt-types';
import { choosePuzzleContinuationMutation } from '@libs/game-puzzle-shared-ts/choose-attempt-position-mutation';
import { Trans, useLingui } from '@lingui/solid/macro';
import { useMutationClient } from '@pkgs/sync-engine-client-ts/mutation-client-context';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { MutationModal } from '@pkgs/ui-root-client-ts/mutation-modal';
import { createMemo, createSignal, For, type JSX, Show } from 'solid-js';
import { useContentLibraryState } from './content-library-context';
import { ContentLoadMore } from './content-load-more';
import { byContentId } from './use-content-pages';

export function ContentKeptPositions(props: {
  attempt: ContentAttempt;
  disabled: boolean;
}): JSX.Element {
  const { t } = useLingui();
  const data = useContentLibraryState();
  const mutations = useMutationClient();
  const positions = createMemo(() =>
    data
      .play()
      .positions.filter((position) => position.attempt_id === props.attempt.id)
      .toSorted(byContentId)
      .slice(0, data.pages.positions.limit())
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
        title={<Trans>Saved positions</Trans>}
        footer={
          <Trans>
            Choose a saved position to continue. Your other positions stay kept.
          </Trans>
        }
      >
        <For each={positions().map((position) => position.id)}>
          {(id, index) => (
            <MenuRow
              title={t`Saved position ${index() + 1}`}
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
      <ContentLoadMore
        page={data.pages.positions}
        label={t`Load more saved positions`}
        disabled={props.disabled}
      />
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
