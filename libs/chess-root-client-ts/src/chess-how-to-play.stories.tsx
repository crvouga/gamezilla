import { fn } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { withChessBoardContext } from './chess-board-story.example';
import { ChessHowToPlay } from './chess-how-to-play.example';

const meta = {
  id: 'screens-games-chess-how-to-play',
  title: 'Screens/Games/Chess/How to play',
  component: ChessHowToPlay,
  tags: ['autodocs'],
  decorators: [withChessBoardContext],
  parameters: {
    appRouter: true,
    controls: { exclude: ['choices', 'subtitle', 'place'] },
  },
  args: {
    title: 'Chess',
    tile: 'checkered',
    subtitle: 'Checkmate the king. Every piece moves its own way.',
    choices: [
      {
        screen: 'custom-game',
        title: 'Play with friends or bots',
        caption: 'Invite people in this space, or add bots',
      },
    ],
    onChoose: fn(),
    place: { screen: 'how-to-play' },
    onOpen: fn(),
    onBackToGames: fn(),
  },
} satisfies Meta<typeof ChessHowToPlay>;
export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Chess's rules, from the game's own client: every piece's move, the
 * knight, castling and en passant pictured on small still boards.
 */
export const Rules: Story = {};
