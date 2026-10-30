import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { SpectatorIndicator } from './index';
export default {
  title: 'Product/SpectatorIndicator',
  component: SpectatorIndicator,
  tags: ['autodocs'],
} satisfies Meta<typeof SpectatorIndicator>;
export const Spectating: StoryObj<typeof SpectatorIndicator> = {};
export const WithWatchers: StoryObj<typeof SpectatorIndicator> = {
  args: { count: { value: 12, label: '12 watching' } },
};
