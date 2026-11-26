import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example, {
  type GameStageOverlayExampleProps,
} from './game-stage-overlay.example';
import { GameResultOverlay } from './index';

const meta = {
  id: 'product-game-stage-overlay',
  title: 'Organisms/Games/Shared/GameStageOverlay',
  component: GameResultOverlay,
  tags: ['autodocs'],
  args: {
    tone: 'won',
    onDismiss: fn(),
    onRematch: fn(),
  },
  argTypes: {
    tone: {
      control: 'select',
      options: ['won', 'lost', 'drawn', 'neutral'],
    },
  },
  parameters: { controls: { include: ['tone'] } },
  render: (args) => <Example {...args} />,
} satisfies Meta<GameStageOverlayExampleProps>;
export default meta;

type Story = StoryObj<GameStageOverlayExampleProps>;

/** The person won; the close control dismisses the card. */
export const Won: Story = {
  args: { tone: 'won' },
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
export const Lost: Story = { args: { tone: 'lost' } };

/** Nobody won. */
export const Drawn: Story = { args: { tone: 'drawn' } };

/** Someone watching: no side taken. */
export const Watching: Story = { args: { tone: 'neutral' } };
