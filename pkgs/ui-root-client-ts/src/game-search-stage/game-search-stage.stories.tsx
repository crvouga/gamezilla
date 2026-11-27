import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example, {
  type GameSearchStageExampleProps,
} from './game-search-stage.example';
import { GameSearchStage } from './index';

const meta = {
  id: 'product-game-search-stage',
  title: 'Organisms/Games/Shared/GameSearchStage',
  component: GameSearchStage,
  tags: ['autodocs'],
  args: { timed: true, offline: false, onStop: fn() },
  argTypes: {
    timed: { control: 'boolean' },
    offline: { control: 'boolean' },
  },
  parameters: {
    layout: 'fullscreen',
    controls: { include: ['timed', 'offline'] },
  },
  render: (args) => <Example {...args} />,
} satisfies Meta<GameSearchStageExampleProps>;
export default meta;

type Story = StoryObj<GameSearchStageExampleProps>;

/** Searching: the state sits on the board's own square, over the person's seat and chosen clock, with Stop below. */
export const Searching: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole('heading', { level: 2, name: 'Searching…' })
    ).toBeVisible();
    await expect(canvas.getByText('5 min + 3 sec')).toBeVisible();
    await userEvent.click(canvas.getByTestId('example-stop'));
    await expect(args.onStop).toHaveBeenCalledTimes(1);
  },
};

/** An untimed game shows no clock on the seat. */
export const Untimed: Story = { args: { timed: false } };

/** Offline: a still mark, the words, and Stop held back. */
export const Offline: Story = { args: { offline: true } };
