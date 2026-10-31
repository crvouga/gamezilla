import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { PathGridBoard, type PathGridBoardProps } from './index';
import Example from './path-grid-board.example';

const meta = {
  id: 'product-pathgridboard',
  title: 'Games/Numberlink/Board',
  component: PathGridBoard,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

type ExampleArgs = Pick<PathGridBoardProps, 'disabled' | 'onActivate'>;

/** Controls configure the board; activating cells still connects the example paths. */
export const States: StoryObj<ExampleArgs> = {
  args: { disabled: false, onActivate: fn() },
  argTypes: {
    disabled: { control: 'boolean' },
    onActivate: { control: false },
  },
  parameters: { controls: { include: ['disabled'] } },
  render: (args) => <Example {...args} />,
};

export const Activate: StoryObj<ExampleArgs> = {
  ...States,
  play: async ({ canvasElement, args, step }) => {
    const cell = within(canvasElement).getByTestId('example-paths-cell-6');
    await step('Activate a cell and connect its path', async () => {
      await userEvent.click(cell);
      await expect(args.onActivate).toHaveBeenCalledTimes(1);
      await expect(args.onActivate).toHaveBeenCalledWith(6);
      await expect(cell).toHaveAttribute('data-connected', 'true');
    });
  },
};
