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
    moreTestId: 'choice-more',
    choices: [
      {
        key: 'multiplayer',
        title: 'Find an opponent',
        caption: 'Meet another Connect Four player',
        icon: SearchIcon,
        dataSet: { testid: 'choice-multiplayer' },
        onClick: fn(),
      },
      {
        key: 'custom-game',
        title: 'Play with friends or bots',
        caption: 'With the people in this space, or bots',
        icon: UsersIcon,
        dataSet: { testid: 'choice-custom-game' },
        onClick: fn(),
      },
      {
        key: 'history',
        title: 'History and stats',
        caption: 'Review your games, wins and draws',
        icon: HistoryIcon,
        emphasis: 'quiet',
        dataSet: { testid: 'choice-history' },
        onClick: fn(),
      },
    ],
  },
} satisfies Meta<typeof GameMenuScreen>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The hero block, the first way to play as one primary control, the other ways as rows, the look back behind More. */
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
    await userEvent.click(await canvas.findByTestId('choice-custom-game'));
    await expect(args.choices[1]?.onClick).toHaveBeenCalled();
  },
};

/** More opens in place under the rows; the quiet choice behind it opens what it names. */
export const OpenMore: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const more = await canvas.findByTestId('choice-more');
    await expect(more).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(more);
    await expect(more).toHaveAttribute('aria-expanded', 'true');
    await userEvent.click(await canvas.findByTestId('choice-history'));
    await expect(args.choices[2]?.onClick).toHaveBeenCalled();
  },
};
