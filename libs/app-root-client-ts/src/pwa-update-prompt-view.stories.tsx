import { fn } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { withBannerHost } from './banner-host-story.example';
import { PwaUpdatePromptBannerView } from './pwa-update-prompt-view';

const meta = {
  id: 'screens-shell-new-version',
  title: 'Screens/Shell/New version available',
  component: PwaUpdatePromptBannerView,
  tags: ['autodocs'],
  decorators: [withBannerHost],
  parameters: { appRouter: true },
  args: { visible: true, onDismiss: fn(), onReload: fn() },
} satisfies Meta<typeof PwaUpdatePromptBannerView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A newer version has downloaded and waits for a reload. */
export const Available: Story = {};
