import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { ScreenBase } from './index';
import Example from './screen-base.example';

const meta = {
  title: 'Layouts/ScreenBase',
  component: ScreenBase,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
