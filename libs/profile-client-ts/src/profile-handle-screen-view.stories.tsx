import { withShippedModeration } from '@libs/moderation-client-ts/moderation-story.example';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { ProfileHandleScreenView } from './profile-handle-screen-view';

const meta = {
  id: 'screens-profile-handle',
  title: 'Screens/Profile/Username',
  component: ProfileHandleScreenView,
  tags: ['autodocs'],
  decorators: [withShippedModeration],
  parameters: {
    appRouter: true,
    controls: { exclude: ['saveError', 'usernameChange'] },
  },
  args: {
    value: 'avery',
    standInName: null,
    saveError: null,
    canSave: true,
    usernameChange: null,
    onValueChange: fn(),
    onSave: fn(() => Promise.resolve()),
    onCancel: fn(),
  },
} satisfies Meta<typeof ProfileHandleScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The saved username in the field, the rules beneath it, Save ready. */
export const Ready: Story = {};

/** No username yet: the field shows its placeholder. */
export const Empty: Story = { args: { value: '' } };

/** As-you-type moderation flags a name the rules refuse before saving. */
export const NotAllowed: Story = { args: { value: 'support_staff' } };

/** The saved name is no longer allowed: the field says what others see instead. */
export const StandInName: Story = {
  args: { value: 'support_staff', standInName: 'Advanced Landfowl 191' },
};

/** Before the session has a profile there is nothing to save to. */
export const SaveUnavailable: Story = { args: { canSave: false } };

/** A saved change is still being shared with the server. */
export const ChangeSharing: Story = {
  args: { usernameChange: { status: 'pending', online: true } },
};

/** Offline, the change waits for the connection to return. */
export const ChangeOffline: Story = {
  args: { usernameChange: { status: 'pending', online: false } },
};

/** The server refused a change made earlier, here or offline. */
export const ChangeRefused: Story = {
  args: { usernameChange: { status: 'rejected', code: 'USERNAME_COOLDOWN' } },
};

/** Long drafts stay inside the field. */
export const LongDraft: Story = {
  args: { value: 'a_really_long_username_that_keeps_going_and_going' },
};

/** Save is in flight: the button says so and cannot be pressed again. */
export const Saving: Story = {
  args: { onSave: fn(() => new Promise<void>(() => undefined)) },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('button', { name: 'Save' }));
    await expect(
      await canvas.findByRole('button', { name: 'Saving…' })
    ).toBeVisible();
    await expect(args.onSave).toHaveBeenCalledOnce();
  },
};

/** The name is taken: the Save button says why the save was refused. */
export const Taken: Story = {
  args: {
    value: 'jordan_plays',
    saveError: { code: 'USERNAME_TAKEN' },
    onSave: fn(() => Promise.reject(new Error('Username is taken'))),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('button', { name: 'Save' }));
    await expect(
      await canvas.findByRole('button', { name: 'Username is taken' })
    ).toBeVisible();
  },
};
