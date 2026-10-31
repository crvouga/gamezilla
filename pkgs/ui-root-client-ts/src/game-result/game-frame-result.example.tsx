/** @jsxImportSource solid-js */

import {
  GameResultHeadline,
  type GameStandingRow,
  GameStandings,
  GameStatTiles,
} from '@pkgs/ui-root-client-ts/game-result';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import type { JSX } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';
import { ExampleSection } from '../../storybook/fixtures/example-section';
import {
  exampleAvatar,
  exampleSeats,
} from '../../storybook/fixtures/game-frame-example-data';
import { SchemePreview } from '../../storybook/fixtures/scheme-preview';

const STANDING_AVATAR = 32;

/** `count` players in seat order, the viewer second, every other one ready. */
function standings(count: number): readonly GameStandingRow[] {
  return exampleSeats(count).map((seat, index) => ({
    id: seat.id,
    place: index + 1,
    name: index === 1 ? 'You' : seat.name,
    avatar: exampleAvatar(seat, STANDING_AVATAR),
    score: seat.score,
    readiness:
      index % 2 === 0
        ? { label: 'Ready', ready: true }
        : { label: 'Not ready', ready: false },
    you: index === 1,
  }));
}

function TwoPlayers(): JSX.Element {
  return (
    <ExampleSection title="Two players: headline and standings">
      <StackVertical gap="lg">
        <GameResultHeadline
          title="You came 2nd"
          caption="Erin wins by 5 points."
        />
        <GameStandings
          aria-label="Standings"
          scoreLabel="Points"
          rows={standings(2)}
        />
      </StackVertical>
    </ExampleSection>
  );
}

function EightPlayers(): JSX.Element {
  return (
    <ExampleSection title="Eight players with readiness for a rematch">
      <StackVertical gap="lg">
        <GameResultHeadline
          title="Erin wins"
          caption="Host starts the rematch"
        />
        <GameStandings
          aria-label="Standings"
          scoreLabel="Points"
          rows={standings(8)}
        />
      </StackVertical>
    </ExampleSection>
  );
}

function Solo(): JSX.Element {
  return (
    <ExampleSection title="Solo: stat tiles">
      <StackVertical gap="lg">
        <GameResultHeadline title="Solved" />
        <GameStatTiles
          aria-label="Your run"
          tiles={[
            { id: 'moves', label: 'Moves', value: '42' },
            { id: 'pushes', label: 'Pushes', value: '17' },
            { id: 'time', label: 'Time', value: '3:08', detail: 'Best 2:51' },
          ]}
        />
      </StackVertical>
    </ExampleSection>
  );
}

/** Game over: the headline, standings for 2 and 8 players, and solo tiles. */
export default function GameFrameResultExample(): JSX.Element {
  return (
    <ExampleRoot>
      <SchemePreview>
        <TwoPlayers />
        <EightPlayers />
        <Solo />
      </SchemePreview>
    </ExampleRoot>
  );
}
