import {
  boardArgs,
  type GameTableStory,
  renderGameTable,
} from '@libs/game-session-client-ts/game-frame-table.example';
import { LIGHT_CYCLES_SEATS } from '@libs/light-cycles-shared-ts/light-cycles-config';
import { lightCyclesPositionCodec } from '@libs/light-cycles-shared-ts/light-cycles-position';
import { boardOnly } from '@pkgs/turn-game-shared-ts/game-frame';
import type { GameBoardProps } from '@pkgs/turn-game-shared-ts/game-presentation';
import { createMemo } from 'solid-js';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { LightCyclesBoardView } from './light-cycles-board-view';
import {
  lightCyclesDuelClient,
  lightCyclesQuadClient,
  lightCyclesTrioClient,
} from './light-cycles-game-client';
import { lightCyclesMotion } from './light-cycles-motion.example';

type MotionContext = {
  canvasElement: HTMLElement;
  parameters: Readonly<Record<string, unknown>>;
};

/** The production game table, its board advancing `count` riders on virtual time. */
function renderMotion(
  count: 2 | 3 | 4,
  args: GameBoardProps,
  context: MotionContext
) {
  const state = lightCyclesMotion(count, context.canvasElement);
  const codec = lightCyclesPositionCodec(count);
  const position = createMemo(() => codec.encode(state()));
  const client =
    count === 2
      ? lightCyclesDuelClient
      : count === 3
        ? lightCyclesTrioClient
        : lightCyclesQuadClient;
  return renderGameTable(
    {
      ...client.presentation,
      frame: {
        ...client.presentation.frame,
        createBoard: boardOnly(LightCyclesBoardView),
      },
    },
    LIGHT_CYCLES_SEATS[count],
    {
      ...args,
      get position() {
        return position();
      },
    },
    context
  );
}

const meta = {
  id: 'screens-games-light-cycles-motion',
  title: 'Screens/Games/Light Cycles/Sustained motion',
  component: LightCyclesBoardView,
  render: (args, context) => renderMotion(2, args, context),
  parameters: {
    appRouter: true,
    table: { turns: false, viewer: null } satisfies GameTableStory,
  },
  args: boardArgs('', { simulation: undefined }),
} satisfies Meta<typeof LightCyclesBoardView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A duel with accumulated trails, advanced through the standard virtual-time control. */
export const Duel: Story = {};
/** Three hard bots continue the production simulation through dense paths and round changes. */
export const Trio: Story = {
  render: (args, context) => renderMotion(3, args, context),
};
/** Four hard bots stress all four distinct trail paths and moving heads. */
export const Quad: Story = {
  render: (args, context) => renderMotion(4, args, context),
};
