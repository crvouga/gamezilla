import {
  boardArgs,
  type GameTableStory,
  renderGameTable,
} from '@libs/game-session-client-ts/game-frame-table.example';
import { LIGHT_CYCLES_SEATS } from '@libs/light-cycles-shared-ts/light-cycles-config';
import { lightCyclesPositionCodec } from '@libs/light-cycles-shared-ts/light-cycles-position';
import { boardOnly } from '@pkgs/turn-game-shared-ts/game-frame';
import type { GameBoardProps } from '@pkgs/turn-game-shared-ts/game-presentation';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { LightCyclesBoardView } from './light-cycles-board-view';
import {
  lightCyclesDuelClient,
  lightCyclesQuadClient,
  lightCyclesTrioClient,
} from './light-cycles-game-client';
import { lightCyclesMotion } from './light-cycles-motion.example';

function renderMotion(count: 2 | 3 | 4) {
  return (
    args: GameBoardProps,
    context: {
      canvasElement: HTMLElement;
      parameters: Readonly<Record<string, unknown>>;
    }
  ) => {
    const state = lightCyclesMotion(count, context.canvasElement);
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
          return lightCyclesPositionCodec(count).encode(state());
        },
      },
      context
    );
  };
}

const meta = {
  id: 'screens-games-light-cycles-motion',
  title: 'Screens/Games/Light Cycles/Sustained motion',
  component: LightCyclesBoardView,
  render: renderMotion(2),
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
export const Trio: Story = { render: renderMotion(3) };
/** Four hard bots stress all four distinct trail paths and moving heads. */
export const Quad: Story = { render: renderMotion(4) };
