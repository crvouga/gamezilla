import { Button } from '@pkgs/ui-root-client-ts/button';
import { GameHistoryScreen } from '@pkgs/ui-root-client-ts/game-history-screen';
import { GameReviewScreen } from '@pkgs/ui-root-client-ts/game-review-screen';
import { MenuList } from '@pkgs/ui-root-client-ts/menu-list';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MetricStrip } from '@pkgs/ui-root-client-ts/metric-strip';
import { createSignal, For, type JSX, Show } from 'solid-js';
import { ScreenExampleFrame } from '../../storybook/fixtures/screen-example-frame';
import { ScreenExampleStage } from '../../storybook/fixtures/screen-example-game';

export default function GameHistoryScreenExample(): JSX.Element {
  const [selected, setSelected] = createSignal<string | null>(null);
  return (
    <ScreenExampleFrame>
      <Show
        when={selected()}
        fallback={
          <GameHistoryScreen
            screenId="example-history"
            title="Round history"
            summary={
              <MetricStrip
                aria-label="Summary"
                metrics={[
                  { label: 'Rounds', value: '24' },
                  { label: 'Rating', value: '1,240' },
                ]}
              />
            }
          >
            <MenuList>
              <For
                each={[
                  'Won against Robin',
                  'Solved puzzle 128',
                  'Draw against Morgan',
                ]}
              >
                {(title) => (
                  <MenuRow
                    title={title}
                    caption="Today"
                    onClick={() => setSelected(title)}
                  />
                )}
              </For>
            </MenuList>
          </GameHistoryScreen>
        }
      >
        <GameReviewScreen
          screenId="example-history-review"
          title={selected()}
          actions={
            <Button
              title="Back to history"
              variant="outline"
              onClick={() => setSelected(null)}
            />
          }
        >
          <ScreenExampleStage />
        </GameReviewScreen>
      </Show>
    </ScreenExampleFrame>
  );
}
