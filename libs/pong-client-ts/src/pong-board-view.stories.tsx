import {
  BOARD_CONTROLS_EXCLUDE,
  boardArgs,
  type GameTableStory,
  renderGameTable,
} from '@libs/game-session-client-ts/game-frame-table.example';
import { pongConfig } from '@libs/pong-shared-ts/pong-config';
import { pongPositionCodec } from '@libs/pong-shared-ts/pong-game';
import {
  initialPongState,
  type PongState,
} from '@libs/pong-shared-ts/pong-state';
import { createPongStep } from '@libs/pong-shared-ts/pong-step';
import { boardOnly } from '@pkgs/turn-game-shared-ts/game-frame';
import type { GameSimulationControls } from '@pkgs/turn-game-shared-ts/game-presentation';
import {
  type GameSide,
  TWO_PLAYER_SIDES,
} from '@pkgs/turn-game-shared-ts/game-rules';
import { fn } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { PongBoardView } from './pong-board-view';
import { pongGameClient } from './pong-game-client';

/**
 * A game to three points played for `ticks` with nobody moving a paddle:
 * the ball is served, and every rally ends at the left paddle's side.
 */
function court(ticks: number): string {
  const config = pongConfig({ targetScore: 3 });
  const step = createPongStep(config);
  let state: PongState = initialPongState(config, () => 0);
  for (let tick = 1; tick <= ticks; tick++)
    state = step(state, [], {
      tick,
      deltaMs: 1000 / config.tickRate,
      elapsedMs: (tick * 1000) / config.tickRate,
      random: () => 0.3,
    });
  return pongPositionCodec.encode(state);
}

/** The controls of a person playing `sides` from this device. */
function playing(
  sides: readonly GameSide[],
  overrides: Partial<GameSimulationControls> = {}
): GameSimulationControls {
  return {
    paused: false,
    stale: false,
    sides,
    onInput: fn(),
    onRelease: fn(),
    ...overrides,
  };
}

/** Pong's own presentation, its board the view (no sounds in a story). */
const presentation = {
  ...pongGameClient.presentation,
  frame: {
    ...pongGameClient.presentation.frame,
    createBoard: boardOnly(PongBoardView),
  },
};

const meta = {
  id: 'screens-games-pong-court',
  title: 'Screens/Games/Pong/Court',
  component: PongBoardView,
  tags: ['autodocs'],
  render: (args, context) =>
    renderGameTable(presentation, TWO_PLAYER_SIDES, args, context),
  parameters: {
    appRouter: true,
    controls: { exclude: [...BOARD_CONTROLS_EXCLUDE] },
    // Played in real time: no turns, so the record lists no moves.
    table: { turns: false } satisfies GameTableStory,
  },
  args: boardArgs(court(220), { simulation: playing(['white']) }),
} satisfies Meta<typeof PongBoardView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Before the first serve: the court counts down. */
export const Countdown: Story = { args: { position: court(0) } };

/** A rally under way: the person moves the left paddle by keys, drag or slider. */
export const Rally: Story = {};

/** Right has scored; the next serve counts down with the new score. */
export const ServeAfterPoint: Story = { args: { position: court(300) } };

/** Right leads by two, one point from the win. */
export const MatchPoint: Story = { args: { position: court(440) } };

/** A player is away: play pauses and the controls wait. */
export const Paused: Story = {
  args: { simulation: playing(['white'], { paused: true }) },
};

/** The connection dropped: the controls resume when the game returns. */
export const Reconnecting: Story = {
  args: { simulation: playing(['white'], { stale: true }) },
};

/** Two people on one device: a slider for each paddle. */
export const TwoPlayersOnOneDevice: Story = {
  args: { simulation: playing(['white', 'black']) },
};

/** A watcher sees the court and no controls. */
export const Watching: Story = {
  args: { simulation: undefined },
  parameters: { table: { viewer: null } },
};

/** Right reached three points: the court says who won and the controls stop. */
export const Finished: Story = {
  args: { position: court(543), simulation: playing(['white']) },
  parameters: {
    table: {
      ending: { winner: 'black', reason: 'score target' },
    } satisfies GameTableStory,
  },
};

/** A position this app cannot read says so, with the way back. */
export const Unreadable: Story = {
  args: { position: 'pong:not-a-position', simulation: undefined },
};
