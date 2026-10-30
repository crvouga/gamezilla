import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { ThemeProvider } from './index';
import Example from './theme-tokens.example';

const meta = {
  title: 'Foundations/Theme Tokens',
  component: ThemeProvider,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
