import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { FriendsArt, HistoryArt, MatchmakingArt } from '../illustration/index';
import { GameMenuScreen } from './index';

const meta = {
  id: 'templates-game-menu',
  title: 'Templates/Games/GameMenuScreen',
  component: GameMenuScreen,
  tags: ['autodocs'],
  parameters: { appRouter: true, controls: { exclude: ['choices'] } },
  args: {
    screenId: 'game-home',
    title: 'Connect Four',
    motif: 'discs',
    subtitle: 'Drop discs and line up four',
    choices: [
      {
        key: 'multiplayer',
        title: 'Find an opponent',
        caption: 'Meet another Connect Four player',
        icon: MatchmakingArt,
        dataSet: { testid: 'choice-multiplayer' },
        onClick: fn(),
      },
      {
        key: 'game-session',
        title: 'Play with friends or bots',
        caption: 'With the people in this space, or bots',
        icon: FriendsArt,
        dataSet: { testid: 'choice-game-session' },
        onClick: fn(),
      },
      {
        key: 'history',
        title: 'History and stats',
        caption: 'Review your games, wins and draws',
        icon: HistoryArt,
        emphasis: 'quiet',
        dataSet: { testid: 'choice-history' },
        onClick: fn(),
      },
    ],
  },
} satisfies Meta<typeof GameMenuScreen>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The hero block, the first way to play as one primary control, the other ways as rows, history in the same list. */
export const Default: Story = {};

/** Choosing the primary control opens what it names. */
export const ChoosePrimary: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByTestId('choice-multiplayer'));
    await expect(args.choices[0]?.onClick).toHaveBeenCalled();
  },
};

/** Choosing a row opens what it names. */
export const ChooseARow: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByTestId('choice-game-session'));
    await expect(args.choices[1]?.onClick).toHaveBeenCalled();
  },
};

/** History opens directly from the list. */
export const OpenHistory: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByTestId('choice-history'));
    await expect(args.choices[2]?.onClick).toHaveBeenCalled();
  },
};
