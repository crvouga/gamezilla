import { Handles } from '@libs/test-ids-shared-ts/handles';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { LeaveSpaceConfirmModal } from './leave-space-confirm-modal';
import { withSpaceScreenBehind } from './space-screen-behind.example';

const meta = {
  id: 'screens-space-leave',
  title: 'Screens/Space/Enter and leave/Leave space',
  component: LeaveSpaceConfirmModal,
  tags: ['autodocs'],
  decorators: [withSpaceScreenBehind],
  parameters: { appRouter: true },
  args: {
    visible: true,
    onClose: fn(),
    operation: fn(() => Promise.resolve()),
    onSuccess: fn(),
    asHost: false,
    spaceName: 'Friday game night',
  },
} satisfies Meta<typeof LeaveSpaceConfirmModal>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A guest leaves on every device; they can join again while it is live. */
export const Guest: Story = { parameters: { spaceBehind: 'guest' } };

/** The host leaving ends the space for everyone, and the copy says so. */
export const AsHost: Story = { args: { asHost: true } };

/** J9: a guest confirms Leave; the dialog says they left. */
export const GuestLeaves: Story = {
  parameters: { spaceBehind: 'guest' },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByTestId(Handles.spaceLeaveConfirm));
    await expect(args.operation).toHaveBeenCalledTimes(1);
    await expect(await canvas.findByText('You left the space')).toBeVisible();
  },
};

/** J9: the host confirms; the space ends for everyone. */
export const HostEnds: Story = {
  args: { asHost: true },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByTestId(Handles.spaceLeaveConfirm));
    await expect(args.operation).toHaveBeenCalledTimes(1);
    await expect(await canvas.findByText('Space ended')).toBeVisible();
  },
};
