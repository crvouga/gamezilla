import type { ContentAttempt } from '@libs/game-puzzle-shared-ts/attempt-types';
import { choosePuzzleContinuationMutation } from '@libs/game-puzzle-shared-ts/choose-attempt-position-mutation';
import { Trans, useLingui } from '@lingui/solid/macro';
import { useMutationClient } from '@pkgs/sync-engine-client-ts/mutation-client-context';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { MutationModal } from '@pkgs/ui-root-client-ts/mutation-modal';
import { useCreateId } from '@pkgs/uuid-client-ts/solid';
import {
  type Accessor,
  createMemo,
  createSignal,
  For,
  type JSX,
  Show,
} from 'solid-js';
import { useContentLibraryState } from './content-library-context';
import { ContentLoadMore } from './content-load-more';
import { byContentId } from './use-content-pages';

type PositionChoice = {
  readonly positionId: string;
  readonly expectedPositionId: string;
  readonly continuationId: string;
};

/**
 * Continuing an attempt from another kept position, for as long as its
 * screens are open: the choice waiting to be confirmed.
 */
export function useContentPositionChoice(attempt: Accessor<ContentAttempt>) {
  const { t } = useLingui();
  const mutations = useMutationClient();
  const createId = useCreateId();
  const [choice, setChoice] = createSignal<PositionChoice | null>(null);
  const choose = async (): Promise<void> => {
    const selected = choice();
    if (selected === null) return;
    const result = await mutations.mutate(choosePuzzleContinuationMutation, {
      attemptId: attempt().id,
      ...selected,
    });
    if (!result.ok)
      throw new Error(
        result.failures[0]?.message ??
          t`The continuation was not chosen. Review your kept positions and try again.`
      );
  };
  return {
    /** Asks to continue from `positionId`; the attempt's shell confirms first. */
    select: (positionId: string): void => {
      setChoice({
        positionId,
        expectedPositionId: attempt().current_position_id,
        continuationId: createId(),
      });
    },
    visible: () => choice() !== null,
    close: (): void => {
      setChoice(null);
    },
    choose,
  };
}

export type ContentPositionChoice = ReturnType<typeof useContentPositionChoice>;

/** The attempt's kept positions, a page at a time, the current one marked. */
export function ContentKeptPositions(props: {
  attempt: ContentAttempt;
  disabled: boolean;
  /** Asks to continue from the position `positionId`. */
  onSelect: (positionId: string) => void;
}): JSX.Element {
  const { t } = useLingui();
  const data = useContentLibraryState();
  const positions = createMemo(() =>
    data
      .play()
      .positions.filter((position) => position.attempt_id === props.attempt.id)
      .toSorted(byContentId)
      .slice(0, data.pages.positions.limit())
  );
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
              onClick={() => props.onSelect(id)}
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
    </Show>
  );
}

/** The confirm before the attempt continues from another kept position. */
export function ContentPositionConfirm(props: {
  choice: ContentPositionChoice;
}): JSX.Element {
  return (
    <MutationModal
      visible={props.choice.visible()}
      onClose={() => props.choice.close()}
      title={<Trans>Continue this kept position?</Trans>}
      message={<Trans>Your other continuations stay saved.</Trans>}
      submitLabel={<Trans>Choose continuation</Trans>}
      successTitle={<Trans>Continuation chosen</Trans>}
      operation={props.choice.choose}
      submitDataSet={{ testid: 'content-position-confirm' }}
      dismissDataSet={{ testid: 'content-position-dismiss' }}
    />
  );
}
