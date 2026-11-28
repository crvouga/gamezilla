import { PuzzleArt } from '@pkgs/ui-root-client-ts/illustration';
import {
  type PackPuzzleProgress,
  packProgress,
} from '@libs/game-puzzle-shared-ts/pack-progress';
import { Trans, useLingui } from '@pkgs/lingui-solid-client-ts/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { EmptyState } from '@pkgs/ui-root-client-ts/empty-state';
import { LoadingState } from '@pkgs/ui-root-client-ts/loading-state';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { Notice } from '@pkgs/ui-root-client-ts/notice';
import { PuzzleGrid } from '@pkgs/ui-root-client-ts/puzzle-grid';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { SuccessState } from '@pkgs/ui-root-client-ts/success-state';
import { P } from '@pkgs/ui-root-client-ts/text';
import type { JSX } from '@solidjs/web';
import { createMemo, For, Show } from 'solid-js';
import { useContentGame } from './content-game-context';
import { useContentLibraryState } from './content-library-context';
import { isNumberedSequence } from './content-pack-sequence';

/** The words for where a pack puzzle stands. */
function useStatusWord(): (value: PackPuzzleProgress['status']) => string {
  const { t } = useLingui();
  return (value) =>
    value === 'completed'
      ? t`Completed`
      : value === 'in-progress'
        ? t`In progress`
        : t`Unplayed`;
}

/**
 * Puzzles that carry only their number, as numbered tiles: a check on each
 * solved one, the next puzzle to play filled.
 */
export function PackPuzzleGrid(props: {
  items: readonly PackPuzzleProgress[];
  next: PackPuzzleProgress | null;
  onOpen: (revisionId: string) => void;
}): JSX.Element {
  const { t } = useLingui();
  const status = useStatusWord();
  return (
    <StackVertical gap="sm">
      <P variant="caption" tone="secondary">
        <Trans>Choose any puzzle</Trans>
      </P>
      <PuzzleGrid
        label={t`Puzzles in this pack`}
        dataSet={{ testid: 'content-pack-puzzles' }}
        tiles={props.items.map((item, index) => ({
          key: item.revisionId,
          number: index + 1,
          label: t`${item.title}, ${status(item.status)}`,
          state:
            item.status === 'completed'
              ? 'solved'
              : item.revisionId === props.next?.revisionId
                ? 'current'
                : 'open',
          onPress: () => props.onOpen(item.revisionId),
          dataSet: { testid: `content-pack-puzzle-${item.revisionId}` },
        }))}
      />
    </StackVertical>
  );
}

/** Puzzles that need their names, one row each with where it stands. */
export function PackPuzzleList(props: {
  items: readonly PackPuzzleProgress[];
  onOpen: (revisionId: string) => void;
}): JSX.Element {
  const status = useStatusWord();
  return (
    <MenuSection
      title={<Trans>Choose any puzzle</Trans>}
      dataSet={{ testid: 'content-pack-puzzles' }}
    >
      <For each={props.items.map((item) => item.revisionId)}>
        {(id) => {
          const item = () =>
            props.items.find((entry) => entry.revisionId === id);
          return (
            <MenuRow
              title={item()?.title}
              value={status(item()?.status ?? 'unplayed')}
              onClick={() => props.onOpen(id)}
              dataSet={{ testid: `content-pack-puzzle-${id}` }}
            />
          );
        }}
      </For>
    </MenuSection>
  );
}

export function ContentPackOverview(props: {
  revisionId: string;
}): JSX.Element {
  const { t } = useLingui();
  const game = useContentGame();
  const data = useContentLibraryState();
  const progress = createMemo(() =>
    packProgress({
      content: data.content(),
      play: data.play(),
      packRevisionId: props.revisionId,
    })
  );
  const available = createMemo(() => {
    const pack = progress();
    return pack !== null && pack.items.length === pack.total;
  });
  const open = (revisionId: string): void =>
    game.open({
      kind: 'edition',
      revisionId,
      packRevisionId: props.revisionId,
    });
  return (
    <Show when={available() || !data.isFetching()} fallback={<LoadingState />}>
      <Show
        when={progress()}
        fallback={
          <Notice tone="error">
            <Trans>
              This pack is not available on this device. Reconnect and open it
              again.
            </Trans>
          </Notice>
        }
      >
        {(pack) => (
          <StackVertical gap="lg">
            <P
              role="status"
              dataSet={{ testid: 'content-pack-progress' }}
            >{t`${pack().completedCount} of ${pack().total} puzzles completed`}</P>
            <Show when={pack().complete}>
              <SuccessState
                title={t`Pack completed`}
                body={t`Every puzzle is completed. You can revisit any of them.`}
              />
            </Show>
            <Show when={pack().next}>
              {(next) => (
                <Button
                  title={
                    next().status === 'unplayed'
                      ? t`Play ${next().title}`
                      : t`Continue ${next().title}`
                  }
                  fullWidth
                  onClick={() => open(next().revisionId)}
                  dataSet={{ testid: 'content-pack-next' }}
                />
              )}
            </Show>
            <Show when={pack().items.length < pack().total}>
              <Notice>
                <Trans>
                  Some puzzles have not reached this device. Reconnect to load
                  the rest. Your progress stays saved.
                </Trans>
              </Notice>
            </Show>
            <Show
              when={
                pack().items.length === pack().total &&
                isNumberedSequence(pack().items.map((item) => item.title))
              }
              fallback={
                <Show
                  when={pack().total > 0}
                  fallback={
                    <EmptyState
          icon={PuzzleArt}
                      variant="compact"
                      title={t`This pack has no puzzles yet`}
                      body={t`Its author has not added a puzzle. Return to puzzles and choose another pack.`}
                      dataSet={{ testid: 'content-pack-empty' }}
                    />
                  }
                >
                  <PackPuzzleList items={pack().items} onOpen={open} />
                </Show>
              }
            >
              <PackPuzzleGrid
                items={pack().items}
                next={pack().next}
                onOpen={open}
              />
            </Show>
          </StackVertical>
        )}
      </Show>
    </Show>
  );
}
