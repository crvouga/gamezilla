import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { ScreenBase } from './index';
import Example from './screen-base.example';

const meta = {
  id: 'layouts-screenbase',
  title: 'Templates/ScreenBase',
  component: ScreenBase,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
