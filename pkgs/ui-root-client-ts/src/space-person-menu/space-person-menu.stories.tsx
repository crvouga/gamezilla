import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { SpacePersonMenu } from './index';
import Example from './space-person-menu.example';

type Args = {
  onPersonAction: (personId: string, action: string) => void;
  onInvite: () => void;
};

const meta = {
  id: 'space-person-menu',
  title: 'Organisms/Space/SpacePersonMenu',
  component: SpacePersonMenu,
  tags: ['autodocs'],
  args: { onPersonAction: fn(), onInvite: fn() },
  parameters: { controls: { disable: true } },
  render: (args) => <Example {...args} />,
} satisfies Meta<Args>;
export default meta;

/**
 * Pressing a person opens their actions as a menu against the avatar;
 * choosing one reports it and closes the menu.
 */
export const HostRemovesGuest: StoryObj<Args> = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const cell = canvas.getByRole('button', { name: /^bob/ });
    await userEvent.click(cell);
    await expect(cell).toHaveAttribute('aria-expanded', 'true');
    await userEvent.click(
      canvas.getByRole('menuitem', { name: 'Remove from space' })
    );
    await expect(args.onPersonAction).toHaveBeenCalledWith(
      'bob',
      'removeFromSpace'
    );
    await expect(cell).toHaveAttribute('aria-expanded', 'false');
  },
};

export const AddBot: StoryObj<Args> = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: /^Open seat/i }));
    const addBot = await canvas.findByRole('menuitem', { name: 'Add bot' });
    await expect(addBot.querySelector('img')).toHaveAttribute('alt', '');
  },
};
