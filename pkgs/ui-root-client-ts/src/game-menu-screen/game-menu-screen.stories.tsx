import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { HistoryIcon, SearchIcon, UsersIcon } from '../icons';
import { GameMenuScreen } from './index';

const meta = {
  id: 'templates-game-menu',
  title: 'Templates/Game menu',
  component: GameMenuScreen,
  tags: ['autodocs'],
  parameters: {
    appRouter: true,
    controls: { exclude: ['choices', 'groups', 'howToPlay'] },
  },
  args: {
    screenId: 'game-choices',
    title: 'Connect Four',
    motif: 'discs',
    subtitle: 'Drop a disc. Connect four. Plan your next turn.',
    groups: { play: 'Play', more: 'More' },
    howToPlay: { label: 'How to play', onClick: fn() },
    choices: [
      {
        key: 'custom-game',
        title: 'Play with friends or bots',
        caption: 'Invite people in this space, or add bots',
        icon: UsersIcon,
        emphasis: 'primary',
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

/**
 * The hero block with the way to the rules, then the ways to play as large
 * tiles (the main way in leads) and, apart, the looks back.
 */
export const Default: Story = {};

/** Choosing a tile opens what it names. */
export const ChooseAChoice: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByTestId('choice-custom-game'));
    await expect(args.choices[0]?.onClick).toHaveBeenCalled();
  },
};
