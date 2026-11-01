import { packProgress } from '@libs/game-puzzle-shared-ts/pack-progress';
import { Trans, useLingui } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { LoadingState } from '@pkgs/ui-root-client-ts/loading-state';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { Notice } from '@pkgs/ui-root-client-ts/notice';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { SuccessState } from '@pkgs/ui-root-client-ts/success-state';
import { P } from '@pkgs/ui-root-client-ts/text';
import { createMemo, For, type JSX, Show } from 'solid-js';
import { useContentGame } from './content-game-context';
import { useContentLibraryState } from './content-library-context';

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
  const status = (value: string): string =>
    value === 'completed'
      ? t`Completed`
      : value === 'in-progress'
        ? t`In progress`
        : t`Unplayed`;
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
            <MenuSection
              title={<Trans>Choose any puzzle</Trans>}
              dataSet={{ testid: 'content-pack-puzzles' }}
            >
              <For each={pack().items.map((item) => item.revisionId)}>
                {(id) => {
                  const item = () =>
                    pack().items.find((entry) => entry.revisionId === id);
                  return (
                    <MenuRow
                      title={item()?.title}
                      value={status(item()?.status ?? 'unplayed')}
                      onClick={() => open(id)}
                      dataSet={{ testid: `content-pack-puzzle-${id}` }}
                    />
                  );
                }}
              </For>
            </MenuSection>
          </StackVertical>
        )}
      </Show>
    </Show>
  );
}
