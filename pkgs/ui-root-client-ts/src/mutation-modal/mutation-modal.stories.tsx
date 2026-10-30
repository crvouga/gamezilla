import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { MutationModal } from './index';
import Example from './mutation-modal.example';

const meta = {
  title: 'Components/Overlay/MutationModal',
  component: MutationModal,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
