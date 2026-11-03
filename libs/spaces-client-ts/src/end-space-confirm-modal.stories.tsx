import { Handles } from '@libs/test-ids-shared-ts/handles';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { EndSpaceConfirmModal } from './end-space-confirm-modal';
import { withSpaceScreenBehind } from './space-screen-behind.example';

const meta = {
  id: 'screens-spaces-end-confirm',
  title: 'Screens/Spaces/End space',
  component: EndSpaceConfirmModal,
  tags: ['autodocs'],
  decorators: [withSpaceScreenBehind],
  parameters: { appRouter: true },
  args: {
    visible: true,
    onClose: fn(),
    operation: fn(() => Promise.resolve()),
    onSuccess: fn(),
  },
} satisfies Meta<typeof EndSpaceConfirmModal>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The host confirms ending: everyone leaves, and it cannot be undone. */
export const Confirm: Story = {};

/** Ending went through: told in place, the person stays on the screen. */
export const Ended: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByTestId(Handles.spaceEndConfirm));
    await expect(await canvas.findByText('Space ended')).toBeVisible();
  },
};
