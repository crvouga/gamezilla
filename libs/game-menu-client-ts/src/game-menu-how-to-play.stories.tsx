import { fn } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { GameMenuScreenView } from './game-menu-screen-view';

const meta = {
  id: 'screens-games-menu-how-to-play',
  title: 'Screens/Games/Menu/How to play',
  component: GameMenuScreenView,
  tags: ['autodocs'],
  parameters: {
    appRouter: true,
    controls: { exclude: ['choices', 'subtitle', 'instructions', 'place'] },
  },
  args: {
    title: 'Connect Four',
    tile: 'discs',
    subtitle: 'Drop discs and line up four',
    instructions:
      'Take turns dropping a disc into a column. Four in a row, column or diagonal wins.',
    choices: [],
    onChoose: fn(),
    place: { screen: 'how-to-play' },
    onOpen: fn(),
  },
} satisfies Meta<typeof GameMenuScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The game's own words on how it is played, on a screen of their own. */
export const Rules: Story = {};

/** A game with many rules reads as one column at a reading measure. */
export const LongRules: Story = {
  args: {
    title: 'Hearts',
    tile: 'cards',
    subtitle: 'Avoid hearts and the queen of spades',
    instructions:
      "Four players each get thirteen cards. Before each deal's play, everyone secretly passes three cards: to the left, then right, then across, then not at all, and again. Whoever holds the two of clubs leads it. Follow the suit led if you can; the highest card of that suit takes the trick and leads next. Hearts and the queen of spades can't be played on the first trick unless you hold nothing else, and hearts can't be led until one has been played, unless you hold only hearts. Each heart you take costs a point and the queen of spades thirteen, unless you take them all: then everyone else gets twenty-six. When a score reaches 100 at the end of a deal, the lowest score wins.",
  },
};
