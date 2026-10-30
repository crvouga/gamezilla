import { Button } from '@pkgs/ui-root-client-ts/button';
import { GameActions } from '@pkgs/ui-root-client-ts/game-section';
import { GameTurnPill } from '@pkgs/ui-root-client-ts/game-turn-pill';
import { PuzzleScreen } from '@pkgs/ui-root-client-ts/puzzle-screen';
import { SegmentedControl } from '@pkgs/ui-root-client-ts/segmented-control';
import { createSignal, type JSX } from 'solid-js';
import { ScreenExampleFrame } from '../../storybook/fixtures/screen-example-frame';
import { ScreenExampleBoard } from '../../storybook/fixtures/screen-example-game';

export default function PuzzleScreenExample(): JSX.Element {
  const [step, setStep] = createSignal('1');
  const [message, setMessage] = createSignal('Find the next move');
  return (
    <ScreenExampleFrame>
      <PuzzleScreen
        screenId="example-puzzle"
        header={
          <GameTurnPill
            title={message()}
            detail="Puzzle 128, intermediate"
            live
          />
        }
        timeline={
          <SegmentedControl
            segments={['1', '2', '3'].map((key) => ({
              key,
              label: `Move ${key}`,
            }))}
            selected={step()}
            onSelect={setStep}
          />
        }
        actions={
          <GameActions>
            <Button
              title="Hint"
              variant="outline"
              onClick={() => setMessage('Look at the middle position')}
            />
            <Button
              title="Show solution"
              variant="outline"
              onClick={() => setMessage('Solution shown')}
            />
            <Button
              title="Next puzzle"
              onClick={() => {
                setStep('1');
                setMessage('Find the next move');
              }}
            />
          </GameActions>
        }
      >
        <ScreenExampleBoard />
      </PuzzleScreen>
    </ScreenExampleFrame>
  );
}
