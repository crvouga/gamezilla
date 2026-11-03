import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import {
  type GameMenuChoiceView,
  GameMenuScreenView,
} from './game-menu-screen-view';

const CHOICES: readonly GameMenuChoiceView[] = [
  {
    screen: 'custom-game',
    title: 'Custom games',
    caption: 'Choose people or bots for each of the 2 places',
  },
  {
    screen: 'multiplayer',
    title: 'Find an opponent',
    caption: 'Meet another Connect Four player',
  },
  {
    screen: 'history',
    title: 'History and stats',
    caption: 'Review your games, wins and draws',
  },
];

const PUZZLE_CHOICES: readonly GameMenuChoiceView[] = [
  {
    screen: 'puzzle',
    title: 'Puzzle',
    caption: 'Solve rated puzzles and climb the ladder',
  },
  {
    screen: 'puzzle-stats',
    title: 'Puzzle stats',
    caption: 'Puzzle rating trend and game log',
  },
  ...CHOICES,
  { screen: 'settings', title: 'Settings', caption: 'Board and pieces' },
];

const meta = {
  id: 'screens-games-menu',
  title: 'Screens/Games/Menu/Game menu',
  component: GameMenuScreenView,
  tags: ['autodocs'],
  parameters: {
    appRouter: true,
    controls: { exclude: ['choices', 'subtitle', 'instructions'] },
  },
  args: {
    title: 'Connect Four',
    subtitle: 'Drop discs and line up four',
    instructions:
      'Take turns dropping a disc into a column. Four in a row, column or diagonal wins.',
    choices: CHOICES,
    onChoose: fn(),
  },
} satisfies Meta<typeof GameMenuScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A game with custom games, matchmaking and history, then how to play. */
export const SharedChoices: Story = {};

/** A game offering puzzles and settings: its puzzle choices first, settings last. */
export const WithPuzzlesAndSettings: Story = {
  args: {
    title: 'Chess',
    subtitle: 'The classic game of kings',
    instructions: undefined,
    choices: PUZZLE_CHOICES,
  },
};

/** A bigger game finds players rather than one opponent. */
export const ManyPlayers: Story = {
  args: {
    title: 'Hearts',
    subtitle: 'Avoid hearts and the queen of spades',
    choices: [
      {
        screen: 'custom-game',
        title: 'Custom games',
        caption: 'Choose people or bots for each of the 4 places',
      },
      {
        screen: 'multiplayer',
        title: 'Find players',
        caption: 'Meet 3 other Hearts players',
      },
    ],
  },
};

/** A game with only its own choices and no instructions. */
export const OwnChoicesOnly: Story = {
  args: {
    title: 'Numberlink',
    subtitle: 'Connect every pair of numbers',
    instructions: undefined,
    choices: [
      {
        screen: 'puzzle-library',
        title: 'Puzzles and packs',
        caption: 'Play, continue saved attempts, or create your own',
      },
    ],
  },
};

/** Long names and captions wrap inside their rows. */
export const LongContent: Story = {
  args: {
    title: 'Connect Four: the extended tournament edition',
    choices: [
      {
        screen: 'custom-game',
        title: 'Custom games with friends, family and bots of every level',
        caption:
          'Choose people or bots for each of the 2 places, then agree the clock and the rules before anyone moves',
      },
      ...CHOICES.slice(1),
    ],
  },
};

/** Pressing a choice opens the screen it names. */
export const OpenChoice: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByText('Find an opponent'));
    await expect(args.onChoose).toHaveBeenCalledWith('multiplayer');
  },
};
