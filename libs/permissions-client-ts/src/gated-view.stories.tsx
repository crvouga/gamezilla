import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { GatedView } from './gated-view';
import { withToolbar } from './permissions-story.example';

const meta = {
  id: 'screens-permissions-gated',
  title: 'Screens/Permissions/Gated',
  component: GatedView,
  tags: ['autodocs'],
  decorators: [withToolbar],
  parameters: { controls: { exclude: ['children'] } },
  argTypes: {
    access: {
      control: 'inline-radio',
      options: ['allowed', 'lock', 'hide', 'soft'],
    },
  },
  args: {
    access: 'lock',
    action: 'spaces:host',
    onLocked: fn(),
    children: 'Host a space',
  },
} satisfies Meta<typeof GatedView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Denied with the `lock` treatment: a key-marked button that asks for the denial. */
export const Locked: Story = {};

/** Allowed: the gated content renders unchanged. */
export const Allowed: Story = { args: { access: 'allowed' } };

/** Denied with `soft`: the content stays; the attempt itself is gated. */
export const Soft: Story = { args: { access: 'soft' } };

/** Denied with `hide`: nothing renders in the content's place. */
export const Hidden: Story = { args: { access: 'hide' } };

/** Tapping the lock asks the container to open the denial surface. */
export const PressLocked: Story = {
  play: async ({ args, canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole('button', { name: 'Host a space' })
    );
    await expect(args.onLocked).toHaveBeenCalledTimes(1);
  },
};
