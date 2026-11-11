import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example, {
  type GameStageOverlayExampleProps,
} from './game-stage-overlay.example';
import { GameVersusOverlay } from './index';

const meta = {
  id: 'product-game-stage-overlay',
  title: 'Games/Shared/Components/GameStageOverlay',
  component: GameVersusOverlay,
  tags: ['autodocs'],
  args: {
    shown: 'versus',
    count: 3,
    onSkip: fn(),
    onDismiss: fn(),
    onRematch: fn(),
  },
  argTypes: {
    shown: {
      control: 'select',
      options: ['versus', 'won', 'lost', 'drawn', 'neutral'],
    },
    count: { control: { type: 'number', min: 1, max: 9 } },
  },
  parameters: { controls: { include: ['shown', 'count'] } },
  render: (args) => <Example {...args} />,
} satisfies Meta<GameStageOverlayExampleProps>;
export default meta;

type Story = StoryObj<GameStageOverlayExampleProps>;

/** Who plays whom, counting down; the whole card skips to the board. */
export const Versus: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const card = canvas.getByRole('button', {
      name: 'River versus Atlas. Skip to the board.',
    });
    await expect(card).toHaveTextContent('Starts in3');
    await userEvent.click(card);
    await expect(args.onSkip).toHaveBeenCalledTimes(1);
  },
};

/** The last second of the count. */
export const VersusLastSecond: Story = { args: { count: 1 } };

/** The person won; the close control dismisses the card. */
export const Won: Story = {
  args: { shown: 'won' },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('status')).toHaveTextContent('You won');
    await userEvent.click(
      canvas.getByRole('button', { name: 'Show the board' })
    );
    await expect(args.onDismiss).toHaveBeenCalledTimes(1);
    await userEvent.click(canvas.getByRole('button', { name: 'Rematch' }));
    await expect(args.onRematch).toHaveBeenCalledTimes(1);
  },
};

/** The person lost. */
export const Lost: Story = { args: { shown: 'lost' } };

/** Nobody won. */
export const Drawn: Story = { args: { shown: 'drawn' } };

/** Someone watching: no side taken. */
export const Watching: Story = { args: { shown: 'neutral' } };
