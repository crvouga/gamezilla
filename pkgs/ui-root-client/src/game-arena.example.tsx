import { useClock } from '@pkgs/clock-client/solid';
import { createSignal, type JSX, Show } from 'solid-js';
import { Button } from './button';
import { ExampleRoot } from './example-root';
import { GameActionButton } from './game-action-button';
import { GameBoardStage } from './game-board-stage';
import { GameChoiceGrid } from './game-choice-grid';
import { GameClock } from './game-clock';
import { GameCountdown } from './game-countdown';
import { GameDisclosure } from './game-disclosure';
import { GameHeader } from './game-header';
import { GamePlayerCard } from './game-player-card';
import { GameLayout } from './game-screen';
import { GameSearchState } from './game-search-state';
import { GameActions, GameSection } from './game-section';
import { GameStat } from './game-stat';
import { GameVersus } from './game-versus';

const PACES = [
  { value: 'short', title: '2 min', detail: 'Quick round' },
  { value: 'medium', title: '5 min', detail: 'Find your rhythm' },
  { value: 'long', title: '10 min', detail: 'Take your time' },
];

/** One example composes every game primitive without a game-specific dependency. */
export default function GameArenaExample(): JSX.Element {
  const clock = useClock();
  const [pace, setPace] = createSignal('medium');
  const [searching, setSearching] = createSignal(false);
  const [deadline, setDeadline] = createSignal<number | null>(null);
  return (
    <ExampleRoot>
      <GameHeader
        context="Orbit Rally · Play together"
        title="A little friendly rivalry"
        description="Your next round starts here."
      />
      <GameLayout
        aside={
          <GameSection title="Your progress">
            <GameStat label="Rating" value="1,240" detail="12 rounds played" />
          </GameSection>
        }
      >
        <GameVersus
          first={
            <GamePlayerCard label="You" name="Nova" ready status="Ready" />
          }
          second={
            <GamePlayerCard
              label="Rival"
              name="Atlas"
              active
              status="Getting ready"
            />
          }
        />
        <div class="box flex-row gap-2">
          <GameClock label="Nova" value="5:00" active />
          <GameClock label="Atlas" value="5:00" />
        </div>
        <GameCountdown label="Make your first move" deadline={deadline()} />
        <GameBoardStage>
          <div class="box items-center justify-center min-h-32 rounded-lg bg-surface-sunken text-text-secondary">
            Interactive play surface
          </div>
        </GameBoardStage>
        <Show
          when={searching()}
          fallback={
            <GameSection
              title="Choose your pace"
              description="Fast and focused or time to explore."
            >
              <GameChoiceGrid
                label="Round length"
                choices={PACES}
                value={pace()}
                onChange={setPace}
              />
              <GameActions>
                <GameActionButton
                  title="Find a rival"
                  variant="solid"
                  operation={() => {
                    setSearching(true);
                    return Promise.resolve();
                  }}
                />
                <GameActionButton
                  title="Start round"
                  operation={() => {
                    setDeadline(clock.now() + 30_000);
                    return Promise.resolve();
                  }}
                />
              </GameActions>
              <GameDisclosure title="Round options">
                <p>Extra choices stay here, without opening a dialog.</p>
              </GameDisclosure>
            </GameSection>
          }
        >
          <GameSearchState
            title="Finding your rival"
            description="Looking for a round at your chosen pace."
            elapsed="0"
            actions={
              <Button
                title="Stop searching"
                variant="outline"
                onClick={() => setSearching(false)}
              />
            }
          />
        </Show>
      </GameLayout>
    </ExampleRoot>
  );
}
