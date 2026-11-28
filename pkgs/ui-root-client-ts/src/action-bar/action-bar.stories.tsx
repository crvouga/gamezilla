import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example from './action-bar.example';
import { ActionBar } from './index';

const meta = {
  id: 'components-inputs-actionbar',
  title: 'Molecules/ActionBar',
  component: ActionBar,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
