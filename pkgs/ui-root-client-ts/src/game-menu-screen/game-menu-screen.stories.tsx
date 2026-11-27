import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { HistoryIcon, SearchIcon, UsersIcon } from '../icons';
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
        key: 'custom-game',
        title: 'Play with friends or bots',
        caption: 'With the people in this space, or bots',
        icon: UsersIcon,
        dataSet: { testid: 'choice-custom-game' },
        onClick: fn(),
      },
      {
        key: 'multiplayer',
        title: 'Find an opponent',
        caption: 'Meet another Connect Four player',
        icon: SearchIcon,
        onClick: fn(),
      },
      {
        key: 'history',
        title: 'History and stats',
        caption: 'Review your games, wins and draws',
        icon: HistoryIcon,
        emphasis: 'quiet',
        onClick: fn(),
      },
    ],
  },
} satisfies Meta<typeof GameMenuScreen>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The hero block, then each way into the game as a large tile; none leads. */
export const Default: Story = {};

/** Choosing a tile opens what it names. */
export const ChooseAChoice: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByTestId('choice-custom-game'));
    await expect(args.choices[0]?.onClick).toHaveBeenCalled();
  },
};
