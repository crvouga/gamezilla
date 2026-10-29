import { useClock } from '@pkgs/clock-client-ts/solid';
import { createSignal, type JSX, Show } from 'solid-js';
import { Badge } from './badge';
import { Button } from './button';
import { DiscDropBoardExample } from './disc-drop-board-example';
import { ExampleRoot } from './example-root';
import { GameActionButton } from './game-action-button';
import { GameBoardStage } from './game-board-stage';
import { GameChoiceGrid } from './game-choice-grid';
import { GameClock } from './game-clock';
import { GameCountdown } from './game-countdown';
import { GameDisclosure } from './game-disclosure';
import { GamePlayerBar } from './game-player-bar';
import { GameLayout } from './game-screen';
import { GameSearchState } from './game-search-state';
import { GameActions, GameSection } from './game-section';
import { GameStat } from './game-stat';
import { GameTurnPill } from './game-turn-pill';
import { ScreenIntro } from './screen-intro';

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
      <ScreenIntro title="Orbit Rally" subtitle="Play a round together." />
      <GameLayout
        aside={
          <GameSection title="Your progress">
            <GameStat label="Rating" value="1,240" detail="12 rounds played" />
          </GameSection>
        }
      >
        <GameBoardStage
          others={
            <GamePlayerBar
              name="Atlas"
              tags={<Badge intent="neutral" label="Rival" />}
              trailing={<GameClock label="Atlas" value="5:00" />}
            />
          }
          turn={
            <GameTurnPill
              emphasis="yours"
              title="Your turn."
              trailing={
                <GameCountdown
                  label="Make your first move"
                  deadline={deadline()}
                />
              }
            />
          }
          own={
            <GamePlayerBar
              name="Nova"
              active
              tags={
                <>
                  <Badge intent="neutral" label="You" />
                  <Badge intent="success" label="Ready" />
                </>
              }
              trailing={<GameClock label="Nova" value="5:00" active />}
            />
          }
        >
          <DiscDropBoardExample />
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
            title="Finding a rival"
            description="Looking for a round at your chosen pace."
            elapsed="0 seconds"
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
