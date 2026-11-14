import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import {
  CHESS_CHOICES,
  CHESS_RULES,
  CONNECT_FOUR_RULES,
  GameMenuStory,
  HEARTS_RULES,
  sharedChoices,
} from './game-menu-story.example';

const meta = {
  id: 'screens-games-menu-how-to-play',
  title: 'Screens/Games/Menu/How to play',
  component: GameMenuStory,
  tags: ['autodocs'],
  parameters: {
    appRouter: true,
    controls: { exclude: ['choices', 'subtitle', 'instructions', 'place'] },
  },
  args: {
    title: 'Connect Four',
    tile: 'discs',
    subtitle: 'Drop a disc. Connect four. Plan your next turn.',
    instructions: CONNECT_FOUR_RULES,
    choices: sharedChoices('Connect Four'),
    onChoose: fn(),
    place: { screen: 'how-to-play' },
    onOpen: fn(),
    onBackToGames: fn(),
  },
} satisfies Meta<typeof GameMenuStory>;
export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The game's rules in numbered parts (the goal, a turn, the end), then the
 * way on: play the main way in, or back to the menu.
 */
export const Rules: Story = {};

/** A game with many rules: each part a short heading over a few lines. */
export const LongRules: Story = {
  args: {
    title: 'Hearts',
    tile: 'cards',
    subtitle: 'Duck the tricks. Dodge the queen. Lowest wins.',
    instructions: HEARTS_RULES,
    choices: sharedChoices('Hearts', 4).slice(0, 2),
  },
};

/** Chess's rules: the moves of every piece, its special moves, the end. */
export const ChessRules: Story = {
  args: {
    title: 'Chess',
    tile: 'checkered',
    subtitle: 'Checkmate the king. Every piece moves its own way.',
    instructions: CHESS_RULES,
    choices: CHESS_CHOICES,
  },
};

/** From the rules, one press starts the main way to play. */
export const PlayFromRules: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByTestId('game-how-to-play-play'));
    await expect(args.onChoose).toHaveBeenCalledWith('custom-game');
  },
};

/** The rules' own Back button returns to the menu. */
export const BackFromRules: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByTestId('game-how-to-play-back'));
    await expect(
      await canvas.findByTestId('game-choice-how-to-play')
    ).toBeVisible();
  },
};
