/** @jsxImportSource solid-js */

import { Avatar } from '@pkgs/ui-root-client-ts/avatar';
import { Badge } from '@pkgs/ui-root-client-ts/badge';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { GameActionBar } from '@pkgs/ui-root-client-ts/game-action-bar';
import { GameBoardStage } from '@pkgs/ui-root-client-ts/game-board-stage';
import {
  GAME_PLAYER_AVATAR_SIZE,
  GamePlayerBar,
} from '@pkgs/ui-root-client-ts/game-player-bar';
import type { GamePlayerState } from '@pkgs/ui-root-client-ts/game-player-parts';
import {
  GAME_PLAYER_CHIP_AVATAR_SIZE,
  GamePlayerChip,
  GamePlayerRail,
} from '@pkgs/ui-root-client-ts/game-player-rail';
import { GameTurnPill } from '@pkgs/ui-root-client-ts/game-turn-pill';
import {
  GameWatcherCount,
  GameWatchingFooter,
} from '@pkgs/ui-root-client-ts/game-watching';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { createSignal, For, type JSX } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';
import { ExampleSection } from '../../storybook/fixtures/example-section';
import {
  type ExampleSeat,
  exampleAvatar,
  exampleSeat,
  exampleSeats,
} from '../../storybook/fixtures/game-frame-example-data';
import { SchemePreview } from '../../storybook/fixtures/scheme-preview';
import { ScreenExampleBoard } from '../../storybook/fixtures/screen-example-game';

const OUT: GamePlayerState = { kind: 'out', label: 'Out' };
const RECONNECTING: GamePlayerState = {
  kind: 'reconnecting',
  label: 'Reconnecting',
};

/** Seat 2 is to move; seat 3 is out and seat 4 reconnecting, when present. */
function stateOf(index: number): GamePlayerState | null {
  if (index === 2) return OUT;
  if (index === 3) return RECONNECTING;
  return null;
}

function Rail(props: { seats: readonly ExampleSeat[] }): JSX.Element {
  return (
    <GamePlayerRail aria-label="Other players">
      <For each={props.seats}>
        {(seat, index) => (
          <GamePlayerChip
            name={seat.name}
            avatar={exampleAvatar(seat, GAME_PLAYER_CHIP_AVATAR_SIZE)}
            swatch={seat.look}
            stat={{ label: 'Score', value: seat.score }}
            state={stateOf(index())}
            tags={index() === 0 ? <Badge label="Passed" /> : undefined}
            active={index() === 1}
            onPress={() => undefined}
          />
        )}
      </For>
    </GamePlayerRail>
  );
}

function OwnStrip(props: { active: boolean }): JSX.Element {
  return (
    <GamePlayerBar
      name="You"
      avatar={<Avatar you size={GAME_PLAYER_AVATAR_SIZE} />}
      swatch={{ color: 'player1', mark: '●' }}
      stat={{ label: 'Score', value: '18' }}
      active={props.active}
    />
  );
}

function OpponentStrip(): JSX.Element {
  const seat = exampleSeat(1);
  return (
    <GamePlayerBar
      name={seat.name}
      avatar={exampleAvatar(seat, GAME_PLAYER_AVATAR_SIZE)}
      swatch={seat.look}
      stat={{ label: 'Score', value: '21' }}
      state={RECONNECTING}
      onPress={() => undefined}
    />
  );
}

function Layouts(): JSX.Element {
  return (
    <>
      <ExampleSection title="One opponent: a strip above the board">
        <GameBoardStage
          others={<OpponentStrip />}
          turn={<GameTurnPill emphasis="yours" title="Your turn." />}
          own={<OwnStrip active />}
        >
          <ScreenExampleBoard />
        </GameBoardStage>
      </ExampleSection>
      <ExampleSection title="Rail of 3: active, Out">
        <Rail seats={exampleSeats(3)} />
      </ExampleSection>
      <ExampleSection title="Rail of 7: active, Out, Reconnecting, long names">
        <GameBoardStage
          others={<Rail seats={exampleSeats(7)} />}
          turn={<GameTurnPill title="Stockfish to move." />}
          own={<OwnStrip active={false} />}
        >
          <ScreenExampleBoard />
        </GameBoardStage>
      </ExampleSection>
      <ExampleSection title="Solo: the board and the turn only">
        <GameBoardStage turn={<GameTurnPill title="12 moves left." />}>
          <ScreenExampleBoard />
        </GameBoardStage>
      </ExampleSection>
    </>
  );
}

function Pills(): JSX.Element {
  return (
    <ExampleSection title="Turn pill: yours, neutral, outcome tones">
      <StackVertical gap="sm">
        <GameTurnPill
          emphasis="yours"
          title="Your turn."
          detail="Place a wall or move."
        />
        <GameTurnPill title="Erin to move." />
        <GameTurnPill tone="success" title="Ready to start." />
        <GameTurnPill
          tone="warning"
          title="Your clock is low."
          emphasis="yours"
        />
      </StackVertical>
    </ExampleSection>
  );
}

function Actions(): JSX.Element {
  const [tool, setTool] = createSignal('move');
  const toolItem = (id: string, label: string) => ({
    id,
    label,
    testId: `example-mode-${id}`,
    onPress: () => setTool(id),
    pressed: tool() === id,
  });
  return (
    <ExampleSection title="Action bar: tools with one pressed, a primary step">
      <GameActionBar
        aria-label="Actions"
        items={[
          toolItem('move', 'Move'),
          toolItem('h', 'Horizontal wall'),
          toolItem('v', 'Vertical wall'),
          {
            id: 'pass',
            label: 'Pass',
            testId: 'example-pass',
            onPress: () => undefined,
            emphasis: 'primary',
          },
        ]}
      >
        <Button title="Resign" intent="neutral" variant="outline" />
      </GameActionBar>
    </ExampleSection>
  );
}

function Watching(): JSX.Element {
  return (
    <ExampleSection title="Watching: the footer and the watcher count">
      <StackHorizontal gap="sm" align="center">
        <GameWatcherCount value={12_400} label="12,400 watching" />
      </StackHorizontal>
      <GameWatchingFooter
        title="You're watching"
        detail="Moves appear as they are played."
        action={<Button title="Sit here" size="sm" />}
      />
    </ExampleSection>
  );
}

/** Play: every way the table sits around the board. */
export default function GameFramePlayExample(): JSX.Element {
  return (
    <ExampleRoot>
      <SchemePreview>
        <Layouts />
        <Pills />
        <Actions />
        <Watching />
      </SchemePreview>
    </ExampleRoot>
  );
}
