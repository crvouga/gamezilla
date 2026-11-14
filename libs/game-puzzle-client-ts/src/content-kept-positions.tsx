import {
  type ContentAttempt,
  decodeAttemptHistory,
} from '@libs/game-puzzle-shared-ts/attempt-types';
import { choosePuzzleContinuationMutation } from '@libs/game-puzzle-shared-ts/choose-attempt-position-mutation';
import { Trans, useLingui } from '@lingui/solid/macro';
import { useMutationClient } from '@pkgs/sync-engine-client-ts/mutation-client-context';
import { Badge } from '@pkgs/ui-root-client-ts/badge';
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

/** One kept position of an attempt, as the list names it. */
export type ContentKeptPosition = {
  readonly id: string;
  /** Moves played to reach it; null when its history cannot be read. */
  readonly moves: number | null;
  /** The position the attempt continues from now. */
  readonly current: boolean;
};

/** How far into the puzzle a kept position is, in moves. */
function useMovesLabel(): (moves: number | null) => string {
  const { t } = useLingui();
  return (moves) => {
    if (moves === null) return t`A kept position`;
    if (moves === 0) return t`At the start`;
    return moves === 1 ? t`After 1 move` : t`After ${moves} moves`;
  };
}

/**
 * The attempt's kept positions, presentational: each named by how many
 * moves it is into the puzzle, the current one marked and the others one
 * press from continuing (after a confirm), with the next page to load.
 */
export function ContentKeptPositionsView(props: {
  positions: readonly ContentKeptPosition[];
  disabled: boolean;
  hasMore: boolean;
  onMore: () => void;
  /** Asks to continue from the position `positionId`. */
  onSelect: (positionId: string) => void;
}): JSX.Element {
  const { t } = useLingui();
  const label = useMovesLabel();
  const position = (id: string) =>
    props.positions.find((entry) => entry.id === id);
  return (
    <Show when={props.positions.length > 1}>
      <MenuSection
        title={<Trans>Saved positions</Trans>}
        footer={
          <Trans>
            Continue from an earlier position to try another way. The others
            stay kept.
          </Trans>
        }
      >
        <For each={props.positions.map((entry) => entry.id)}>
          {(id) => (
            <MenuRow
              title={label(position(id)?.moves ?? null)}
              value={
                position(id)?.current === true ? (
                  <Badge intent="brand" label={t`Current`} />
                ) : undefined
              }
              hideChevron={position(id)?.current === true}
              disabled={props.disabled || position(id)?.current === true}
              onClick={() => props.onSelect(id)}
              dataSet={{ testid: `content-position-${id}`, kept: 'position' }}
            />
          )}
        </For>
      </MenuSection>
      <ContentLoadMore
        page={{ hasMore: () => props.hasMore, more: () => props.onMore() }}
        label={t`Load more saved positions`}
        disabled={props.disabled}
      />
    </Show>
  );
}

/** `ContentKeptPositionsView` wired to the attempt's kept positions, a page at a time. */
export function ContentKeptPositions(props: {
  attempt: ContentAttempt;
  disabled: boolean;
  /** Asks to continue from the position `positionId`. */
  onSelect: (positionId: string) => void;
}): JSX.Element {
  const data = useContentLibraryState();
  const positions = createMemo(() =>
    data
      .play()
      .positions.filter((position) => position.attempt_id === props.attempt.id)
      .toSorted(byContentId)
      .slice(0, data.pages.positions.limit())
      .map((position) => ({
        id: position.id,
        moves: decodeAttemptHistory(position.history)?.cursor ?? null,
        current: position.id === props.attempt.current_position_id,
      }))
  );
  return (
    <ContentKeptPositionsView
      positions={positions()}
      disabled={props.disabled}
      hasMore={data.pages.positions.hasMore()}
      onMore={() => data.pages.positions.more()}
      onSelect={props.onSelect}
    />
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
