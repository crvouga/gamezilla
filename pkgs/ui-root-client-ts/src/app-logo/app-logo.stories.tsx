import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example from './app-logo.example';
import { AppLogo } from './index';

const meta = {
  id: 'components-brand-applogo',
  title: 'Atoms/AppLogo',
  component: AppLogo,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
