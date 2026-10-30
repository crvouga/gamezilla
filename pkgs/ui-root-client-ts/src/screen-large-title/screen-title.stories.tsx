import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { ScreenLargeTitle } from './index';
import Example from './screen-title.example';

const meta = {
  id: 'layouts-screenlargetitle',
  title: 'Molecules/ScreenLargeTitle',
  component: ScreenLargeTitle,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
