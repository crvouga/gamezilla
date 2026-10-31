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

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
