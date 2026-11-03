import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { ProfileEditScreenView } from './profile-edit-screen-view';

const meta = {
  id: 'screens-profile-edit',
  title: 'Screens/Profile/Edit profile',
  component: ProfileEditScreenView,
  tags: ['autodocs'],
  parameters: { appRouter: true },
  args: {
    onOpenPrivacy: fn(),
    onOpenUsername: fn(),
    onOpenAvatar: fn(),
  },
} satisfies Meta<typeof ProfileEditScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The editor menu: privacy, username and avatar, each with what it changes. */
export const Menu: Story = {};

/** Each row opens its own editor. */
export const OpenUsername: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByText('Username'));
    await expect(args.onOpenUsername).toHaveBeenCalledOnce();
    await expect(args.onOpenAvatar).not.toHaveBeenCalled();
  },
};
