import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example from './chrome-title.example';
import { ChromeTitle } from './index';

const meta = {
  title: 'Primitives/ChromeTitle',
  component: ChromeTitle,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
