import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { OverflowMenuButton } from './index';
import Example from './overflow-menu-button.example';

const meta = {
  title: 'Components/Inputs/OverflowMenuButton',
  component: OverflowMenuButton,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
