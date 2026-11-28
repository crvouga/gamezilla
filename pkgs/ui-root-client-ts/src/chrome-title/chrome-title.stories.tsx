import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example from './chrome-title.example';
import { ChromeTitle } from './index';

const meta = {
  id: 'primitives-chrometitle',
  title: 'Atoms/ChromeTitle',
  component: ChromeTitle,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
