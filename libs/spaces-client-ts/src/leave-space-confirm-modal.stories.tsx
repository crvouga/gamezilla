import { fn } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { LeaveSpaceConfirmModal } from './leave-space-confirm-modal';
import { withSpaceScreenBehind } from './space-screen-behind.example';

const meta = {
  id: 'screens-spaces-leave-confirm',
  title: 'Screens/Spaces/Leave space',
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
  },
} satisfies Meta<typeof LeaveSpaceConfirmModal>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A guest leaves on every device; they can join again while it is live. */
export const Guest: Story = {};

/** The host leaving ends the space for everyone, and the copy says so. */
export const AsHost: Story = { args: { asHost: true } };
