import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import {
  CHESS_CHOICES,
  CHESS_RULES,
  CONNECT_FOUR_RULES,
  GameMenuStory,
  HEARTS_RULES,
  NUMBERLINK_RULES,
  sharedChoices,
} from './game-menu-story.example';

const meta = {
  id: 'screens-games-menu',
  title: 'Screens/Games/Menu/Game menu',
  component: GameMenuStory,
  tags: ['autodocs'],
  parameters: {
    appRouter: true,
    controls: { exclude: ['choices', 'subtitle', 'instructions'] },
  },
  args: {
    title: 'Connect Four',
    tile: 'discs',
    subtitle: 'Drop a disc. Connect four. Plan your next turn.',
    instructions: CONNECT_FOUR_RULES,
    choices: sharedChoices('Connect Four'),
    onChoose: fn(),
    place: { screen: 'menu' },
    onOpen: fn(),
    onBackToGames: fn(),
  },
} satisfies Meta<typeof GameMenuStory>;
export default meta;
type Story = StoryObj<typeof meta>;

/**
 * A two-player game: its ways to play (friends or bots first, then finding
 * an opponent) apart from its history, with how to play under its name.
 */
export const SharedChoices: Story = {};

/** Chess: three ways to play (puzzles among them), then its looks back and settings. */
export const WithPuzzlesAndSettings: Story = {
  args: {
    title: 'Chess',
    tile: 'checkered',
    subtitle: 'Checkmate the king. Every piece moves its own way.',
    instructions: CHESS_RULES,
    choices: CHESS_CHOICES,
  },
};

/** A bigger game finds players rather than one opponent. */
export const ManyPlayers: Story = {
  args: {
    title: 'Hearts',
    tile: 'cards',
    subtitle: 'Duck the tricks. Dodge the queen. Lowest wins.',
    instructions: HEARTS_RULES,
    choices: sharedChoices('Hearts', 4).slice(0, 2),
  },
};

/** A puzzle-only game: one way in, unnamed, and how to play under its name. */
export const OwnChoicesOnly: Story = {
  args: {
    title: 'Numberlink',
    tile: 'paths',
    subtitle: 'Connect each matching pair and fill the board.',
    instructions: NUMBERLINK_RULES,
    choices: [
      {
        screen: 'puzzle-library',
        title: 'Puzzles and packs',
        caption: 'Play, continue saved attempts, or create your own',
      },
    ],
  },
};

/** A game that says nothing on how it is played offers no rules. */
export const WithoutRules: Story = {
  args: { instructions: undefined },
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
      ...sharedChoices('Connect Four').slice(1),
    ],
  },
};

/** Pressing a way to play opens the screen it names. */
export const OpenChoice: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByText('Find an opponent'));
    await expect(args.onChoose).toHaveBeenCalledWith('multiplayer');
  },
};

/**
 * How to play, under the game's name, opens the rules; the bar's Back then
 * names the game and returns to the menu.
 */
export const OpenHowToPlay: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByTestId('game-choice-how-to-play'));
    await expect(args.onOpen).toHaveBeenCalledWith({ screen: 'how-to-play' });
    await expect(
      await canvas.findByText(/Line up four of your own/)
    ).toBeVisible();
    await userEvent.click(
      await canvas.findByRole('button', { name: /Connect Four/ })
    );
    await expect(
      await canvas.findByTestId('game-choice-custom-game')
    ).toBeVisible();
  },
};
