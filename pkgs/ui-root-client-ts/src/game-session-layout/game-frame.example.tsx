/** @jsxImportSource solid-js */

import { Avatar } from '@pkgs/ui-root-client-ts/avatar';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { GameActionBar } from '@pkgs/ui-root-client-ts/game-action-bar';
import { GameBoardStage } from '@pkgs/ui-root-client-ts/game-board-stage';
import { GameOptionField } from '@pkgs/ui-root-client-ts/game-option-field';
import {
  GAME_PLAYER_AVATAR_SIZE,
  GamePlayerBar,
} from '@pkgs/ui-root-client-ts/game-player-bar';
import {
  GAME_PLAYER_CHIP_AVATAR_SIZE,
  GamePlayerChip,
  GamePlayerRail,
} from '@pkgs/ui-root-client-ts/game-player-rail';
import {
  GameResultHeadline,
  GameStandings,
} from '@pkgs/ui-root-client-ts/game-result';
import { GameScreen } from '@pkgs/ui-root-client-ts/game-screen';
import {
  GameSessionHeader,
  GameSessionLayout,
} from '@pkgs/ui-root-client-ts/game-session-layout';
import { GameTurnPill } from '@pkgs/ui-root-client-ts/game-turn-pill';
import { GameWatcherCount } from '@pkgs/ui-root-client-ts/game-watching';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { createSignal, For, type JSX, Match, Switch } from 'solid-js';
import {
  exampleAvatar,
  exampleSeats,
} from '../../storybook/fixtures/game-frame-example-data';
import { ScreenExampleFrame } from '../../storybook/fixtures/screen-example-frame';
import { ScreenExampleBoard } from '../../storybook/fixtures/screen-example-game';

type Phase = 'setup' | 'play' | 'over';

const TABLE = exampleSeats(4).slice(1);

function SetupPhase(): JSX.Element {
  const [points, setPoints] = createSignal(11);
  return (
    <StackVertical gap="md">
      <GamePlayerBar
        name="You"
        avatar={<Avatar you size={GAME_PLAYER_AVATAR_SIZE} />}
        swatch={{ color: 'player1', mark: '●' }}
      />
      <For each={TABLE}>
        {(seat) => (
          <GamePlayerBar
            name={seat.name}
            avatar={exampleAvatar(seat, GAME_PLAYER_AVATAR_SIZE)}
            swatch={seat.look}
          />
        )}
      </For>
      <GameOptionField
        kind="count"
        label="Points to win"
        value={points()}
        min={1}
        max={99}
        onChange={setPoints}
        message={{ text: 'From 1 to 99' }}
      />
    </StackVertical>
  );
}

function PlayPhase(): JSX.Element {
  return (
    <GameBoardStage
      others={
        <GamePlayerRail aria-label="Other players">
          <For each={TABLE}>
            {(seat, index) => (
              <GamePlayerChip
                name={seat.name}
                avatar={exampleAvatar(seat, GAME_PLAYER_CHIP_AVATAR_SIZE)}
                swatch={seat.look}
                stat={{ label: 'Score', value: seat.score }}
                active={index() === 0}
              />
            )}
          </For>
        </GamePlayerRail>
      }
      turn={<GameTurnPill live title="Stockfish to move." />}
      own={
        <GamePlayerBar
          name="You"
          avatar={<Avatar you size={GAME_PLAYER_AVATAR_SIZE} />}
          swatch={{ color: 'player1', mark: '●' }}
          stat={{ label: 'Score', value: '18' }}
        />
      }
    >
      <ScreenExampleBoard />
    </GameBoardStage>
  );
}

function OverPhase(): JSX.Element {
  return (
    <StackVertical gap="lg">
      <GameResultHeadline
        title="You came 2nd"
        caption="Erin wins by 5 points."
      />
      <GameStandings
        aria-label="Standings"
        scoreLabel="Points"
        rows={exampleSeats(4).map((seat, index) => ({
          id: seat.id,
          place: index + 1,
          name: index === 1 ? 'You' : seat.name,
          avatar: exampleAvatar(seat, 32),
          score: seat.score,
          you: index === 1,
        }))}
      />
    </StackVertical>
  );
}

const NEXT: Readonly<Record<Phase, { label: string; phase: Phase }>> = {
  setup: { label: 'Start game', phase: 'play' },
  play: { label: 'End game', phase: 'over' },
  over: { label: 'Rematch', phase: 'setup' },
};

/** The shared game frame: Setup → Play → Game over, watched by 12.4K. */
export default function GameFrameExample(): JSX.Element {
  const [phase, setPhase] = createSignal<Phase>('setup');
  return (
    <ScreenExampleFrame>
      <GameScreen screenId="example-game-frame" title="Game frame">
        <GameSessionLayout
          header={
            <GameSessionHeader
              trailing={
                <>
                  <GameWatcherCount value={12_400} label="12,400 watching" />
                  <Button
                    title="Change game"
                    intent="neutral"
                    variant="outline"
                    size="sm"
                  />
                </>
              }
            />
          }
          actions={
            <GameActionBar
              aria-label="Actions"
              items={[
                {
                  id: 'next',
                  label: NEXT[phase()].label,
                  testId: 'example-game-frame-next',
                  onPress: () => setPhase(NEXT[phase()].phase),
                  emphasis: 'primary',
                },
              ]}
            />
          }
        >
          <Switch>
            <Match when={phase() === 'setup'}>
              <SetupPhase />
            </Match>
            <Match when={phase() === 'play'}>
              <PlayPhase />
            </Match>
            <Match when={phase() === 'over'}>
              <OverPhase />
            </Match>
          </Switch>
        </GameSessionLayout>
      </GameScreen>
    </ScreenExampleFrame>
  );
}
