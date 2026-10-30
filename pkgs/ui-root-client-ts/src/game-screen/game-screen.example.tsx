import { Button } from '@pkgs/ui-root-client-ts/button';
import { GameScreen } from '@pkgs/ui-root-client-ts/game-screen';
import { GameSection } from '@pkgs/ui-root-client-ts/game-section';
import { GameSessionLayout } from '@pkgs/ui-root-client-ts/game-session-layout';
import { GameTurnPill } from '@pkgs/ui-root-client-ts/game-turn-pill';
import { createSignal, type JSX, Show } from 'solid-js';
import { ScreenExampleFrame } from '../../storybook/fixtures/screen-example-frame';
import {
  ScreenExampleSetup,
  ScreenExampleStage,
} from '../../storybook/fixtures/screen-example-game';

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
              <GameTurnPill
                live
                title={phase() === 'playing' ? 'Your turn' : 'Round complete'}
                emphasis={phase() === 'playing' ? 'yours' : 'neutral'}
                tone={phase() === 'playing' ? 'neutral' : 'success'}
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
