import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { AppUpdateRequiredBannerView } from './app-update-required-view';
import { withBannerHost } from './banner-host-story.example';

const meta = {
  id: 'screens-shell-update-required',
  title: 'Screens/Shell/Update required',
  component: AppUpdateRequiredBannerView,
  tags: ['autodocs'],
  decorators: [withBannerHost],
  parameters: { appRouter: true },
  args: { visible: true, onDismiss: fn(), onUpdate: fn() },
} satisfies Meta<typeof AppUpdateRequiredBannerView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The product refuses this version: update, and nothing done is lost. */
export const Required: Story = {};

/** Dismissed, or the version is accepted: no banner. */
export const Hidden: Story = { args: { visible: false } };

/** "Update" reloads into the newer version. */
export const Update: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const update = await canvas.findByRole('button', { name: 'Update' });
    await userEvent.click(update);
    await expect(args.onUpdate).toHaveBeenCalledOnce();
  },
};
