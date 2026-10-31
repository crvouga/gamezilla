/** @jsxImportSource solid-js */

import { Badge } from '@pkgs/ui-root-client-ts/badge';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { GameOptionField } from '@pkgs/ui-root-client-ts/game-option-field';
import {
  GAME_PLAYER_AVATAR_SIZE,
  GamePlayerBar,
} from '@pkgs/ui-root-client-ts/game-player-bar';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { createSignal, For, type JSX, Show } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';
import { ExampleSection } from '../../storybook/fixtures/example-section';
import {
  type ExampleSeat,
  exampleAvatar,
  exampleSeats,
} from '../../storybook/fixtures/game-frame-example-data';
import { SchemePreview } from '../../storybook/fixtures/scheme-preview';

function SetupSeat(props: { seat: ExampleSeat }): JSX.Element {
  const open = (): boolean => props.seat.kind === 'emptySeat';
  return (
    <GamePlayerBar
      name={props.seat.name}
      avatar={exampleAvatar(props.seat, GAME_PLAYER_AVATAR_SIZE)}
      swatch={props.seat.look}
      tags={
        <Show
          when={!open()}
          fallback={<Badge intent="neutral" label="Waiting" />}
        >
          <Badge intent="success" label="Ready" />
        </Show>
      }
    >
      <Show when={open()}>
        <Button title="Sit here" size="sm" />
      </Show>
    </GamePlayerBar>
  );
}

function SeatList(props: { count: number }): JSX.Element {
  return (
    <ExampleSection
      title={`${props.count} seat${props.count === 1 ? '' : 's'}`}
    >
      <StackVertical gap="xs">
        <For each={exampleSeats(props.count)}>
          {(seat) => <SetupSeat seat={seat} />}
        </For>
      </StackVertical>
    </ExampleSection>
  );
}

const BOARDS = [
  { value: '7', label: '7 × 7' },
  { value: '9', label: '9 × 9' },
  { value: '11', label: '11 × 11' },
];

function OptionFields(): JSX.Element {
  const [board, setBoard] = createSignal('9');
  const [points, setPoints] = createSignal(11);
  return (
    <ExampleSection title="Options: choice, count, read-only">
      <StackVertical gap="md">
        <GameOptionField
          kind="choice"
          label="Board"
          options={BOARDS}
          value={board()}
          onChange={setBoard}
        />
        <GameOptionField
          kind="count"
          label="Points to win"
          value={points()}
          min={1}
          max={99}
          onChange={setPoints}
          message={{ text: 'From 1 to 99' }}
        />
        <GameOptionField
          kind="count"
          label="Rounds"
          value={0}
          min={0}
          max={9}
          onChange={() => undefined}
          message={{ text: 'Play at least one round.', tone: 'error' }}
        />
        <GameOptionField
          kind="choice"
          label="Board"
          options={BOARDS}
          value={board()}
          onChange={setBoard}
          readOnly
        />
        <GameOptionField
          kind="count"
          label="Points to win"
          value={points()}
          min={1}
          max={99}
          onChange={setPoints}
          readOnly
        />
      </StackVertical>
    </ExampleSection>
  );
}

/** Setup: seat lists of 1, 2, 4 and 8 seats, and the option fields. */
export default function GameFrameSetupExample(): JSX.Element {
  return (
    <ExampleRoot>
      <SchemePreview>
        <For each={[1, 2, 4, 8]}>{(count) => <SeatList count={count} />}</For>
        <OptionFields />
      </SchemePreview>
    </ExampleRoot>
  );
}
