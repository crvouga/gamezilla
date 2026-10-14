import { createSignal, type JSX } from 'solid-js';
import { GameReviewScreen } from './game-review-screen';
import { GameSection } from './game-section';
import { ScreenExampleFrame } from './screen-example-frame';
import { ScreenExampleStage } from './screen-example-game';
import { SegmentedControl } from './segmented-control';

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
