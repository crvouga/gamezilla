import { useArgs } from 'storybook/preview-api';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import {
  GameHomeScreenView,
  type GameMenuChoiceView,
} from './game-home-screen-view';

/** The shared choices of a two-player game named `name`. */
function sharedChoices(name: string): readonly GameMenuChoiceView[] {
  return [
    {
      screen: 'custom-game',
      title: 'Custom games',
      caption: 'With the people in this space, or bots',
    },
    {
      screen: 'multiplayer',
      title: 'Match making',
      caption: `Meet another ${name} player`,
    },
    {
      screen: 'history',
      title: 'History and stats',
      caption: 'Review your games, wins and draws',
    },
  ];
}

const CHOICES = sharedChoices('Connect Four');

const PUZZLE_CHOICES: readonly GameMenuChoiceView[] = [
  {
    screen: 'puzzle',
    title: 'Puzzle',
    caption: 'Solve rated puzzles and climb the ladder',
  },
  {
    screen: 'stats',
    title: 'Puzzle stats',
    caption: 'Puzzle rating trend and game log',
  },
  ...sharedChoices('Chess'),
  { screen: 'settings', title: 'Settings', caption: 'Board and pieces' },
];

const meta = {
  id: 'screens-game-home',
  title: 'Screens/Space/Game home/Home',
  component: GameHomeScreenView,
  tags: ['autodocs'],
  parameters: {
    appRouter: true,
    controls: { exclude: ['choices', 'subtitle', 'instructions'] },
  },
  args: {
    title: 'Connect Four',
    tile: 'discs',
    subtitle: 'Drop discs and line up four',
    instructions:
      'Take turns dropping a disc into a column. Four in a row, column or diagonal wins.',
    choices: CHOICES,
    onChoose: fn(),
    place: { screen: 'home' },
    onOpen: fn(),
  },
} satisfies Meta<typeof GameHomeScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A game with custom games, matchmaking and history; how to play is its last, quiet row. */
export const SharedChoices: Story = {};

/** A game offering puzzles and settings: its puzzle choices first, settings last. */
export const WithPuzzlesAndSettings: Story = {
  args: {
    title: 'Chess',
    tile: 'checkered',
    subtitle: 'The classic game of kings',
    instructions: undefined,
    choices: PUZZLE_CHOICES,
  },
};

/** A bigger game finds players rather than one opponent. */
export const ManyPlayers: Story = {
  args: {
    title: 'Hearts',
    tile: 'cards',
    subtitle: 'Avoid hearts and the queen of spades',
    choices: [
      {
        screen: 'custom-game',
        title: 'Custom games',
        caption: 'With the people in this space, or bots',
      },
      {
        screen: 'multiplayer',
        title: 'Match making',
        caption: 'Meet 3 other Hearts players',
      },
    ],
  },
};

/** A puzzle-only game: one choice, and no how to play when the game says nothing. */
export const OwnChoicesOnly: Story = {
  args: {
    title: 'Numberlink',
    tile: 'paths',
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
        title: 'Play with friends, family and bots of every level',
        caption:
          'With the people in this space, or bots, then agree the clock and the rules before anyone moves',
      },
      ...CHOICES.slice(1),
    ],
  },
};

/** Pressing a choice opens the screen it names. */
export const OpenChoice: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByText('Match making'));
    await expect(args.onChoose).toHaveBeenCalledWith('multiplayer');
  },
};

/** How to play is a row like any other: it opens the place behind the menu. */
export const OpenHowToPlay: Story = {
  parameters: { test: { restoreMocks: false } },
  render: (args) => {
    const [, updateArgs] = useArgs();
    return (
      <GameHomeScreenView
        {...args}
        onOpen={(place) => {
          args.onOpen(place);
          updateArgs({ place });
        }}
      />
    );
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByTestId('game-choice-how-to-play'));
    await expect(args.onOpen).toHaveBeenCalledWith({ screen: 'how-to-play' });
    await expect(
      await canvas.findByText(/Take turns dropping a disc/)
    ).toBeVisible();
  },
};

export const ClassicQuoridor: Story = {
  args: {
    title: 'Classic Quoridor',
    tile: 'walls',
    subtitle: 'Race your pawn across the board. Shape the path with walls.',
    instructions:
      'Move one square or place one wall each turn. The first to reach the opposite home row wins.',
    choices: [
      {
        screen: 'multiplayer',
        title: 'Match making',
        caption: 'Find players for your chosen mode',
      },
      ...CHOICES.filter((choice) => choice.screen !== 'multiplayer'),
    ],
  },
};
