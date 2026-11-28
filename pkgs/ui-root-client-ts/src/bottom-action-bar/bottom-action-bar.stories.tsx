import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example from './bottom-action-bar.example';
import { BottomActionBar } from './index';

const meta = {
  id: 'components-inputs-bottomactionbar',
  title: 'Molecules/BottomActionBar',
  component: BottomActionBar,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
