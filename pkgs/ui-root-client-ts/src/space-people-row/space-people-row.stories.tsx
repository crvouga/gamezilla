import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { SpacePeopleRow } from './index';
import Example from './space-people-row.example';

type Args = { onPerson: (id: string) => void; onInvite: () => void };

const meta = {
  id: 'space-people-row',
  title: 'Space/People row',
  component: SpacePeopleRow,
  tags: ['autodocs'],
  args: { onPerson: fn(), onInvite: fn() },
  parameters: { controls: { disable: true } },
  render: (args) => <Example {...args} />,
} satisfies Meta<Args>;
export default meta;

/**
 * Every cell state side by side: each status badge has its own shape and
 * is said in the cell's accessible name; the row keeps one height.
 */
export const States: StoryObj<Args> = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole('button', {
        name: 'bob, Host, Choosing a game, playing White',
      })
    );
    await expect(args.onPerson).toHaveBeenCalledWith('bob');
    await expect(
      canvas.getByRole('button', { name: 'lee, Guest, Not ready, Muted' })
    ).toHaveAttribute('aria-expanded', 'true');
    await expect(
      canvas.getAllByRole('button', { name: 'Invite' })
    ).toHaveLength(1);
  },
};
