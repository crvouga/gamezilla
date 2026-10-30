import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { StatusIconSlot } from './index';
import Example from './status-icon-slot.example';

const meta = {
  id: 'components-feedback-statusiconslot',
  title: 'Molecules/StatusIconSlot',
  component: StatusIconSlot,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
