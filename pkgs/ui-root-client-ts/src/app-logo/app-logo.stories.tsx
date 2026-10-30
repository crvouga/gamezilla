import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example from './app-logo.example';
import { AppLogo } from './index';

const meta = {
  title: 'Components/Brand/AppLogo',
  component: AppLogo,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
