import { Handles } from '@libs/test-ids-shared-ts/handles';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { RenameSpaceModalView } from './rename-space-modal-view';
import { withSpaceScreenBehind } from './space-screen-behind.example';

const meta = {
  id: 'screens-spaces-rename',
  title: 'Screens/Spaces/Rename space',
  component: RenameSpaceModalView,
  tags: ['autodocs'],
  decorators: [withSpaceScreenBehind],
  parameters: { appRouter: true },
  args: {
    visible: true,
    value: 'Friday game night',
    refused: false,
    onChangeValue: fn(),
    onClose: fn(),
    operation: fn(() => Promise.resolve()),
  },
} satisfies Meta<typeof RenameSpaceModalView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Prefilled with the custom title; Save renames for everyone. */
export const Prefilled: Story = {};

/** No custom title yet: saving empty keeps the host-name default. */
export const Empty: Story = { args: { value: '' } };

/** A name the policy refuses: said as typed, Save is off. */
export const Refused: Story = { args: { value: 'Not allowed', refused: true } };

/** The rename was refused by the server: why, with a retry in place. */
export const SaveFailed: Story = {
  args: {
    operation: fn(() =>
      Promise.reject(new Error('You are offline. Try again when connected.'))
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByTestId(Handles.spaceRenameConfirm)
    );
    await expect(
      await canvas.findByText("Couldn't rename space")
    ).toBeVisible();
  },
};
