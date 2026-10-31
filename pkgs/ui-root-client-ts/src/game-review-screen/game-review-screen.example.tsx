import { GameReviewScreen } from '@pkgs/ui-root-client-ts/game-review-screen';
import { GameSection } from '@pkgs/ui-root-client-ts/game-section';
import { SegmentedControl } from '@pkgs/ui-root-client-ts/segmented-control';
import { createSignal, type JSX } from 'solid-js';
import { ScreenExampleFrame } from '../../storybook/fixtures/screen-example-frame';
import { ScreenExampleStage } from '../../storybook/fixtures/screen-example-game';

export default function GameReviewScreenExample(): JSX.Element {
  const [move, setMove] = createSignal('1');
  return (
    <ScreenExampleFrame>
      <GameReviewScreen
        screenId="example-review"
        title="Round review"
        subtitle={`Move ${move()} of 3`}
        timeline={
          <SegmentedControl
            segments={['1', '2', '3'].map((key) => ({
              key,
              label: `Move ${key}`,
            }))}
            selected={move()}
            onSelect={setMove}
          />
        }
        aside={
          <GameSection title="Record">
            <p class="text textBody">Alex and Robin played 3 moves.</p>
          </GameSection>
        }
      >
        <ScreenExampleStage />
      </GameReviewScreen>
    </ScreenExampleFrame>
  );
}
