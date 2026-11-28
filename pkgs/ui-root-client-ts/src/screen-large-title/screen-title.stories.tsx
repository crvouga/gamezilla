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

export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
