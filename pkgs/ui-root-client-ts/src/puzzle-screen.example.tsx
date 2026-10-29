import { createSignal, type JSX } from 'solid-js';
import { Button } from './button';
import { GameActions } from './game-section';
import { GameTurnPill } from './game-turn-pill';
import { PuzzleScreen } from './puzzle-screen';
import { ScreenExampleFrame } from './screen-example-frame';
import { ScreenExampleBoard } from './screen-example-game';
import { SegmentedControl } from './segmented-control';

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
