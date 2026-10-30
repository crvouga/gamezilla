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

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
