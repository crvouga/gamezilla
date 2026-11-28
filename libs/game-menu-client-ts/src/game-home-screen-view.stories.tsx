import { useArgs } from 'storybook/preview-api';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import {
  GameHomeScreenView,
  type GameHomeScreenViewProps,
  type GameMenuChoiceView,
} from './game-home-screen-view';
import { storyGame } from './game-menu-catalog.example';

/** The shared choices of a two-player game named `name`. */
function sharedChoices(name: string): readonly GameMenuChoiceView[] {
  return [
    {
      screen: 'multiplayer',
      title: 'Matchmaking',
      caption: `Meet another ${name} player`,
    },
    {
      screen: 'vs-human',
      title: 'Play a Friend',
      caption: 'Play the people in this space',
    },
    {
      screen: 'vs-bot',
      title: 'Play Bots',
      caption: 'Play on your own, against a bot',
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
  ...sharedChoices('Chess').slice(0, 2),
  {
    screen: 'puzzle',
    title: 'Puzzle',
    caption: 'Solve rated puzzles and climb the ladder',
  },
  {
    screen: 'history',
    title: 'History and stats',
    caption: 'Your games and puzzle stats',
  },
  { screen: 'settings', title: 'Settings', caption: 'Board and pieces' },
];

const meta = {
  id: 'screens-game-home',
  title: 'Screens/Space/Game home/Home',
  component: GameHomeScreenView,
  tags: ['autodocs'],
  parameters: {
    appRouter: true,
    catalogLesson: true,
    controls: { exclude: ['choices', 'subtitle', 'lesson'] },
  },
  render: (args, context) => (
    <GameHomeScreenView
      {...args}
      lesson={storyGame(context.loaded, { tile: args.tile }).lesson}
    />
  ),
  args: {
    title: 'Connect Four',
    tile: 'discs',
    subtitle: 'Drop discs and line up four',
    choices: CHOICES,
    onChoose: fn(),
    place: { screen: 'home' },
    onOpen: fn(),
  },
} satisfies Meta<GameHomeScreenViewProps>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Matchmaking leads as the primary control, game sessions is a row; history and how to play wait behind More. */
export const SharedChoices: Story = {};

/** A game offering puzzles and settings: matchmaking leads, puzzles stay a row, settings wait behind More. */
export const WithPuzzlesAndSettings: Story = {
  parameters: {
    storyRoute: {
      pathname: '/space/story-room',
      tab: false,
      spaceBody: 'shell',
      spaceTitle: 'Chess',
    },
  },
  args: {
    title: 'Chess',
    tile: 'checkered',
    subtitle: 'The classic game of kings',
    choices: PUZZLE_CHOICES,
  },
};

/** A bigger game finds players rather than one opponent; with no quiet choice but how to play, More holds just that. */
export const ManyPlayers: Story = {
  args: {
    title: 'Hearts',
    tile: 'cards',
    subtitle: 'Avoid hearts and the queen of spades',
    choices: [
      {
        screen: 'multiplayer',
        title: 'Matchmaking',
        caption: 'Meet 3 other Hearts players',
      },
      {
        screen: 'vs-human',
        title: 'Play a Friend',
        caption: 'Play the people in this space',
      },
      {
        screen: 'vs-bot',
        title: 'Play Bots',
        caption: 'Play on your own, against bots',
      },
    ],
  },
};

/** A puzzle-only game: the puzzle library is the primary control, its lesson behind More. */
export const OwnChoicesOnly: Story = {
  args: {
    title: 'Numberlink',
    tile: 'paths',
    subtitle: 'Connect every pair of numbers',

    choices: [
      {
        screen: 'puzzle-library',
        title: 'Puzzles and packs',
        caption: 'Play, continue saved attempts, or create your own',
      },
    ],
  },
};

/** Long names and captions wrap inside the primary control and the rows. */
export const LongContent: Story = {
  args: {
    title: 'Connect Four: the extended tournament edition',
    choices: [
      {
        screen: 'multiplayer',
        title: 'Find an opponent among friends, family and bots of every level',
        caption:
          'With the people in this space, or bots, then agree the clock and the rules before anyone moves',
      },
      ...CHOICES.slice(1),
    ],
  },
};

/** Pressing the primary control opens the screen it names. */
export const OpenChoice: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByText('Matchmaking'));
    await expect(args.onChoose).toHaveBeenCalledWith('multiplayer');
  },
};

/** More starts closed; opening it shows the quiet choices and keeps the primary control in place. */
export const OpenMore: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const more = await canvas.findByTestId('game-choices-more');
    await expect(more).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(more);
    await expect(more).toHaveAttribute('aria-expanded', 'true');
    await userEvent.click(await canvas.findByTestId('game-choice-history'));
    await expect(args.onChoose).toHaveBeenCalledWith('history');
  },
};

/** More opens in place; its how to play row opens the place behind the menu. */
export const OpenHowToPlay: Story = {
  parameters: { test: { restoreMocks: false } },
  render: (args, context) => {
    const [, updateArgs] = useArgs();
    return (
      <GameHomeScreenView
        {...args}
        lesson={storyGame(context.loaded, { tile: args.tile }).lesson}
        onOpen={(place) => {
          args.onOpen(place);
          updateArgs({ place });
        }}
      />
    );
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByTestId('game-choices-more'));
    await userEvent.click(await canvas.findByTestId('game-choice-how-to-play'));
    await expect(args.onOpen).toHaveBeenCalledWith({ screen: 'how-to-play' });
    await expect(await canvas.findByTestId('practice-prompt')).toBeVisible();
  },
};

export const ClassicQuoridor: Story = {
  parameters: {
    storyRoute: {
      pathname: '/space/story-room',
      tab: false,
      spaceBody: 'shell',
      spaceTitle: 'Classic Quoridor',
    },
  },
  args: {
    title: 'Classic Quoridor',
    tile: 'walls',
    subtitle: 'Race your pawn across the board. Shape the path with walls.',
    choices: [
      {
        screen: 'multiplayer',
        title: 'Matchmaking',
        caption: 'Find players for your chosen mode',
      },
      ...CHOICES.filter((choice) => choice.screen !== 'multiplayer'),
    ],
  },
};
