import {
  BOARD_CONTROLS_EXCLUDE,
  boardArgs,
  type GameTableStory,
  renderGameTable,
} from '@libs/game-session-client-ts/game-frame-table.example';
import {
  encodeQuoridor,
  replayQuoridor,
} from '@libs/quoridor-shared-ts/quoridor';
import { QUORIDOR_SIDES } from '@libs/quoridor-shared-ts/quoridor-rules';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { QuoridorBoard } from './quoridor-board';
import { quoridorHillGameClient } from './quoridor-game-client';

/** The King of the Hill position after `actions`, South first, then clockwise. */
function hill(actions: readonly string[]): string {
  return encodeQuoridor(replayQuoridor('hill', actions));
}

/**
 * Every wall placed and South boxed in: no move and no wall is legal, so
 * South may only pass.
 */
const BLOCKED = [
  'e2',
  'a4',
  'e8',
  'i6',
  'e1',
  'b4',
  'e7',
  'i5',
  'e2',
  'c4',
  'f7',
  'i6',
  'a1h',
  'd4',
  'f6',
  'i5',
  'c7h',
  'd3',
  'f5',
  'a3h',
  'f7h',
  'e3',
  'f4',
  'c5h',
  'a7v',
  'd2v',
  'e4',
  'g3h',
  'g1h',
  'e2v',
  'd1h',
  'a5v',
];
/** South climbs to the hill while the others step away from it. */
const SOUTH_TAKES_THE_HILL = 'e2 a4 e8 i6 e3 a3 d8 i7 e4 a2 c8 i8 e5'.split(
  ' '
);

const meta = {
  id: 'screens-games-quoridor-hill',
  title: 'Screens/Games/Quoridor/King of the Hill',
  component: QuoridorBoard,
  tags: ['autodocs'],
  render: (args, context) =>
    renderGameTable(
      quoridorHillGameClient.presentation,
      QUORIDOR_SIDES,
      args,
      context
    ),
  parameters: {
    appRouter: true,
    controls: { exclude: [...BOARD_CONTROLS_EXCLUDE] },
    table: { turn: 'white' } satisfies GameTableStory,
  },
  args: boardArgs(hill([]), { interactive: true }),
} satisfies Meta<typeof QuoridorBoard>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Four pawns around the board, five walls each, all heading for e5. */
export const Opening: Story = {};

/** No move or wall is legal: pass is the first board action. */
export const MustPass: Story = {
  args: { position: hill(BLOCKED) },
  parameters: { table: { moves: BLOCKED } satisfies GameTableStory },
};

/** East is deciding while the others wait. */
export const WaitingForOthers: Story = {
  args: { position: hill(['e2', 'a4', 'e8']), interactive: false },
  parameters: { table: { turn: 'blue' } satisfies GameTableStory },
};

/** South reached the hill first and won outright. */
export const Won: Story = {
  args: { position: hill(SOUTH_TAKES_THE_HILL), interactive: false },
  parameters: {
    table: {
      ending: { winner: 'white', reason: 'hill reached' },
    } satisfies GameTableStory,
  },
};

/** West's view of the same game: placed behind the winner. */
export const Lost: Story = {
  args: {
    position: hill(SOUTH_TAKES_THE_HILL),
    interactive: false,
    orientation: 'black',
  },
  parameters: {
    table: {
      ending: { winner: 'white', reason: 'hill reached' },
    } satisfies GameTableStory,
  },
};
