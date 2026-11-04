import {
  BOARD_CONTROLS_EXCLUDE,
  boardArgs,
  type GameTableStory,
  renderGameTable,
} from '@libs/game-session-client-ts/game-frame-table.example';
import {
  LIGHT_CYCLES_SEATS,
  lightCyclesConfig,
} from '@libs/light-cycles-shared-ts/light-cycles-config';
import { lightCyclesPositionCodec } from '@libs/light-cycles-shared-ts/light-cycles-position';
import {
  initialLightCyclesState,
  type LightCyclesState,
} from '@libs/light-cycles-shared-ts/light-cycles-state';
import { createLightCyclesStep } from '@libs/light-cycles-shared-ts/light-cycles-step';
import { boardOnly } from '@pkgs/turn-game-shared-ts/game-frame';
import type { GameSimulationControls } from '@pkgs/turn-game-shared-ts/game-presentation';
import type { GameSide } from '@pkgs/turn-game-shared-ts/game-rules';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { LightCyclesBoardView } from './light-cycles-board-view';
import { lightCyclesTrioClient } from './light-cycles-game-client';

const TRIO = LIGHT_CYCLES_SEATS[3];
const codec = lightCyclesPositionCodec(3);

/**
 * A three-rider round played for `ticks` with nobody steering (each rider
 * rides straight from its spawn), first to `targetScore` round wins.
 */
function trio(ticks: number, targetScore = 3): string {
  const config = lightCyclesConfig({ targetScore });
  const step = createLightCyclesStep(config);
  let state: LightCyclesState = initialLightCyclesState(config, TRIO);
  for (let tick = 1; tick <= ticks; tick++)
    state = step(state, [], {
      tick,
      deltaMs: 1000 / config.tickRate,
      elapsedMs: (tick * 1000) / config.tickRate,
      random: () => 0,
    });
  return codec.encode(state);
}

/** The controls of a person riding `sides` from this device. */
function riding(
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

/** The countdown before the first round: riders on their spawns. */
const COUNTDOWN = trio(0);
/** Every rider riding straight across the arena. */
const RUNNING = trio(120);
/** Nova has crashed into a trail; Comet and Ember still ride. */
const CRASHED = trio(140);
/** Ember outlasted the others and takes the round. */
const ROUND_OVER = trio(153);
/** The same round, first to one round win, ends the game. */
const COMPLETED = trio(153, 1);

/** The trio's own presentation, its board the view (no sounds in a story). */
const presentation = {
  ...lightCyclesTrioClient.presentation,
  frame: {
    ...lightCyclesTrioClient.presentation.frame,
    createBoard: boardOnly(LightCyclesBoardView),
  },
};

const meta = {
  id: 'screens-games-light-cycles-arena',
  title: 'Screens/Games/Light Cycles/Arena',
  component: LightCyclesBoardView,
  tags: ['autodocs'],
  render: (args, context) => renderGameTable(presentation, TRIO, args, context),
  parameters: {
    appRouter: true,
    controls: { exclude: [...BOARD_CONTROLS_EXCLUDE] },
  },
  args: boardArgs(RUNNING, { simulation: riding(['white']) }),
} satisfies Meta<typeof LightCyclesBoardView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Before the round: the count down, and a turn chosen now applies on the first step. */
export const Countdown: Story = { args: { position: COUNTDOWN } };

/** The round under way: the person steers Comet with keys, swipes or the pad. */
export const Riding: Story = {};

/** The person's rider has crashed: they watch until the next round. */
export const Crashed: Story = {
  args: { position: CRASHED, orientation: 'red', simulation: riding(['red']) },
};

/** The round's winner shows over the arena until the next round starts. */
export const RoundOver: Story = { args: { position: ROUND_OVER } };

/** The game is won: nobody steers, and the result shows. */
export const Finished: Story = {
  args: { position: COMPLETED, simulation: undefined },
  parameters: {
    table: {
      ending: { winner: 'black', reason: 'target score' },
    } satisfies GameTableStory,
  },
};

/** The connection dropped: steering waits for the game to return. */
export const Reconnecting: Story = {
  args: { simulation: riding(['white'], { stale: true }) },
};

/** The person rides from another of their devices and may take it over here. */
export const RidingElsewhere: Story = {
  args: {
    simulation: riding([], { elsewhere: ['white'], claim: fn() }),
  },
};

/** A watcher sees the arena and no pads. */
export const Watching: Story = {
  args: { simulation: undefined },
  parameters: { table: { viewer: null } },
};

/** Two riders on one device: one pad each. */
export const TwoRidersOnOneDevice: Story = {
  args: { simulation: riding(['white', 'black']) },
};

/** A position this app cannot read says so, with the way back. */
export const Unreadable: Story = {
  args: { position: 'light-cycles-3:not-a-position', simulation: undefined },
};

/** A pad press steers the person's rider, fenced to the round. */
export const SteerUp: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByTestId('custom-game-board-white-pad-up')
    );
    await expect(args.simulation?.onInput).toHaveBeenCalledWith('white', {
      round: 1,
      heading: 'up',
    });
  },
};
