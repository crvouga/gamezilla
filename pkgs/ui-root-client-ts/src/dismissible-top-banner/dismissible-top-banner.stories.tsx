import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example from './dismissible-top-banner.example';
import { DismissibleBannerPortalProvider } from './index';

const meta = {
  title: 'Components/Feedback/DismissibleBanner',
  component: DismissibleBannerPortalProvider,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
