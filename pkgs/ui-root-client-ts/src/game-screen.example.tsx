import { createSignal, type JSX, Show } from 'solid-js';
import { Button } from './button';
import { GameScreen } from './game-screen';
import { GameSection } from './game-section';
import { GameSessionLayout } from './game-session-layout';
import { GameStatus } from './game-status';
import { ScreenExampleFrame } from './screen-example-frame';
import { ScreenExampleSetup, ScreenExampleStage } from './screen-example-game';

/** Custom game: setup → play → result → another round. */
export default function GameScreenExample(): JSX.Element {
  const [phase, setPhase] = createSignal('setup');
  return (
    <ScreenExampleFrame>
      <GameScreen
        screenId="example-custom-game"
        title="Custom game"
        subtitle="Play a round together."
      >
        <GameSessionLayout
          setup={
            <Show when={phase() === 'setup'}>
              <ScreenExampleSetup onStart={() => setPhase('playing')} />
            </Show>
          }
          aside={
            phase() === 'setup' ? undefined : (
              <GameSection title="Round record">
                <p class="text textBody">Moves and participants appear here.</p>
              </GameSection>
            )
          }
          status={
            <Show when={phase() !== 'setup'}>
              <GameStatus
                live
                title={phase() === 'playing' ? 'Your turn' : 'Round complete'}
                tone={phase() === 'playing' ? 'active' : 'success'}
              />
            </Show>
          }
          actions={
            <Show when={phase() !== 'setup'}>
              <Button
                title={phase() === 'playing' ? 'Finish round' : 'New round'}
                onClick={() =>
                  setPhase(phase() === 'playing' ? 'completed' : 'setup')
                }
              />
            </Show>
          }
        >
          <Show when={phase() !== 'setup'}>
            <ScreenExampleStage />
          </Show>
        </GameSessionLayout>
      </GameScreen>
    </ScreenExampleFrame>
  );
}
