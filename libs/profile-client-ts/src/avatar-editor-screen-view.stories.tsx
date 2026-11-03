import { RefusedChangeCard } from '@libs/app-root-client-ts/refused-change-notice';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { AvatarEditorScreenView } from './avatar-editor-screen-view';
import { STORY_PROFILE_ID } from './profile-story.example';

const SAVED = { style: 'funEmoji', seed: STORY_PROFILE_ID, options: {} };

const meta = {
  id: 'screens-profile-avatar',
  title: 'Screens/Profile/Avatar editor',
  component: AvatarEditorScreenView,
  tags: ['autodocs'],
  parameters: {
    appRouter: true,
    controls: { exclude: ['draft', 'notice'] },
  },
  args: {
    status: 'ready',
    draft: SAVED,
    seedFallback: STORY_PROFILE_ID,
    canSave: false,
    seedCopied: false,
    confirmingDiscard: false,
    onDraftChange: fn(),
    onRandomizeSeed: fn(),
    onCopySeed: fn(),
    onBack: fn(),
    onConfirmDiscard: fn(),
    onKeepEditing: fn(),
    onSave: fn(() => Promise.resolve()),
  },
} satisfies Meta<typeof AvatarEditorScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The saved avatar, unchanged: Save waits for an edit. */
export const Pristine: Story = {};

/** The saved avatar is still reading: a placeholder holds the preview's place. */
export const Loading: Story = { args: { status: 'loading' } };

/** A new seed and style: the preview follows the draft and Save is ready. */
export const Edited: Story = {
  args: {
    draft: { style: 'bottts', seed: 'lucky-otter-42', options: {} },
    canSave: true,
  },
};

/** A blank seed falls back to the person's default look meanwhile. */
export const BlankSeed: Story = {
  args: { draft: { ...SAVED, seed: '' }, canSave: true },
};

/** The seed was just copied: the copy button confirms it. */
export const SeedCopied: Story = { args: { seedCopied: true } };

/** Leaving with unsaved changes asks before throwing them away. */
export const ConfirmDiscard: Story = {
  args: {
    draft: { ...SAVED, seed: 'lucky-otter-42' },
    canSave: true,
    confirmingDiscard: true,
  },
};

/** A refused avatar change is told under the preview. */
export const RefusedChange: Story = {
  render: (args) => (
    <AvatarEditorScreenView
      {...args}
      notice={
        <RefusedChangeCard
          refusal={{
            mutationId: '3b9f0c2e-0000-4000-8000-000000000002',
            mutationName: 'patchAvatar',
            code: 'FORBIDDEN',
            message: 'Forbidden',
            meta: null,
          }}
          onDismiss={() => undefined}
        />
      }
    />
  ),
};

/** Save is in flight: the button says so. */
export const Saving: Story = {
  args: {
    draft: { ...SAVED, seed: 'lucky-otter-42' },
    canSave: true,
    onSave: fn(() => new Promise<void>(() => undefined)),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('button', { name: 'Save' }));
    await expect(
      await canvas.findByRole('button', { name: 'Saving…' })
    ).toBeVisible();
  },
};

/** The save failed: the button says so and the draft is kept for a retry. */
export const SaveFailed: Story = {
  args: {
    draft: { ...SAVED, seed: 'lucky-otter-42' },
    canSave: true,
    onSave: fn(() => Promise.reject(new Error('offline'))),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('button', { name: 'Save' }));
    await expect(
      await canvas.findByRole('button', { name: "Couldn't save" })
    ).toBeVisible();
  },
};
