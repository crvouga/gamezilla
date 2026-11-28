import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { ThemeProvider } from './index';
import Example from './theme-tokens.example';

const meta = {
  id: 'foundations-theme-tokens',
  title: 'Foundations/ThemeTokens',
  component: ThemeProvider,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
