import { Button } from '@pkgs/ui-root-client-ts/button';
import { GameScreen } from '@pkgs/ui-root-client-ts/game-screen';
import { GameSearchState } from '@pkgs/ui-root-client-ts/game-search-state';
import { GameSection } from '@pkgs/ui-root-client-ts/game-section';
import { GameSessionLayout } from '@pkgs/ui-root-client-ts/game-session-layout';
import { GameTurnPill } from '@pkgs/ui-root-client-ts/game-turn-pill';
import { createSignal, type JSX, Match, Show, Switch } from 'solid-js';
import { ScreenExampleFrame } from '../../storybook/fixtures/screen-example-frame';
import {
  ScreenExampleSetup,
  ScreenExampleStage,
} from '../../storybook/fixtures/screen-example-game';

/** Matchmaking uses the same setup and play templates as custom games. */
export default function MatchmakingScreenExample(): JSX.Element {
  const [phase, setPhase] = createSignal('setup');
  return (
    <ScreenExampleFrame>
      <GameScreen screenId="example-matchmaking" title="Matchmaking">
        <GameSessionLayout
          setup={
            <Switch>
              <Match when={phase() === 'setup'}>
                <ScreenExampleSetup
                  label="Find an opponent"
                  onStart={() => setPhase('searching')}
                />
              </Match>
              <Match when={phase() === 'searching'}>
                <GameSearchState
                  title="Finding an opponent"
                  description="Looking for someone at your pace."
                  elapsed="0 seconds"
                  actions={
                    <div class="box flex-row flex-wrap gap-2">
                      <Button
                        title="Stop searching"
                        variant="outline"
                        onClick={() => setPhase('setup')}
                      />
                      <Button
                        title="Preview a match"
                        onClick={() => setPhase('playing')}
                      />
                    </div>
                  }
                />
              </Match>
            </Switch>
          }
          aside={
            phase() === 'playing' || phase() === 'completed' ? (
              <GameSection title="Your rating">
                <p class="text textBody">1,240</p>
              </GameSection>
            ) : undefined
          }
          status={
            <Show when={phase() === 'playing' || phase() === 'completed'}>
              <GameTurnPill
                live
                title={phase() === 'playing' ? 'Your turn' : 'Round complete'}
              />
            </Show>
          }
          actions={
            <Show when={phase() === 'playing' || phase() === 'completed'}>
              <Button
                title={
                  phase() === 'playing'
                    ? 'Finish match'
                    : 'Find another opponent'
                }
                onClick={() =>
                  setPhase(phase() === 'playing' ? 'completed' : 'setup')
                }
              />
            </Show>
          }
        >
          <Show when={phase() === 'playing' || phase() === 'completed'}>
            <ScreenExampleStage />
          </Show>
        </GameSessionLayout>
      </GameScreen>
    </ScreenExampleFrame>
  );
}
