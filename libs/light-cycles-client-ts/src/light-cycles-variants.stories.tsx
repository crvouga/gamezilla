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
import { initialLightCyclesState } from '@libs/light-cycles-shared-ts/light-cycles-state';
import { createLightCyclesStep } from '@libs/light-cycles-shared-ts/light-cycles-step';
import { boardOnly } from '@pkgs/turn-game-shared-ts/game-frame';
import type { GameBoardProps } from '@pkgs/turn-game-shared-ts/game-presentation';
import { fn } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { LightCyclesBoardView } from './light-cycles-board-view';
import {
  lightCyclesDuelClient,
  lightCyclesQuadClient,
} from './light-cycles-game-client';

/** Reach a mode's countdown or opening trails through its production simulation. */
function position(riders: 2 | 4, ticks: number): string {
  const config = lightCyclesConfig();
  const step = createLightCyclesStep(config);
  let state = initialLightCyclesState(config, LIGHT_CYCLES_SEATS[riders]);
  for (let tick = 1; tick <= ticks; tick++)
    state = step(state, [], {
      tick,
      deltaMs: 1000 / config.tickRate,
      elapsedMs: (tick * 1000) / config.tickRate,
      random: () => 0,
    });
  return lightCyclesPositionCodec(riders).encode(state);
}

/** Each variant supplies its actual title, seats and frame around the silent board. */
function renderMode(riders: 2 | 4) {
  const client = riders === 2 ? lightCyclesDuelClient : lightCyclesQuadClient;
  const presentation = {
    ...client.presentation,
    frame: {
      ...client.presentation.frame,
      createBoard: boardOnly(LightCyclesBoardView),
    },
  };
  return (
    args: GameBoardProps,
    context: { readonly parameters: Readonly<Record<string, unknown>> }
  ) => renderGameTable(presentation, LIGHT_CYCLES_SEATS[riders], args, context);
}

const meta = {
  id: 'screens-games-light-cycles-variants',
  title: 'Screens/Games/Light Cycles/Duel and Quad',
  component: LightCyclesBoardView,
  tags: ['autodocs'],
  render: renderMode(2),
  parameters: {
    appRouter: true,
    controls: { exclude: [...BOARD_CONTROLS_EXCLUDE] },
    table: { turns: false } satisfies GameTableStory,
  },
  args: boardArgs(position(2, 120), {
    simulation: {
      paused: false,
      stale: false,
      sides: ['white'],
      onInput: fn(),
      onRelease: fn(),
    },
  }),
} satisfies Meta<typeof LightCyclesBoardView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Two riders wait at their own starting cells before the first round. */
export const DuelCountdown: Story = { args: { position: position(2, 0) } };

/** The two-rider game shows its own seats, title and opening trails. */
export const DuelRiding: Story = {};

/** Watching a duel keeps both riders visible without personal steering controls. */
export const DuelWatching: Story = {
  args: { simulation: undefined },
  parameters: { table: { viewer: null } },
};

/** Four riders wait at distinct starting cells, with all four seats visible. */
export const QuadCountdown: Story = {
  render: renderMode(4),
  args: { position: position(4, 0) },
};

/** The four-rider game retains the whole arena and all seat labels. */
export const QuadRiding: Story = {
  render: renderMode(4),
  args: { position: position(4, 120) },
};

/** A watcher follows all four riders without being offered a steering pad. */
export const QuadWatching: Story = {
  render: renderMode(4),
  args: { position: position(4, 120), simulation: undefined },
  parameters: { table: { viewer: null } },
};
