import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { DiscDropBoard } from './index';

const meta = {
  id: 'product-discdropboard',
  title: 'Games/Connect Four/Board',
  component: DiscDropBoard,
  tags: ['autodocs'],
  args: {
    cells: Array.from({ length: 42 }, () => 0),
    columns: 7,
    rows: 6,
    active: 1,
    winning: [],
    interactive: true,
    label: 'Four in a row',
    testId: 'disc-story',
    columnTestId: (column: number) => `column-${column}`,
    cellLabel: (column: number, row: number, disc: number) =>
      `Column ${column + 1}, row ${row + 1}: ${disc || 'empty'}`,
    columnLabel: (column: number, occupied: number, full: boolean) =>
      `Column ${column + 1}, ${occupied} discs${full ? ', full' : ''}`,
    onDrop: fn(),
  },
  argTypes: {
    onDrop: { control: false },
    columnTestId: { control: false },
    cellLabel: { control: false },
    columnLabel: { control: false },
  },
} satisfies Meta<typeof DiscDropBoard>;
export default meta;
export const Empty: StoryObj<typeof meta> = {};
export const Disabled: StoryObj<typeof meta> = { args: { interactive: false } };
export const Winning: StoryObj<typeof meta> = {
  args: {
    cells: [1, 1, 1, 1, ...Array.from({ length: 38 }, () => 0)],
    winning: [0, 1, 2, 3],
    lastCell: 3,
    interactive: false,
  },
};

export const Activate: StoryObj<typeof meta> = {
  play: async ({ canvasElement, args, step }) => {
    const column = within(canvasElement).getByRole('button', {
      name: 'Column 1, 0 discs',
    });
    await step(
      'Activate a column and expose its zero-based index',
      async () => {
        await userEvent.click(column);
        await expect(args.onDrop).toHaveBeenCalledTimes(1);
        await expect(args.onDrop).toHaveBeenCalledWith(0);
      }
    );
  },
};
